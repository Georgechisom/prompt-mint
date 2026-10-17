import { useEffect, useState, type ChangeEvent } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_NETWORKS,
  getAppNetworkId,
  getNetworkDescriptor,
  getPreferredNetworkId,
  setPreferredNetworkId,
  subscribeToNetworkPreference,
  type StellarNetworkId,
} from "@/lib/stellar/networks";

export interface NetworkSelectorProps {
  className?: string;
  /** Controlled value. Omit to let the selector manage its own state. */
  value?: StellarNetworkId;
  /** Called with the newly selected network. */
  onChange?: (networkId: StellarNetworkId) => void;
}

/**
 * Footer network selector (#696).
 *
 * Lets visitors see every supported Stellar network and record a preference.
 * The app still signs against the network it was built for, so the active
 * network is highlighted separately from the selected preference.
 */
export function NetworkSelector({ className, value, onChange }: NetworkSelectorProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<StellarNetworkId>(() =>
    getPreferredNetworkId(),
  );
  const selected = isControlled ? value : internalValue;
  const appNetwork = getAppNetworkId();
  const selectedDescriptor = getNetworkDescriptor(selected);
  const isActive = selected === appNetwork;

  useEffect(() => {
    if (isControlled) {
      return;
    }
    return subscribeToNetworkPreference((networkId) => setInternalValue(networkId));
  }, [isControlled]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as StellarNetworkId;
    if (!isControlled) {
      setInternalValue(next);
    }
    setPreferredNetworkId(next);
    onChange?.(next);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <label
          htmlFor="network-selector"
          className="text-sm text-gray-400"
        >
          Network
        </label>
        <select
          id="network-selector"
          data-testid="network-selector"
          value={selected}
          onChange={handleChange}
          title="Choose your preferred Stellar network"
          className={cn(
            "rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-200",
            "focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500",
          )}
        >
          {SUPPORTED_NETWORKS.map((network) => (
            <option key={network.id} value={network.id}>
              {network.label}
              {network.id === appNetwork ? " (active)" : ""}
            </option>
          ))}
        </select>
        {isActive && (
          <span
            data-testid="network-selector-active"
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
          >
            Active
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {selectedDescriptor.label} · RPC {selectedDescriptor.rpcUrl}
      </p>
    </div>
  );
}
