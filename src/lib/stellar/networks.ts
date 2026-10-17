import { stellarNetwork } from "@/lib/env";

/**
 * Supported Stellar networks catalog (#696, #695).
 *
 * The app is built for one network at a time (see `PUBLIC_STELLAR_NETWORK`),
 * but users still need to see which networks exist, where they point, and be
 * able to express a preference. This module is the single source of truth for
 * that catalog, shared by the footer network selector and the multi-network
 * status page.
 */

export type StellarNetworkId = "PUBLIC" | "TESTNET" | "FUTURENET" | "LOCAL";

export interface StellarNetworkDescriptor {
  id: StellarNetworkId;
  /** Display label, e.g. "Stellar Mainnet". */
  label: string;
  /** Compact label for tight UI, e.g. "Mainnet". */
  shortLabel: string;
  /** Network passphrase used when signing transactions. */
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  explorerUrl: string;
  /** Friendbot faucet, only meaningful on test networks. */
  faucetUrl: string | null;
}

export const SUPPORTED_NETWORKS: readonly StellarNetworkDescriptor[] = [
  {
    id: "PUBLIC",
    label: "Stellar Mainnet",
    shortLabel: "Mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-mainnet.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/public",
    faucetUrl: null,
  },
  {
    id: "TESTNET",
    label: "Stellar Testnet",
    shortLabel: "Testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/testnet",
    faucetUrl: "https://friendbot.stellar.org",
  },
  {
    id: "FUTURENET",
    label: "Stellar Futurenet",
    shortLabel: "Futurenet",
    passphrase: "Test SDF Future Network ; October 2022",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/futurenet",
    faucetUrl: "https://friendbot-futurenet.stellar.org",
  },
  {
    id: "LOCAL",
    label: "Local / Standalone",
    shortLabel: "Local",
    passphrase: "Standalone Network ; February 2017",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000",
    explorerUrl: "https://stellar.expert/explorer/testnet",
    faucetUrl: null,
  },
] as const;

export const DEFAULT_NETWORK_ID: StellarNetworkId = "TESTNET";
export const NETWORK_PREFERENCE_STORAGE_KEY = "prompt-mint:preferred-network";

export type NetworkPreferenceListener = (networkId: StellarNetworkId) => void;

const listeners = new Set<NetworkPreferenceListener>();

/** Type guard for values coming from storage or user input. */
export function isSupportedNetworkId(value: unknown): value is StellarNetworkId {
  return (
    typeof value === "string" &&
    SUPPORTED_NETWORKS.some((network) => network.id === value)
  );
}

/**
 * Normalizes a loose network string (env value, wallet report) to a supported
 * id. `STANDALONE` is treated as `LOCAL`, matching `src/lib/env.ts`.
 */
export function normalizeNetworkId(value?: string | null): StellarNetworkId | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "STANDALONE") {
    return "LOCAL";
  }
  return isSupportedNetworkId(normalized) ? normalized : null;
}

export function getNetworkDescriptor(
  id: StellarNetworkId,
): StellarNetworkDescriptor {
  return (
    SUPPORTED_NETWORKS.find((network) => network.id === id) ??
    SUPPORTED_NETWORKS[1]
  );
}

/** The network this build is actually configured for. */
export function getAppNetworkId(): StellarNetworkId {
  return normalizeNetworkId(stellarNetwork) ?? DEFAULT_NETWORK_ID;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Reads the stored preference, falling back to the active app network. */
export function getPreferredNetworkId(
  fallback: StellarNetworkId = getAppNetworkId(),
): StellarNetworkId {
  const storage = safeStorage();
  if (!storage) {
    return fallback;
  }
  try {
    const stored = storage.getItem(NETWORK_PREFERENCE_STORAGE_KEY);
    return isSupportedNetworkId(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** Persists a preference and notifies local subscribers. */
export function setPreferredNetworkId(id: StellarNetworkId): void {
  if (!isSupportedNetworkId(id)) {
    return;
  }
  const storage = safeStorage();
  try {
    storage?.setItem(NETWORK_PREFERENCE_STORAGE_KEY, id);
  } catch {
    // Preference persistence is best-effort.
  }
  listeners.forEach((listener) => listener(id));
}

/** Subscribe to preference changes (e.g. to sync two selectors). */
export function subscribeToNetworkPreference(
  listener: NetworkPreferenceListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
