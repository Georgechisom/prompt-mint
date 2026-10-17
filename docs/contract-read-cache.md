# Contract read caching

## Summary

Read-only contract calls (listing reads, per-prompt access checks, promotions,
purchase details) now go through a shared caching layer,
[`src/lib/stellar/contractReadCache.ts`](../src/lib/stellar/contractReadCache.ts).
The layer is framework-agnostic so hooks, providers, and pages can all use the
same primitive.

## Behavior

- **Fresh cache** — a value read inside the stale window is served immediately
  and the network is not called.
- **Stale-while-revalidate** — a stale value still inside the maximum stale
  window is refreshed in the background; if the refresh fails, the last known
  value is served instead and the error is recorded.
- **Expired** — once the maximum stale age passes, the cached value is ignored
  and the read error is surfaced.
- **Single-flight** — concurrent reads for the same key share one in-flight
  request, so a page that mounts several components reading the same prompt
  only calls the contract once.
- **Persistence** — entries are kept in an in-memory map and, in the browser,
  mirrored to `localStorage` under `prompt-mint:contract-read-cache`. Values
  containing `bigint` (prompt ids, stroop amounts) round-trip losslessly.

## Configuration

| Option          | Default                                | Purpose                                       |
| --------------- | -------------------------------------- | --------------------------------------------- |
| `staleTimeMs`   | `30_000`                               | Window during which a value is served as-is.  |
| `maxStaleAgeMs` | `300_000`                              | Hard limit for serving a stale value.         |
| `namespace`     | `prompt-mint:contract-read-cache`      | Storage bucket.                               |
| `storage`       | `window.localStorage` (or `null`)      | Persistence backend; pass `null` for memory.  |
| `now`           | `() => Date.now()`                     | Clock injection for deterministic tests.      |

## Keys and invalidation

Keys are built with `buildContractReadCacheKey(contractId, method, args)`. The
argument serializer sorts object keys and tags `bigint` values, so
`{ id: 1n, owner: "G…" }` and `{ owner: "G…", id: 1n }` produce the same key.
Invalidate a single read with `invalidate(key)` or a whole read family with
`invalidateByPrefix(prefix)` — for example `contractReadCache.invalidateByPrefix("CABC::get_prompt")`.

## Authority and permissions

Caching only ever stores public read metadata. Wallet signatures, decrypted
content, and write transactions are never cached, and individual access checks
still run through the normal `hasAccess` path. Write transactions and observed
contract events invalidate the prompt queries and clear this read cache (see
`src/hooks/useContractSync.ts`).

## Compatibility

This change is backward compatible. The browse-specific
[marketplace read cache](./marketplace-read-caching.md) keeps its existing
storage key and behavior; it can be migrated to the shared primitive without a
user-visible change.
