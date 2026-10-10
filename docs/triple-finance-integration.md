# TRIPLE MARKET: Bitget balance response parser (read-only)

## Situation — 2026-10-10

Production `/api/wallet-live` successfully reports Funding (0 USDC) and UTA (78.2362 USDC), while `/api/finance?resource=overview` responds with the local application code `BITGET_INVALID_RESPONSE`. This is **not** an official Bitget exchange code.

Production modules `api/finance.js`, `lib/finance/bitget.js`, and `lib/finance/service.js` are missing from the linked GitHub `main`. This PR adds an isolated, pure parser and tests. **It does not itself repair the running application, re-enable transfers, or deploy to production.**

## Bitget v3 response formats

- `GET /api/v3/account/funding-assets`: `{code:'00000',data:[{coin,available,balance,...}]}`
- `GET /api/v3/account/assets`: `{code:'00000',data:{assets:[{coin,available,balance,...}]}}`

Only a successful, well-formed empty asset list represents zero USDC. An invalid response or exchange error must never silently become zero.

## How to integrate after syncing deployed sources

1. Import the verified, latest Vercel production source on a separate branch.
2. Use `parseAvailableUSDC` on each read-only balance request, or `readBothBalances` to keep independent account read outcomes.
3. Separate failures to fetch network/coin metadata from balance parsing and show the precise failing endpoint and Bitget response code, without logging credentials.
4. Do not change authorization gates, withdrawal/transfer readiness checks, confirmations or ownership controls.
5. Mock all transfer/withdrawal calls in tests. Confirm read-only balances in production only after source synchronization and peer-reviewed integration.

## Test

Run `node --test test/balance-response.test.js`. The test suite requires no external dependencies, network connectivity or API credentials.

Sources: https://www.bitget.com/docs/classic/uta-api-upgrade-guide ; https://www.bitget.com/legacy-docs/uta/account/Get-Account
