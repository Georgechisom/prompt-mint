# Multi-network support status page

## Summary

`/status/networks`
([`src/pages/status/networks.tsx`](../src/pages/status/networks.tsx)) shows which
Stellar networks this build supports and to what degree. It complements the
existing [service status page](../src/pages/status/page.tsx), which reports live
RPC/Horizon/unlock health, and links to it from the footer under **Network
Status**.

## Support matrix

The matrix is defined as pure data in
[`src/lib/stellar/networkSupport.ts`](../src/lib/stellar/networkSupport.ts) so
it can be rendered and tested without network access. Each network is rated
`supported`, `beta`, or `unsupported` across four features:

| Feature            | Description                                     |
| ------------------ | ----------------------------------------------- |
| Contract reads     | Browse listings, promotions, access checks.     |
| Purchases & writes | List, buy, update prices, transfer licenses.    |
| Prompt unlock      | Decrypt purchased prompt content.               |
| Bundles            | Create and purchase prompt bundles.             |

Networks: **Mainnet** and **Testnet** are fully supported; **Futurenet** is a
preview network (reads/writes in beta, unlock and bundles unsupported); **Local
/ Standalone** supports reads, writes, and bundles but not unlock.

## Page contents

- The active build network and a live connection indicator
  (`useNetworkState`: healthy / degraded / unavailable).
- Summary counts for fully-supported, partial/beta, and unsupported networks.
- One card per network with a per-feature badge, an explorer link, a faucet
  link where one exists, and the RPC/Horizon endpoints.
- The shared [footer network selector](./network-selector.md).

## Notes

Support levels describe **this app build**, not the Stellar network itself. The
page is read-only and issues no wallet or contract calls, so it is safe to view
while offline or before connecting a wallet.

## Compatibility

This is a new route and does not change existing status or wallet flows.
