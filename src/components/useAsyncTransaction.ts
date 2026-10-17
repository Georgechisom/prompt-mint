import { useState, useCallback, useRef } from "react";
import { useTransactionFeedback } from "./TransactionProvider";

interface StellarError {
  response?: {
    data?: {
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
    };
  };
  message?: string;
}

import { translateError } from "../lib/i18n-errors";

/**
 * Translates generic Stellar RPC/Horizon error codes into human-readable prompts.
 */
const translateStellarError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return translateError("unknown");

  const err = error as StellarError;
  const txCode = err.response?.data?.extras?.result_codes?.transaction;
  const opCodes = err.response?.data?.extras?.result_codes?.operations;

  if (txCode === "tx_bad_auth" || txCode === "tx_bad_auth_extra") {
    return "Transaction signing failed. Reconnect your wallet and try again — if this keeps happening, your wallet extension may need updating.";
  }
  if (txCode === "tx_insufficient_balance" || opCodes?.includes("op_underfunded")) {
    return translateError("insufficient funds");
  }
  if (opCodes?.includes("op_no_trust")) {
    return "This transaction needs a trustline for this asset. Add the trustline in your wallet, then try again.";
  }
  if (opCodes?.includes("op_not_authorized")) {
    return "Your account is not authorized to perform this operation. Make sure you're signed in with the correct wallet, or contact support if you believe this is a mistake.";
  }

  return err.message ? translateError(err.message) : translateError("unknown");
};

/**
 * Classifies errors for the wallet-mutation retry policy (#691).
 * Signing / authorization / user-rejection / balance errors are never
 * auto-retried because retrying them would force the user to re-sign or
 * would not resolve the underlying blocker. Transient network/RPC/timeout
 * failures are retryable.
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const neverRetry = [
    "tx_bad_auth",
    "tx_bad_auth_extra",
    "invalid_signature",
    "user rejected",
    "user denied",
    "signature is invalid",
    "reconnect your wallet",
    "wallet not connected",
    "insufficient",
    "underfunded",
    "wrong network",
    "not connected",
  ];
  if (neverRetry.some((token) => message.includes(token))) {
    return false;
  }
  const retryable = [
    "network",
    "connection",
    "timeout",
    "timed out",
    "rpc",
    "502",
    "503",
    "504",
  ];
  return retryable.some((token) => message.includes(token));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* eslint-disable no-unused-vars */
interface UseAsyncTransactionOptions<TData, TVariables> {
  onOptimistic?: (_variables: TVariables) => unknown;
  onRollback?: (_error: Error, _variables: TVariables, _rollbackData: unknown) => void;
  onSuccess?: (_data: TData, _variables: TVariables) => void;
  onError?: (_error: Error, _variables: TVariables) => void;
  onSettled?: (_variables: TVariables, _result?: TData, _error?: unknown) => void;
  pendingMessage?: string | ((_variables: TVariables) => string);
  successMessage?: string | ((_data: TData) => string);
  errorMessage?: string | ((_error: Error) => string);
  retry?: number;
  retryDelay?: number | ((_attemptIndex: number) => number);
}
/* eslint-enable no-unused-vars */

export function useAsyncTransaction<TData, TVariables = void>(
  // eslint-disable-next-line no-unused-vars
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseAsyncTransactionOptions<TData, TVariables>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const { addTransaction, updateTransaction, removeTransaction } = useTransactionFeedback();

  // Use refs to stabilize the execute function, preventing infinite loops
  // when options or mutationFn are passed inline.
  const mutationFnRef = useRef(mutationFn);
  const optionsRef = useRef(options);
  mutationFnRef.current = mutationFn;
  optionsRef.current = options;

  // #693: double-submit guard — tracks whether a transaction is in flight.
  const isExecutingRef = useRef(false);

  const execute = useCallback(
    async (variables: TVariables) => {
      // #693: reject concurrent submissions to prevent double purchases.
      if (isExecutingRef.current) {
        return Promise.reject(
          new Error("A transaction is already in progress. Please wait for it to complete.")
        );
      }

      const txId = Date.now().toString();
      const currentOptions = optionsRef.current;
      let settledData: TData | undefined;
      let settledError: Error | undefined;

      isExecutingRef.current = true;
      setIsLoading(true);
      setError(null);

      // #692: capture rollback data returned by the optimistic hook.
      const rollbackData = currentOptions?.onOptimistic?.(variables);

      addTransaction({
        id: txId,
        status: "pending",
        message: typeof currentOptions?.pendingMessage === 'function'
          ? currentOptions.pendingMessage(variables)
          : currentOptions?.pendingMessage || "Processing transaction...",
      });

      const maxRetries = typeof currentOptions?.retry === "number" ? currentOptions.retry : 0;
      const resolveRetryDelay = (attemptIndex: number): number => {
        const delay = currentOptions?.retryDelay;
        if (typeof delay === "function") {
          const value = delay(attemptIndex);
          return typeof value === "number" ? value : 1000;
        }
        if (typeof delay === "number") {
          return delay;
        }
        return 1000 * Math.pow(2, attemptIndex);
      };

      let attempt = 0;

      try {
        while (true) {
          try {
            const result = await mutationFnRef.current(variables);
            settledData = result;
            setData(result);

            const successMsg = typeof currentOptions?.successMessage === 'function'
              ? currentOptions.successMessage(result)
              : currentOptions?.successMessage || "Transaction successful!";

            updateTransaction(txId, { status: "success", message: successMsg });

            // Fire Query Invalidation Hook
            currentOptions?.onSuccess?.(result, variables);
            return result;
          } catch (err) {
            lastError = err;
            // #691: classify retryability on the ORIGINAL error message, before
            // translation converts retryable keywords into friendly copy.
            const originalMessage = err instanceof Error ? err.message : String(err);
            const shouldRetry = attempt < maxRetries && isRetryableError(new Error(originalMessage));
            if (!shouldRetry) {
              const translated = translateStellarError(err);
              const normalizedError = err instanceof Error ? err : new Error(translated);
              settledError = normalizedError;
              throw normalizedError;
            }

            attempt++;
            await sleep(resolveRetryDelay(attempt - 1));
          }
        }
      } catch (err) {
        const translated = translateStellarError(err);
        const normalizedError = err instanceof Error ? err : new Error(translated);
        settledError = normalizedError;

        let friendlyMessage = translated;
        if (currentOptions?.errorMessage) {
          friendlyMessage = typeof currentOptions.errorMessage === 'function'
            ? currentOptions.errorMessage(normalizedError)
            : currentOptions.errorMessage;
        }

        setError(normalizedError);

        // #692: rollback optimistic updates on failure.
        currentOptions?.onRollback?.(normalizedError, variables, rollbackData);

        // Inject the retry payload and map to the exact variables used
        updateTransaction(txId, {
          status: "error",
          message: friendlyMessage,
          retryAction: () => {
            removeTransaction(txId);
            execute(variables);
          },
        });

        currentOptions?.onError?.(normalizedError, variables);
        throw normalizedError;
      } finally {
        isExecutingRef.current = false;
        setIsLoading(false);
        currentOptions?.onSettled?.(variables, settledData, settledError);
      }
    },
    [addTransaction, updateTransaction, removeTransaction]
  );

  return { execute, isLoading, error, data };
}