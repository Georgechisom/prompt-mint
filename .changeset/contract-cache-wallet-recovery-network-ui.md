---
"prompt-hash-stellar": minor
---

Add frontend resilience and multi-network UI improvements (#689, #685, #696, #695).

- **Contract read caching layer (#689).** A shared, framework-agnostic cache (`src/lib/stellar/contractReadCache.ts`) with stale-while-revalidate, single-flight coalescing, prefix invalidation, and bigint-safe `localStorage` persistence for public contract reads.
- **Wallet error recovery modal (#685).** A recovery dialog (`src/components/WalletErrorRecoveryModal.tsx`) with plain-language guidance and a copyable, redacted diagnostic report (`src/lib/wallet/diagnostics.ts`), opened from the wallet button when a connection fails.
- **Footer network selector (#696).** An accessible dropdown (`src/components/NetworkSelector.tsx`) backed by a shared supported-networks catalog (`src/lib/stellar/networks.ts`) that persists a preferred network.
- **Multi-network support status page (#695).** A new `/status/networks` page and support matrix (`src/lib/stellar/networkSupport.ts`) describing each network's read/write/unlock/bundle support, linked from the footer and the service status page.
