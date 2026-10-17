/**
 * Contract read caching layer (#689).
 *
 * The marketplace issues a lot of read-only Soroban calls — listing reads,
 * per-prompt access checks, promotions, purchase details. Many of these are
 * repeated across components, routes, and background refreshes within a short
 * window. This module is a small, framework-agnostic cache that sits in front
 * of those reads so the app can:
 *
 * - serve a recently-read value without hitting the network again,
 * - fall back to a still-reasonable stale value if a refresh fails, and
 * - coalesce concurrent reads for the same key into a single in-flight call.
 *
 * It is deliberately independent of React and of the Soroban client so it can
 * be reused from hooks, providers, and the browse/creator pages. The existing
 * `marketplaceReadCache` stays as the browse-specific persistence shim; this
 * layer is the general primitive underneath it.
 *
 * Caching only ever applies to public read metadata. It never caches wallet
 * signatures, decrypted content, or write transactions, and callers still run
 * the normal access checks.
 */

/** A monotonic-ish clock, injectable for deterministic tests. */
export type Clock = () => number;

export interface ContractReadCacheOptions {
  /** How long a value is considered fresh and served without a refresh. */
  staleTimeMs?: number;
  /** How long a stale value may still be served if a refresh fails. */
  maxStaleAgeMs?: number;
  /**
   * Persistence backend. Defaults to `window.localStorage` in the browser and
   * `null` (memory-only) elsewhere or when the caller passes `null`.
   */
  storage?: Storage | null;
  /** Storage bucket name. Keep it stable across releases. */
  namespace?: string;
  /** Resolve a default value for a key synchronously, bypassing the storage read. */
  now?: Clock;
}

export interface ContractReadCacheEntry<T> {
  /** Cache key the entry was written under. */
  key: string;
  /** The cached value. */
  value: T;
  /** Epoch milliseconds the value was written. */
  timestamp: number;
}

export interface ContractReadCacheState<T> {
  hasCache: boolean;
  isFresh: boolean;
  isStale: boolean;
  canServeStaleContent: boolean;
  useStaleWhileRevalidating: boolean;
  value: T | null;
  ageMs: number | null;
}

export const DEFAULT_CONTRACT_READ_STALE_TIME_MS = 30_000;
export const DEFAULT_CONTRACT_READ_MAX_STALE_AGE_MS = 5 * 60_000;
export const DEFAULT_CONTRACT_READ_CACHE_NAMESPACE =
  "prompt-mint:contract-read-cache";

type SerializedEntry = {
  key: string;
  value: unknown;
  timestamp: number;
};

const BIGINT_TAG = "__bigint";

/** JSON replacer that keeps `bigint` values losslessly round-trippable. */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return { [BIGINT_TAG]: value.toString() };
  }
  return value;
}

/** JSON reviver that restores values written by `jsonReplacer`. */
function jsonReviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    BIGINT_TAG in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>)[BIGINT_TAG] === "string"
  ) {
    try {
      return BigInt((value as Record<string, string>)[BIGINT_TAG]);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Deterministic serialization used to turn read arguments into a stable key.
 * Object keys are sorted so `{a:1,b:2}` and `{b:2,a:1}` collide as intended,
 * and `bigint` arguments (prompt ids, stroop amounts) are represented exactly.
 */
export function serializeContractReadArgs(value: unknown): string {
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  if (value === undefined) {
    return "undefined";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeContractReadArgs).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serializeContractReadArgs(record[key])}`)
    .join(",")}}`;
}

/**
 * Builds the canonical cache key for a contract read.
 *
 * @param contractId The contract being read (keeps networks/contracts isolated).
 * @param method The read method/function name.
 * @param args Positional arguments passed to the read.
 */
export function buildContractReadCacheKey(
  contractId: string,
  method: string,
  args: readonly unknown[] = [],
): string {
  return `${contractId}::${method}::${serializeContractReadArgs(args)}`;
}

/**
 * Pure evaluation of an entry against the freshness thresholds. Exported so
 * callers (and tests) can inspect a snapshot without touching class state.
 */
export function evaluateContractReadCacheEntry<T>(
  entry: ContractReadCacheEntry<T> | null | undefined,
  now: number,
  staleTimeMs: number = DEFAULT_CONTRACT_READ_STALE_TIME_MS,
  maxStaleAgeMs: number = DEFAULT_CONTRACT_READ_MAX_STALE_AGE_MS,
): ContractReadCacheState<T> {
  if (!entry) {
    return {
      hasCache: false,
      isFresh: false,
      isStale: false,
      canServeStaleContent: false,
      useStaleWhileRevalidating: false,
      value: null,
      ageMs: null,
    };
  }

  const ageMs = Math.max(0, now - entry.timestamp);
  const isFresh = ageMs <= staleTimeMs;
  const isStale = !isFresh;
  const canServeStaleContent = ageMs <= maxStaleAgeMs;

  return {
    hasCache: true,
    isFresh,
    isStale,
    canServeStaleContent,
    useStaleWhileRevalidating: isStale && canServeStaleContent,
    value: canServeStaleContent ? entry.value : null,
    ageMs,
  };
}

function resolveDefaultStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage ?? null;
}

/**
 * Generic cache for contract reads with stale-while-revalidate semantics and
 * single-flight coalescing.
 */
export class ContractReadCache {
  private readonly staleTimeMs: number;
  private readonly maxStaleAgeMs: number;
  private readonly namespace: string;
  private readonly now: Clock;
  private readonly storage: Storage | null;

