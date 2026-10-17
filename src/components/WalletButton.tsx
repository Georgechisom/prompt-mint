import { useState, useEffect } from "react";
import { Button } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { shortenAddress } from "@/lib/utils";
import { Button as ShadcnButton } from "./ui/button";
import { Loader2, AlertCircle, LifeBuoy, X } from "lucide-react";
import { getSupportedWallets } from "@/util/wallet";
import { trackEvent } from "@/lib/analytics/track";
import { WalletErrorRecoveryModal } from "@/components/WalletErrorRecoveryModal";

const KNOWN_WALLETS: { id: string; name: string }[] = [
  { id: "freighter", name: "Freighter" },
  { id: "albedo", name: "Albedo" },
  { id: "xbull", name: "xBull" },
];

export const WalletButton = () => {
  const [showModal, setShowModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const { address, status, error, connect, disconnect, reconnect } = useWallet();
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [checkingWallets, setCheckingWallets] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<typeof KNOWN_WALLETS>(KNOWN_WALLETS);
  const [noWalletDetected, setNoWalletDetected] = useState(false);

  useEffect(() => {
    if (status !== "error") setDismissedError(null);
  }, [status]);

  const handleConnect = async (id: string) => {
    setShowModal(false);
    await connect(id);
  };

  const handleOpenModal = async () => {
    setNoWalletDetected(false);
    setCheckingWallets(true);
    try {
      const supported = await getSupportedWallets();
      const availableIds = new Set(
        supported.filter((w) => w.isAvailable).map((w) => w.id),
      );
      const available = KNOWN_WALLETS.filter((w) => availableIds.has(w.id));

      if (available.length === 0) {
        setNoWalletDetected(true);
        trackEvent("wallet_connect_failed", { reasonCode: "no_supported_wallet" });
        return;
      }

      setAvailableWallets(available);
      setShowModal(true);
    } catch (e) {
      // If detection itself fails, don't block connecting altogether -
      // fall back to showing every known wallet option.
      console.warn("Unable to detect supported wallets, showing all options.", e);
      setAvailableWallets(KNOWN_WALLETS);
      setShowModal(true);
    } finally {
      setCheckingWallets(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDisconnectModal(false);
  };

  return (
    <div className="relative flex flex-col items-center w-full">
      {status === "error" && error && dismissedError !== error && (
        <div className="absolute bottom-full right-0 mb-2 w-max max-w-xs bg-red-500 text-white text-xs pl-3 pr-2 py-2 rounded shadow-lg whitespace-normal z-50 flex items-start gap-1">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setShowRecovery(true)}
            className="opacity-90 hover:opacity-100 transition-opacity ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold underline underline-offset-2"
            aria-label="Open wallet error recovery and diagnostics"
          >
            <LifeBuoy className="w-3 h-3" />
            Recover
          </button>
          <button onClick={() => setDismissedError(error)} className="opacity-80 hover:opacity-100 transition-opacity ml-1 p-0.5" aria-label="Dismiss error">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {noWalletDetected && (
        <div className="absolute bottom-full right-0 mb-2 w-max max-w-xs bg-red-500 text-white text-xs pl-3 pr-2 py-2 rounded shadow-lg whitespace-normal z-50 flex items-start gap-1">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">No supported wallet extension detected. Install Freighter, Albedo, or xBull to continue.</span>
          <button onClick={() => setNoWalletDetected(false)} className="opacity-80 hover:opacity-100 transition-opacity ml-1 p-0.5" aria-label="Dismiss error">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <ShadcnButton
          variant={"default"} size={"sm"}
          className="ml-auto font-bold border-purple-900 text-white hover:text-purple-300 hover:border-purple-800 min-w-[120px]"
          onClick={() => void handleOpenModal()}
          disabled={checkingWallets}
        >
          {checkingWallets ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
              Checking Wallets...
            </>
          ) : (
            "Connect Wallet"
          )}
        </ShadcnButton>
      )}

      {status === "connecting" && (
        <ShadcnButton
          disabled
          variant={"default"} size={"sm"}
          className="ml-auto font-bold border-purple-900 text-white min-w-[120px] cursor-not-allowed opacity-70"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
          Opening Wallet...
        </ShadcnButton>
      )}

      {status === "reconnecting" && (
        <div className="ml-auto flex items-center space-x-2 text-sm text-slate-300 min-w-[120px] justify-center">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Restoring Session...</span>
        </div>
      )}

      {status === "disconnected" && (
        <ShadcnButton
          variant={"outline"} size={"sm"}
          className="ml-auto font-bold border-orange-600 text-orange-400 hover:text-orange-300 hover:border-orange-500 min-w-[120px]"
          onClick={() => void reconnect()}
        >
          Reconnect
        </ShadcnButton>
      )}

      {status === "connected" && address && (
        <ShadcnButton
          variant={"default"} size={"sm"}
          className="ml-auto font-bold border-purple-900 text-white hover:text-purple-300 hover:border-purple-800"
          onClick={() => setShowDisconnectModal((prev) => !prev)}
        >
          {shortenAddress(address)}
        </ShadcnButton>
      )}

      {showDisconnectModal && status === "connected" && (
        <div className="absolute mt-10 w-44 bg-[#070602] rounded-lg shadow-lg z-50 border border-white/10">
          <div>
            <Button size="md" variant="primary" onClick={handleDisconnect} className="w-full mx-auto p-2 text-white">
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {showModal && (status === "idle" || status === "error") && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-white">Select a Wallet</h3>
            <div className="flex flex-col space-y-3">
              {availableWallets.map((w) => (
                <ShadcnButton
                  key={w.id}
                  variant="outline"
                  onClick={() => void handleConnect(w.id)}
                  className="w-full justify-start border-white/10 text-white hover:bg-white/10 hover:text-white"
                >
                  {w.name}
                </ShadcnButton>
              ))}
            </div>
            <ShadcnButton variant="ghost" onClick={() => setShowModal(false)} className="mt-6 w-full text-slate-400 hover:text-white hover:bg-white/5">
              Cancel
            </ShadcnButton>
          </div>
        </div>
      )}

      <WalletErrorRecoveryModal
        open={showRecovery && status === "error"}
        error={error}
        onClose={() => setShowRecovery(false)}
        onRetry={() => {
          setShowRecovery(false);
          void reconnect();
        }}
        onDisconnect={() => {
          setShowRecovery(false);
          void disconnect();
        }}
      />
    </div>
  );
};
