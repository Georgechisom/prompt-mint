import { useContext, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, Unplug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { WalletContext } from "@/providers/WalletProvider";
import storage from "@/util/storage";
import {
  buildWalletDiagnostics,
  formatWalletDiagnostics,
} from "@/lib/wallet/diagnostics";

export interface WalletErrorRecoveryModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Close the modal without taking another action. */
  onClose: () => void;
  /** Error to explain. Falls back to the wallet context error. */
  error?: unknown;
  /** Wallet id to include in diagnostics. Falls back to the stored wallet id. */
  walletId?: string | null;
  /** Retry the wallet connection. Omit to hide the retry action. */
  onRetry?: () => void;
  /** Disconnect the wallet. Omit to hide the disconnect action. */
  onDisconnect?: () => void;
}

function readStoredWalletId(): string | null {
  try {
    return storage.getItem("walletId");
  } catch {
    return null;
  }
}

/**
 * Wallet error recovery modal (#685).
 *
 * Shown when a wallet connect/reconnect/sign flow fails. It explains the
 * failure in plain language, offers one-click recovery, and exposes a
 * copyable, redacted diagnostic report so support can help without the user
 * ever sharing a private key or full account address.
 */
export function WalletErrorRecoveryModal({
  open,
  onClose,
  error,
  walletId,
  onRetry,
  onDisconnect,
}: WalletErrorRecoveryModalProps) {
  const wallet = useContext(WalletContext);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const resolvedError = error ?? wallet?.error;
  const resolvedWalletId = walletId ?? readStoredWalletId();

  const report = useMemo(
    () =>
      buildWalletDiagnostics({
        error: resolvedError,
        walletId: resolvedWalletId,
        address: wallet?.address ?? null,
        status: wallet?.status ?? null,
        network: wallet?.network ?? null,
        networkPassphrase: wallet?.networkPassphrase ?? null,
        online:
          typeof navigator === "undefined" ? true : navigator.onLine,
      }),
    [
      resolvedError,
      resolvedWalletId,
      wallet?.address,
      wallet?.status,
      wallet?.network,
      wallet?.networkPassphrase,
    ],
  );

  const diagnosticText = useMemo(() => formatWalletDiagnostics(report), [report]);
  const guidance = report.guidance;

  // Close on Escape while open, and move focus into the dialog.
  useEffect(() => {
    if (!open) {
      return;
    }
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const message =
    report.error?.mappedMessage ?? "The wallet could not complete the last request.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-recovery-title"
      aria-describedby="wallet-recovery-desc"
      data-testid="wallet-error-recovery-modal"
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
            <ShieldAlert className="h-6 w-6 text-rose-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="wallet-recovery-title" className="text-lg font-bold text-white">
              {guidance?.title ?? "Wallet connection problem"}
            </h2>
            <p id="wallet-recovery-desc" className="mt-1 text-sm text-slate-400">
              {message}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close wallet recovery"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {guidance && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Try these steps
            </p>
            <ol className="mt-2 space-y-1.5 pl-4 text-sm text-slate-300">
              {guidance.steps.map((step, index) => (
                <li key={index} className="list-decimal">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Diagnostics
            </p>
            <CopyButton
              value={diagnosticText}
              label="wallet diagnostics"
              variant="icon-text"
            />
          </div>
          <pre
            data-testid="wallet-diagnostics-output"
            className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-300"
          >
            {diagnosticText}
          </pre>
          <p className="mt-2 text-[11px] text-slate-500">
            Account addresses are redacted. No private keys or signatures are included.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onDisconnect && (
            <Button
              variant="ghost"
              onClick={onDisconnect}
              className="text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/10"
          >
            Close
          </Button>
          {onRetry && (
            <Button
              onClick={onRetry}
              className="bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-600"
            >
              <RefreshCw className="h-4 w-4" />
              Retry connection
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