  /** Fast in-memory layer; always the source of truth for this session. */
  private readonly memory = new Map<string, ContractReadCacheEntry<unknown>>();
  /** In-flight reads, keyed by cache key, so parallel callers share one call. */
  private readonly inflight = new Map<string, Promise<unknown>>();
  /** The most recent refresh error per key, exposed for diagnostics. */
  private readonly lastError = new Map<string, unknown>();

  constructor(options: ContractReadCacheOptions = {}) {
    this.staleTimeMs =
      options.staleTimeMs ?? DEFAULT_CONTRACT_READ_STALE_TIME_MS;
    this.maxStaleAgeMs =
      options.maxStaleAgeMs ?? DEFAULT_CONTRACT_READ_MAX_STALE_AGE_MS;
    this.namespace = options.namespace ?? DEFAULT_CONTRACT_READ_CACHE_NAMESPACE;
    this.now = options.now ?? (() => Date.now());
    this.storage =
      options.storage === undefined ? resolveDefaultStorage() : options.storage;
  }

  private readStore(): Record<string, SerializedEntry> {
    if (!this.storage) {
      return {};
    }
    try {
      const raw = this.storage.getItem(this.namespace);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw, jsonReviver) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, SerializedEntry>;
      }
      return {};
    } catch {
      // Corrupt or unavailable storage should never break a read.
      return {};
    }
  }

  private writeStore(store: Record<string, SerializedEntry>): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(this.namespace, JSON.stringify(store, jsonReplacer));
    } catch {
      // Ignore quota/serialization failures; the memory layer still works.
    }
  }

  /** Reads an entry from memory first, then from persistent storage. */
  read<T>(key: string): ContractReadCacheEntry<T> | null {
    const mem = this.memory.get(key);
    if (mem) {
      return mem as ContractReadCacheEntry<T>;
    }

    const persisted = this.readStore()[key];
    if (!persisted) {
      return null;
    }

    const entry: ContractReadCacheEntry<T> = {
      key: persisted.key ?? key,
      value: persisted.value as T,
      timestamp: persisted.timestamp,
    };
    this.memory.set(key, entry as ContractReadCacheEntry<unknown>);
    return entry;
  }

  /** Writes a value into both cache layers. */
  write<T>(key: string, value: T, timestamp: number = this.now()): void {
    const entry: ContractReadCacheEntry<T> = { key, value, timestamp };
    this.memory.set(key, entry as ContractReadCacheEntry<unknown>);

    if (this.storage) {
      const store = this.readStore();
      store[key] = { key, value, timestamp } satisfies SerializedEntry;
      this.writeStore(store);
    }
  }

  /** Freshness snapshot for a key (or a provided entry). */
  getState<T>(
    key: string,
    now: number = this.now(),
  ): ContractReadCacheState<T> {
    const entry = this.read<T>(key);
    return evaluateContractReadCacheEntry(
      entry,
      now,
      this.staleTimeMs,
      this.maxStaleAgeMs,
    );
  }

  /** The most recent refresh error for a key, if a fallback was served. */
  getLastError(key: string): unknown {
    return this.lastError.get(key);
  }

  /** Removes a single key from both layers. */
  invalidate(key: string): void {
    this.memory.delete(key);
    this.lastError.delete(key);
    if (this.storage) {
      const store = this.readStore();
      if (key in store) {
        delete store[key];
        this.writeStore(store);
      }
    }
  }

  /** Removes every key that starts with `prefix`. */
  invalidateByPrefix(prefix: string): void {
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
        this.lastError.delete(key);
      }
    }
    if (this.storage) {
      const store = this.readStore();
      let changed = false;
      for (const key of Object.keys(store)) {
        if (key.startsWith(prefix)) {
          delete store[key];
          changed = true;
        }
      }
      if (changed) {
        this.writeStore(store);
      }
    }
  }

  /** Empties the cache. */
  clear(): void {
    this.memory.clear();
    this.lastError.clear();
    this.writeStore({});
  }

  /** True while a read for `key` is in flight. */
  isInflight(key: string): boolean {
    return this.inflight.has(key);
  }

  /**
   * Returns a cached value or performs a read with stale-while-revalidate
   * semantics.
   *
   * - Fresh cache: resolves immediately without calling `fetcher`.
   * - Stale-but-servable cache: calls `fetcher`; if it fails, serves the stale
   *   value and records the error instead of throwing.
   * - No/expired cache: calls `fetcher` and propagates failures.
   * - Concurrent calls for the same key share a single `fetcher` invocation.
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { force?: boolean } = {},
  ): Promise<T> {
    const entry = this.read<T>(key);
    const state = evaluateContractReadCacheEntry(
      entry,
      this.now(),
      this.staleTimeMs,
      this.maxStaleAgeMs,
    );

    if (!options.force && state.isFresh && entry) {
      return entry.value;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // `promiseRef` lets the `finally` block clear the in-flight entry only if
    // it still points at this read, which keeps the map correct even if a
    // fetcher throws before the promise is registered.
    let promiseRef: Promise<T> | undefined;
    const promise = (async (): Promise<T> => {
      try {
        const value = await fetcher();
        this.write(key, value);
        this.lastError.delete(key);
        return value;
      } catch (error) {
        if (entry && state.canServeStaleContent) {
          this.lastError.set(key, error);
          return entry.value;
        }
        throw error;
      } finally {
        if (this.inflight.get(key) === promiseRef) {
          this.inflight.delete(key);
        }
      }
    })();

    promiseRef = promise;
    this.inflight.set(key, promise as Promise<unknown>);
    return promise;
  }
}

/** Shared cache instance used by the app. */
export const contractReadCache = new ContractReadCache();
