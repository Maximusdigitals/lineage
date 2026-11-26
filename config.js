// ─────────────────────────────────────────────────────────────
//  SITE CONFIG — the one place to rename / rebrand the site.
//  Change values here. Then run `node scripts/apply-config.mjs`
//  once so the static <title>/social-card tags match too.
// ─────────────────────────────────────────────────────────────
export const SITE = {
  name: "Vamp Hunter",                 // brand / wordmark
  mark: "VH",                          // two-letter monogram
  tagline: "Every coin has an original.",
  description:
    "Paste a Solana contract address. See if the coin is a likely vamp, which coin was there first, and the receipts.",
  url: "https://maximusdigitals.github.io/lineage/",
  assetVersion: "2",          // bump to cache-bust CSS/JS/images after a release

  // ── Future X page (leave blank until the account exists) ──
  xHandle: "VampHunterSOL",             // official X account, no @
  xFeedEmbed: false,                   // true → loads the X timeline embed into the feed slot

  // ── Optional backend hook ──
  // A tiny proxy (see /worker/pump-proxy.js) unlocks pump.fun search
  // and, later, X API narrative checks. Empty = DexScreener-only mode.
  backendUrl: "",

  // ── Data sources (public, keyless) ──
  rpcUrl: "https://solana-rpc.publicnode.com",
  ipfsGateway: "https://gateway.pinata.cloud/ipfs/",
  imageProxy: "https://wsrv.nl/?url=",  // adds CORS so images can be fingerprinted
};
