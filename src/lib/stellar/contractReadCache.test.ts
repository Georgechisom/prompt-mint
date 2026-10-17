import { describe, it, expect, vi } from "vitest";
import {
  ContractReadCache,
  buildContractReadCacheKey,
  evaluateContractReadCacheEntry,
  serializeContractReadArgs,
  DEFAULT_CONTRACT_READ_STALE_TIME_MS,
  DEFAULT_CONTRACT_READ_MAX_STALE_AGE_MS,
} from "./contractReadCache";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key() {
      return null;
    },
    get length() {
      return store.size;
    },
  };
}

describe("contract read cache", () => {
  it("builds stable keys regardless of object key order and bigint args", () => {
    const a = buildContractReadCacheKey("CABC", "get_prompt", [{ id: 1n, owner: "G1" }]);
    const b = buildContractReadCacheKey("CABC", "get_prompt", [{ owner: "G1", id: 1n }]);
    expect(a).toBe(b);
    expect(serializeContractReadArgs(7n)).toBe("7n");
  });

  it("persists and rehydrates entries, including bigint values", () => {
    const storage = createStorage();
    const cache = new ContractReadCache({ storage: storage as unknown as Storage });

    cache.write("CABC::get_prompt::[1n]", { id: 1n, salesCount: 3 });

    const reloaded = new ContractReadCache({ storage: storage as unknown as Storage });
    const entry = reloaded.read<{ id: bigint; salesCount: number }>("CABC::get_prompt::[1n]");

    expect(entry).not.toBeNull();
    expect(entry?.value.id).toBe(1n);
    expect(entry?.value.salesCount).toBe(3);
  });

  it("serves a fresh value without calling the fetcher", async () => {
    const now = () => 1_000;
    const cache = new ContractReadCache({ storage: null, now });
    cache.write("k", "cached");
    const fetcher = vi.fn(async () => "live");

    const value = await cache.get("k", fetcher);

    expect(value).toBe("cached");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("coalesces concurrent reads for the same key into one call", async () => {
    const cache = new ContractReadCache({ storage: null });
    let resolveFetch: (value: string) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = cache.get("k", fetcher);
    const second = cache.get("k", fetcher);
    expect(cache.isInflight("k")).toBe(true);

    resolveFetch("live");
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe("live");
    expect(b).toBe("live");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.isInflight("k")).toBe(false);
  });

  it("serves stale content when a refresh fails inside the stale window", async () => {
    const storage = createStorage();
    const now = () => DEFAULT_CONTRACT_READ_STALE_TIME_MS + 5_000;
    const cache = new ContractReadCache({ storage: storage as unknown as Storage, now });
    // Written "now" so it is older than the stale time but inside max stale age.
    cache.write("k", { title: "stale" }, 0);

    const fetcher = vi.fn(async () => {
      throw new Error("rpc down");
    });

    const value = await cache.get<{ title: string }>("k", fetcher);

    expect(value.title).toBe("stale");
    expect(cache.getLastError("k")).toBeInstanceOf(Error);
  });

  it("rejects content once the maximum stale age has passed", async () => {
    const now = () => DEFAULT_CONTRACT_READ_MAX_STALE_AGE_MS + 1;
    const cache = new ContractReadCache({ storage: null, now });
    cache.write("k", "ancient", 0);

    await expect(
      cache.get("k", async () => {
        throw new Error("still down");
      }),
    ).rejects.toThrow("still down");
  });

  it("force bypasses a fresh cache entry", async () => {
    const cache = new ContractReadCache({ storage: null });
    cache.write("k", "cached");

    const value = await cache.get("k", async () => "live", { force: true });

    expect(value).toBe("live");
  });

  it("invalidates by prefix across both layers", () => {
    const storage = createStorage();
    const cache = new ContractReadCache({ storage: storage as unknown as Storage });
    cache.write("CABC::get_prompt::[1n]", "one");
    cache.write("CABC::get_prompt::[2n]", "two");
    cache.write("CDEF::get_prompt::[1n]", "other");

    cache.invalidateByPrefix("CABC::");

    expect(cache.read("CABC::get_prompt::[1n]")).toBeNull();
    expect(cache.read("CABC::get_prompt::[2n]")).toBeNull();
    expect(cache.read("CDEF::get_prompt::[1n]")).not.toBeNull();
  });

  it("evaluates entry freshness thresholds", () => {
    const entry = { key: "k", value: "v", timestamp: 1_000 };
    expect(evaluateContractReadCacheEntry(entry, 2_000, 5_000, 10_000).isFresh).toBe(true);
    expect(evaluateContractReadCacheEntry(entry, 20_000, 5_000, 10_000).canServeStaleContent).toBe(false);
  });
});
