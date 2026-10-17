import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAsyncTransaction } from "@/components/useAsyncTransaction";
import { TransactionProvider } from "@/components/TransactionProvider";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransactionProvider>{children}</TransactionProvider>
    </QueryClientProvider>
  );
};

describe("useAsyncTransaction (#691, #692, #693)", () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it("retries transient network failures up to `retry` times (#691)", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("RPC connection timed out");
    });
    const { result } = renderHook(
      () => useAsyncTransaction(mutationFn, { retry: 2, retryDelay: 1 }),
      { wrapper }
    );
    await act(async () => {
      await expect(result.current.execute("x")).rejects.toThrow("RPC connection timed out");
    });
    expect(mutationFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry signing / authorization failures (#691)", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("tx_bad_auth");
    });
    const { result } = renderHook(
      () => useAsyncTransaction(mutationFn, { retry: 3, retryDelay: 1 }),
      { wrapper }
    );
    await act(async () => {
      await expect(result.current.execute("x")).rejects.toThrow("tx_bad_auth");
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("does not retry user rejection (#691)", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("User rejected the transaction");
    });
    const { result } = renderHook(
      () => useAsyncTransaction(mutationFn, { retry: 3, retryDelay: 1 }),
      { wrapper }
    );
    await act(async () => {
      await expect(result.current.execute("x")).rejects.toThrow();
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("does not retry insufficient balance (#691)", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("insufficient funds");
    });
    const { result } = renderHook(
      () => useAsyncTransaction(mutationFn, { retry: 3, retryDelay: 1 }),
      { wrapper }
    );
    await act(async () => {
      await expect(result.current.execute("x")).rejects.toThrow();
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("succeeds after retries when a transient failure recovers (#691)", async () => {
    let calls = 0;
    const mutationFn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("network error");
      return "ok";
    });
    const { result } = renderHook(
      () => useAsyncTransaction(mutationFn, { retry: 3, retryDelay: 1 }),
      { wrapper }
    );
    let data: unknown;
    await act(async () => {
      data = await result.current.execute("x");
    });
    expect(data).toBe("ok");
    expect(mutationFn).toHaveBeenCalledTimes(3);
  });

  it("#693: double-submit guard rejects concurrent executions", async () => {
    const mutationFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return "done";
    });
    const { result } = renderHook(() => useAsyncTransaction(mutationFn, {}), { wrapper });
    const p1 = result.current.execute("x");
    const p2 = result.current.execute("x");
    await act(async () => {
      await expect(p1).resolves.toBe("done");
    });
    await expect(p2).rejects.toThrow("already in progress");
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("#692: rolls back optimistic state on failure", async () => {
    const onRollback = vi.fn();
    const mutationFn = vi.fn(async () => {
      throw new Error("network error");
    });
    const onOptimistic = vi.fn(() => () => "rollback-snapshot");
    const { result } = renderHook(
      () => useAsyncTransaction(mutationFn, { retry: 0, onOptimistic, onRollback }),
      { wrapper }
    );
    await act(async () => {
      await expect(result.current.execute("x")).rejects.toThrow("network error");
    });
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledWith(expect.any(Error), "x", "rollback-snapshot");
  });
});
