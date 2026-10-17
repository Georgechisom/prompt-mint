import { SUPPORTED_NETWORKS, type StellarNetworkId } from "./networks";

/**
 * Multi-network support matrix (#695).
 *
 * The marketplace supports several Stellar networks to different degrees — a
 * network may be fine for read-only browsing but not for unlocks, or reserved
 * for previewing upcoming protocol changes. This module defines that matrix as
 * pure data so both the status page and tests can reason about it without
 * hitting the network.
 */

export type SupportLevel = "supported" | "beta" | "unsupported";

export type NetworkSupportFeature = "reads" | "writes" | "unlock" | "bundles";

export interface NetworkSupportFeatureDescriptor {
  key: NetworkSupportFeature;
  label: string;
  description: string;
}

export const SUPPORT_FEATURES: readonly NetworkSupportFeatureDescriptor[] = [
  {
    key: "reads",
    label: "Contract reads",
    description: "Browse listings, promotions, and access checks.",
  },
  {
    key: "writes",
    label: "Purchases & writes",
    description: "List, buy, update prices, and transfer licenses.",
  },
  {
    key: "unlock",
    label: "Prompt unlock",
    description: "Decrypt purchased prompt content.",
  },
  {
    key: "bundles",
    label: "Bundles",
    description: "Create and purchase prompt bundles.",
  },
] as const;

export interface NetworkSupportEntry {
  networkId: StellarNetworkId;
  label: string;
  reads: SupportLevel;
  writes: SupportLevel;
  unlock: SupportLevel;
  bundles: SupportLevel;
  notes: string;
}

export const NETWORK_SUPPORT_MATRIX: readonly NetworkSupportEntry[] = [
  {
    networkId: "PUBLIC",
    label: "Stellar Mainnet",
    reads: "supported",
    writes: "supported",
    unlock: "supported",
    bundles: "supported",
    notes: "Production marketplace with real XLM.",
  },
  {
    networkId: "TESTNET",
    label: "Stellar Testnet",
    reads: "supported",
    writes: "supported",
    unlock: "supported",
    bundles: "supported",
    notes: "Primary development network. Friendbot available for funding.",
  },
  {
    networkId: "FUTURENET",
    label: "Stellar Futurenet",
    reads: "beta",
    writes: "beta",
    unlock: "unsupported",
    bundles: "unsupported",
    notes: "Preview network for upcoming protocol changes. Not for real value.",
  },
  {
    networkId: "LOCAL",
    label: "Local / Standalone",
    reads: "supported",
    writes: "supported",
    unlock: "unsupported",
    bundles: "supported",
    notes: "Standalone network for local development only.",
  },
] as const;

export interface NetworkSupportSummary {
  total: number;
  fullySupported: number;
  partial: number;
  unsupported: number;
}

export function getNetworkSupportEntry(
  networkId: StellarNetworkId,
): NetworkSupportEntry | null {
  return NETWORK_SUPPORT_MATRIX.find((entry) => entry.networkId === networkId) ?? null;
}

export function isFeatureSupported(
  entry: NetworkSupportEntry,
  feature: NetworkSupportFeature,
): boolean {
  return entry[feature] === "supported";
}

/** Human-readable label for a support level. */
export function supportLevelLabel(level: SupportLevel): string {
  switch (level) {
    case "supported":
      return "Supported";
    case "beta":
      return "Beta";
    default:
      return "Not supported";
  }
}

/**
 * Counts how many networks are fully supported versus partial (some support
 * levels are `beta`) or blocked entirely (all features unsupported).
 */
export function summarizeNetworkSupport(
  entries: readonly NetworkSupportEntry[] = NETWORK_SUPPORT_MATRIX,
): NetworkSupportSummary {
  let fullySupported = 0;
  let partial = 0;
  let unsupported = 0;

  for (const entry of entries) {
    const levels = SUPPORT_FEATURES.map((feature) => entry[feature.key]);
    if (levels.every((level) => level === "supported")) {
      fullySupported += 1;
    } else if (levels.every((level) => level === "unsupported")) {
      unsupported += 1;
    } else {
      partial += 1;
    }
  }

  return {
    total: entries.length,
    fullySupported,
    partial,
    unsupported,
  };
}

/** Networks that are missing a support entry, for defensive rendering. */
export function listNetworksMissingSupport(
  entries: readonly NetworkSupportEntry[] = NETWORK_SUPPORT_MATRIX,
): StellarNetworkId[] {
  const covered = new Set(entries.map((entry) => entry.networkId));
  return SUPPORTED_NETWORKS.map((network) => network.id).filter(
    (id) => !covered.has(id),
  );
}
