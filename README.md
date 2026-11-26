# Vamp Hunter (working name)

Paste a Solana memecoin contract address → get a verdict (**Likely vamp of $X**, **Possible OG**, or **Unclear**), a confidence score, the likely original, a timeline and the receipts.

Live: https://maximusdigitals.github.io/lineage/

## Rename / rebrand
Everything lives in **`config.js`** (name, monogram, tagline, URL, X handle, backend URL).
After changing it, run `node scripts/apply-config.mjs` so the static `<title>` and social-card tags match, and re-shoot `assets/og.png` from `og.html` if the name changed.

## How a scan works
1. **Coin**: DexScreener `tokens/v1` (pairs, mcap, liquidity, volume, launch time) + Solana RPC (Token-2022 metadata or the Metaplex PDA) → IPFS metadata JSON (description, X, site, Telegram, image).
2. **Candidates**: DexScreener search on ticker, name, distinctive name words and one description keyword (Solana pairs only), plus pump.fun search when the backend hook is set.
3. **Signals**: ticker similarity, name similarity (fuzzy + word overlap), logo perceptual hash (dHash on a canvas, in the browser), narrative (TF-IDF cosine of descriptions), shared socials (X account / community / site / Telegram).
4. **Verdict**: earlier look-alikes are ranked by match × liquidity-backed traction × age. Confidence blends match strength, mcap ratio and launch gap. Wording is always "likely", with evidence.

## Data sources and limits
| Source | Status | Notes |
|---|---|---|
| DexScreener public API | used | CORS-open, ~300 req/min. Search returns max 30 pairs per query, so very crowded tickers can miss old dead copies. |
| Solana RPC (publicnode) | used | Metadata only. Holder counts need an indexed RPC/API key, so they aren't shown. |
| IPFS (Pinata gateway) | used | Metadata JSON + images. Some launchpads host metadata on CORS-blocked domains; those coins just lose the narrative signal. |
| wsrv.nl image proxy | used | Adds CORS headers so logos can be fingerprinted on a canvas. |
| pump.fun frontend API | **off by default** | Only answers requests from pump.fun itself (CORS). Deploy `worker/pump-proxy.js` (Cloudflare free tier) and set `backendUrl`. |
| X | links only | Oldest-first narrative links via `until:` search. `xNarrativeCheck()` in `js/engine.js` + `/x/earliest` in the worker are the hook for the X API. |

## Files
- `config.js`: the one place to rename
- `js/engine.js`: scan logic, scoring, verdict, live feed
- `js/solana.js`: on-chain metadata (Token-2022 + Metaplex PDA, no SDK)
- `js/imagehash.js`: in-browser logo fingerprinting
- `js/app.js`: UI
- `worker/pump-proxy.js`: optional backend (pump.fun + future X API)

Fonts: Zodiak and Switzer (Fontshare, ITF Free Font License), Geist Mono (OFL). Not financial advice.

## Brand
The fang-V emblem and banner live in `assets/brand/`. After renaming, re-shoot the social card from `og.html` (`assets/og.jpg`, 1200×630). Favicons and the Apple touch icon are generated from the emblem. Bump `assetVersion` in `config.js` and re-run `node scripts/apply-config.mjs` so browsers pick up the new files.
