// ─────────────────────────────────────────────────────────────
//  The hunt. Pure logic + public data fetchers.
//  scan(ca, { hashImage, onStep }) → report
// ─────────────────────────────────────────────────────────────
import { SITE } from "../config.js";
import { fetchOnchainMeta, ipfsRewrite } from "./solana.js";

const DS = "https://api.dexscreener.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const isSolAddress = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((s || "").trim());

async function getJSON(url, { timeout = 12000, retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (r.status === 429) { lastErr = new Error("rate-limited"); await sleep(1500 * (i + 1)); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { lastErr = e; if (i < retries) await sleep(600 * (i + 1)); }
    finally { clearTimeout(t); }
  }
  throw lastErr;
}

// ── text utils ───────────────────────────────────────────────
const STOP = new Set(("the a an and or of to in on for with is are be this that it its at by from as we our you your i my me " +
  "coin token tokens solana sol pump fun pumpfun memecoin meme memes community ca contract crypto official first only " +
  "will just get all new now not but can has have was were been more most very join us go lets let up moon").split(" "));
export const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/^\$/, "").replace(/[^\p{L}\p{N}]+/gu, "");
const words = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const levRatio = (a, b) => (!a || !b ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length));

export function tickerSim(x, y) {
  const a = norm(x), b = norm(y);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  if (s.length >= 3 && l.includes(s)) return 0.72 + 0.18 * (s.length / l.length);
  return Math.pow(levRatio(a, b), 1.6);
}
export function nameSim(x, y) {
  const a = norm(x), b = norm(y);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wa = new Set(words(x)), wb = new Set(words(y));
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const jac = inter / (new Set([...wa, ...wb]).size || 1);
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  const contain = s.length >= 4 && l.includes(s) ? 0.7 + 0.25 * (s.length / l.length) : 0;
  return Math.max(jac, Math.pow(levRatio(a, b), 1.4), contain);
}

function tfidfVectors(docs) {
  const toks = docs.map((d) => words(d).filter((w) => w.length > 2 && !STOP.has(w)));
  const df = new Map();
  toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const N = docs.length;
  return toks.map((t) => {
    const tf = new Map();
    t.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    const v = new Map();
    tf.forEach((c, w) => v.set(w, (c / t.length) * (Math.log((N + 1) / (df.get(w) + 0.5)) + 1)));
    return v;
  });
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  a.forEach((x, w) => { na += x * x; if (b.has(w)) dot += x * b.get(w); });
  b.forEach((x) => (nb += x * x));
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
const sharedTerms = (a, b) => [...a.keys()].filter((w) => b.has(w)).sort((x, y) => b.get(y) * a.get(y) - b.get(x) * a.get(x)).slice(0, 5);

// ── socials ──────────────────────────────────────────────────
const GENERIC = new Set(["elonmusk", "pumpdotfun", "dexscreener", "solana", "realdonaldtrump", "home", "search", "intent", "x", "twitter", "pump.fun", "dexscreener.com", "x.com", "twitter.com", "t.me", "linktr.ee", "youtube.com", "tiktok.com", "instagram.com", "google.com"]);
function socialKeys(t) {
  const keys = new Set();
  const add = (u) => {
    if (!u) return;
    try {
      const url = new URL(u.startsWith("http") ? u : "https://" + u);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const seg = url.pathname.split("/").filter(Boolean);
      if (host === "x.com" || host === "twitter.com") {
        if (seg[0] === "i" && seg[1] === "communities" && seg[2]) keys.add("x-community:" + seg[2]);
        else if (seg[0] && !GENERIC.has(seg[0].toLowerCase())) keys.add("x:@" + seg[0].toLowerCase());
        if (seg[1] === "status" && seg[2]) keys.add("x-post:" + seg[2]);
      } else if (host === "t.me" || host === "telegram.me") {
        if (seg[0]) keys.add("tg:" + seg[0].toLowerCase());
      } else if (!GENERIC.has(host) && !/pump\.fun$|dexscreener|ipfs|pinata|github\.io$/.test(host)) {
        keys.add("web:" + host + (seg.length && /linktr|carrd|bio\.link/.test(host) ? "/" + seg[0] : ""));
      }
    } catch {}
  };
  (t.socials || []).forEach((s) => add(s.url));
  (t.websites || []).forEach((w) => add(w.url));
  [t.meta?.twitter, t.meta?.website, t.meta?.telegram].forEach(add);
  return keys;
}
const prettySocial = (k) => k.replace(/^x:/, "X ").replace(/^x-community:/, "X community #").replace(/^x-post:/, "X post ").replace(/^tg:/, "Telegram t.me/").replace(/^web:/, "website ");

// ── DexScreener → token records ──────────────────────────────
function aggregate(pairs, map = new Map()) {
  for (const p of pairs || []) {
    if (p.chainId !== "solana" || !p.baseToken) continue;
    const a = p.baseToken.address;
    let t = map.get(a);
    if (!t) {
      t = { address: a, name: (p.baseToken.name || "").trim(), symbol: (p.baseToken.symbol || "").trim(), createdAt: Infinity, liquidity: -1, volume24: 0, mcap: 0, image: null, socials: [], websites: [], pairs: 0, source: "dexscreener" };
      map.set(a, t);
    }
    if (t._seen?.has(p.pairAddress)) continue;
    (t._seen ||= new Set()).add(p.pairAddress);
    t.pairs++;
    if (p.pairCreatedAt && p.pairCreatedAt < t.createdAt) { t.createdAt = p.pairCreatedAt; t.launchDex = p.dexId; }
    const liq = p.liquidity?.usd || 0;
    t.volume24 += p.volume?.h24 || 0;
    if (liq > t.liquidity) {
      Object.assign(t, { liquidity: liq, mcap: p.marketCap || p.fdv || 0, url: p.url, priceUsd: p.priceUsd, change24: p.priceChange?.h24, txns24: p.txns?.h24, dexId: p.dexId });
    }
    if (p.info) {
      t.image ||= p.info.imageUrl || null;
      t.header ||= p.info.header || null;
      if (p.info.socials?.length && !t.socials.length) t.socials = p.info.socials;
      if (p.info.websites?.length && !t.websites.length) t.websites = p.info.websites;
    }
  }
  return map;
}
const clean = (t) => { if (t) { delete t._seen; if (t.liquidity < 0) t.liquidity = 0; if (t.createdAt === Infinity) t.createdAt = null; } return t; };

// ── optional backend (pump.fun search / X API) ───────────────
async function pumpSearch(q) {
  if (!SITE.backendUrl) return { status: "off", tokens: [] };
  try {
    const list = await getJSON(`${SITE.backendUrl.replace(/\/$/, "")}/pump/search?q=${encodeURIComponent(q)}`, { retries: 0, timeout: 8000 });
    return {
      status: "ok",
      tokens: (list || []).map((c) => ({
        address: c.mint, name: c.name, symbol: c.symbol, createdAt: c.created_timestamp, mcap: c.usd_market_cap || 0,
        liquidity: 0, volume24: 0, image: ipfsRewrite(c.image_uri), socials: c.twitter ? [{ url: c.twitter }] : [],
        websites: c.website ? [{ url: c.website }] : [], meta: { description: c.description, twitter: c.twitter, website: c.website, telegram: c.telegram },
        source: "pump.fun", url: `https://pump.fun/coin/${c.mint}`,
      })),
    };
  } catch { return { status: "error", tokens: [] }; }
}

/** Hook for a future backend + X API: earliest posts about a narrative. */
export async function xNarrativeCheck({ name, symbol, before }) {
  if (!SITE.backendUrl) return null; // no key client-side; front-end falls back to X search links
  try {
    return await getJSON(`${SITE.backendUrl.replace(/\/$/, "")}/x/earliest?q=${encodeURIComponent(`"${name}" OR $${symbol}`)}&until=${before || ""}`, { retries: 0 });
  } catch { return null; }
}

export function xSearchUrl(q, untilMs) {
  const until = untilMs ? ` until:${new Date(untilMs + 86400000).toISOString().slice(0, 10)}` : "";
  return `https://x.com/search?q=${encodeURIComponent(q + until)}&src=typed_query&f=live`;
}

// ── queries ──────────────────────────────────────────────────
function buildQueries(t) {
  const qs = [];
  const push = (q) => { q = (q || "").trim(); if (q.length >= 2 && !qs.some((x) => x.toLowerCase() === q.toLowerCase())) qs.push(q); };
  push(t.symbol?.replace(/^\$/, ""));
  push(t.name);
  const nameWords = words(t.name).filter((w) => w.length >= 3 && !STOP.has(w));
  nameWords.sort((a, b) => b.length - a.length).slice(0, 2).forEach(push);
  if (t.meta?.description) {
    const dw = words(t.meta.description).filter((w) => w.length >= 5 && !STOP.has(w));
    const freq = new Map(); dw.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
    [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 1).forEach(([w]) => push(w));
  }
  return qs.slice(0, 6);
}

// market cap only counts as far as real liquidity / volume backs it up
const traction = (t) => {
  const liq = t.liquidity || 0, vol = t.volume24 || 0, mc = t.mcap || 0;
  if (t.source === "pump.fun") return Math.max(mc, 1);
  return Math.max(liq * 3, Math.min(mc, liq * 40 + vol * 3), 1);
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function fmtGap(ms) {
  const m = Math.abs(ms) / 60000;
  if (m < 1) return "<1m";
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60; if (h < 48) return `${Math.round(h)}h`;
  const d = h / 24; if (d < 60) return `${Math.round(d)}d`;
  const mo = d / 30.44; if (mo < 18) return `${Math.round(mo)}mo`;
  return `${(d / 365.25).toFixed(1)}y`;
}
export function fmtUsd(n) {
  if (!n) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

const budget = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

const W = { ticker: 0.22, name: 0.22, image: 0.26, narrative: 0.18, socials: 0.12 };

// ── main ─────────────────────────────────────────────────────
export async function scan(ca, { hashImage, onStep = () => {} } = {}) {
  ca = (ca || "").trim();
  if (!isSolAddress(ca)) throw new Error("That doesn't look like a Solana address.");
  const sources = { dexscreener: "ok", pumpfun: SITE.backendUrl ? "pending" : "off", rpc: "pending", images: 0 };
  const t0 = Date.now();

  onStep("fetch", "Pulling the coin");
  const [pairs, metaMap] = await Promise.all([
    getJSON(`${DS}/tokens/v1/solana/${ca}`).catch(() => { sources.dexscreener = "error"; return []; }),
    fetchOnchainMeta([ca]).catch(() => new Map()),
  ]);
  let target = clean(aggregate(pairs).get(ca));
  const meta = metaMap.get(ca);
  sources.rpc = meta ? "ok" : "error";
  if (!target && !meta) throw new Error("No trading pairs or on-chain metadata found for this address. Is it a Solana token mint?");
  target ||= { address: ca, name: meta.name, symbol: meta.symbol, createdAt: null, liquidity: 0, mcap: 0, volume24: 0, socials: [], websites: [], source: "rpc" };
  target.meta = meta || null;
  if (!target.image && meta?.image) target.image = meta.image;
  if (meta?.name && !target.name) target.name = meta.name;

  onStep("search", `Searching for look-alikes of $${target.symbol}`);
  const queries = buildQueries(target);
  const results = await pool(queries, 3, (q) => getJSON(`${DS}/latest/dex/search?q=${encodeURIComponent(q)}`, { retries: 1 }).catch(() => ({ pairs: [] })));
  const map = new Map();
  results.forEach((r) => aggregate(r.pairs, map));
  const pump = await Promise.all(queries.slice(0, 2).map(pumpSearch));
  if (SITE.backendUrl) sources.pumpfun = pump.some((p) => p.status === "ok") ? "ok" : "error";
  pump.forEach((p) => p.tokens.forEach((tok) => { if (!map.has(tok.address)) map.set(tok.address, tok); }));
  map.delete(ca);
  let cands = [...map.values()].map(clean).filter((c) => c.createdAt);

  // first pass: text
  cands.forEach((c) => {
    c.sig = { ticker: tickerSim(target.symbol, c.symbol), name: nameSim(target.name, c.name) };
    c.text = Math.max(c.sig.ticker, c.sig.name);
  });
  cands = cands.filter((c) => c.text >= 0.45).sort((a, b) => b.text - a.text || traction(b) - traction(a)).slice(0, 18);

  // enrich: on-chain metadata for the strongest few (descriptions + socials)
  onStep("meta", "Reading descriptions and socials");
  const enrich = cands.filter((c) => !c.meta).slice(0, 10).map((c) => c.address);
  const cm = await budget(fetchOnchainMeta(enrich).catch(() => new Map()), 7000, new Map());
  cands.forEach((c) => { const m = cm.get(c.address); if (m) { c.meta = m; if (!c.image && m.image) c.image = m.image; } });

  // images
  onStep("images", "Fingerprinting logos");
  let tHash = null;
  if (hashImage && target.image) tHash = await budget(hashImage(target.image).catch(() => null), 7000, null);
  if (tHash) sources.images++;
  if (hashImage && tHash) {
    await budget(pool(cands.filter((c) => c.image), 8, async (c) => {
      const h = await hashImage(c.image).catch(() => null);
      if (h) { sources.images++; c._hash = h; }
    }), 7000);
  }

  // narrative
  onStep("narrative", "Comparing narratives");
  const docT = [target.name, target.meta?.description].filter(Boolean).join(". ");
  const withDesc = cands.filter((c) => c.meta?.description);
  const vecs = tfidfVectors([docT, ...withDesc.map((c) => `${c.name}. ${c.meta.description}`)]);
  const hasTDesc = !!target.meta?.description;
  withDesc.forEach((c, i) => {
    if (!hasTDesc) return;
    c.sig.narrative = clamp(cosine(vecs[0], vecs[i + 1]) * 1.25);
    c._terms = sharedTerms(vecs[0], vecs[i + 1]);
  });

  const tKeys = socialKeys(target);
  for (const c of cands) {
    if (tHash && c._hash) {
      c.hamming = hamming(tHash, c._hash);
      c.sig.image = clamp((30 - c.hamming) / 24);
    }
    const shared = [...socialKeys(c)].filter((k) => tKeys.has(k));
    if (shared.length) { c.sig.socials = 1; c.sharedSocials = shared.map(prettySocial); }
    let num = 0, den = 0;
    for (const [k, w] of Object.entries(W)) if (c.sig[k] != null) { num += w * c.sig[k]; den += w; }
    c.match = den ? num / den : 0;
    if ((c.sig.image ?? 0) >= 0.9 && c.sig.ticker >= 0.9) c.match = Math.max(c.match, 0.92);
    if (c.sig.ticker === 1 && c.sig.name >= 0.9) c.match = Math.max(c.match, 0.85);
    c.gap = target.createdAt && c.createdAt ? target.createdAt - c.createdAt : null;
    c.ratio = traction(c) / traction(target);
    c.mcapRatio = (c.mcap || c.liquidity || 1) / (target.mcap || target.liquidity || 1);
    c.tractionNorm = clamp((Math.log10(traction(c)) - 3) / 5);
    delete c._hash;
  }
  cands.sort((a, b) => b.match - a.match || traction(b) - traction(a));

  // ── verdict ──
  onStep("verdict", "Weighing the evidence");
  const MIN_GAP = 60 * 1000;
  const earlier = cands.filter((c) => c.gap != null && c.gap > MIN_GAP && c.match >= 0.5);
  const later = cands.filter((c) => c.gap != null && c.gap < -MIN_GAP && c.match >= 0.6);
  const oldest = Math.max(...earlier.map((c) => c.gap), 1);
  earlier.forEach((c) => (c.ogScore = c.match * (0.55 + 0.45 * c.tractionNorm) + (c.ratio > 1 ? 0.05 : 0) + 0.06 * (c.gap / oldest)));
  const og = earlier.sort((a, b) => b.ogScore - a.ogScore)[0] || null;

  let kind, confidence, headline, lean = null;
  if (og && og.match >= 0.62) {
    const ratioF = clamp(Math.log10(og.ratio) / 3 + 0.5);
    const gapF = clamp(Math.log10(og.gap / 60000) / Math.log10(1440));
    confidence = Math.round(100 * clamp(0.55 * og.match + 0.25 * ratioF + 0.2 * gapF, 0.4, 0.97));
    if (confidence >= 56) { kind = "vamp"; headline = `Likely vamp of $${og.symbol}`; }
    else { kind = "unclear"; headline = "Unclear"; lean = `Leans vamp of $${og.symbol}`; }
  } else if (og) {
    kind = "unclear"; headline = "Unclear"; lean = `Some resemblance to $${og.symbol}, launched ${fmtGap(og.gap)} earlier`;
    confidence = Math.round(100 * clamp(0.35 + og.match * 0.3, 0.35, 0.6));
  } else {
    kind = "og"; headline = "Possible OG";
    const big = target.tractionNorm ?? clamp((Math.log10(traction(target)) - 3) / 5);
    confidence = Math.round(clamp(52 + later.length * 5 + big * 18, 50, 93));
    if (!target.createdAt) { kind = "unclear"; headline = "Unclear"; confidence = 40; lean = "No launch time available to order it"; }
  }

  // evidence
  const ev = [];
  if (og) {
    if (og.sig.ticker === 1) ev.push({ k: "Ticker", v: `Same ticker, $${og.symbol}` });
    else if (og.sig.ticker > 0.6) ev.push({ k: "Ticker", v: `$${target.symbol} vs $${og.symbol} (${pct(og.sig.ticker)} match)` });
    if (og.sig.name >= 0.6) ev.push({ k: "Name", v: og.sig.name >= 0.99 ? `Identical name, “${og.name}”` : `“${target.name}” vs “${og.name}” (${pct(og.sig.name)})` });
    if (og.hamming != null) ev.push({ k: "Logo", v: og.hamming <= 6 ? `Near-identical image (fingerprint distance ${og.hamming}/64)` : og.hamming <= 14 ? `Similar image (distance ${og.hamming}/64), likely edited` : `Different image (distance ${og.hamming}/64)` });
    if (og.sig.narrative != null) ev.push({ k: "Narrative", v: og.sig.narrative > 0.25 ? `Descriptions overlap ${pct(og.sig.narrative)}${og._terms?.length ? `: ${og._terms.join(", ")}` : ""}` : `Descriptions are worded differently (${pct(og.sig.narrative)})` });
    if (og.sharedSocials) ev.push({ k: "Socials", v: `Points to the same ${og.sharedSocials.join(", ")}` });
    ev.push({ k: "Timing", v: `Launched ${fmtGap(og.gap)} after $${og.symbol}` });
    if (og.ratio >= 1.5 && og.mcapRatio >= 1.5) ev.push({ k: "Traction", v: `$${og.symbol} is ${fmtRatio(og.mcapRatio)} larger (${fmtUsd(og.mcap || og.liquidity)} vs ${fmtUsd(target.mcap || target.liquidity)})` });
    else if (og.ratio < 0.67) ev.push({ k: "Traction", v: `This coin now outweighs $${og.symbol} ${fmtRatio(1 / og.mcapRatio)}. Flips happen, but timing still matters` });
    const others = earlier.filter((c) => c !== og && c.match >= 0.6).length;
    if (others) ev.push({ k: "Field", v: `${others} other earlier look-alike${others > 1 ? "s" : ""} found` });
  } else {
    if (later.length) ev.push({ k: "Copies", v: `${later.length} look-alike${later.length > 1 ? "s" : ""} launched after it` });
    ev.push({ k: "Earlier", v: "No earlier look-alike found in the pairs DexScreener indexes" + (SITE.backendUrl ? " or pump.fun" : "") });
    if (target.createdAt) ev.push({ k: "Launched", v: new Date(target.createdAt).toUTCString().replace(/:\d\d GMT/, " UTC") });
  }

  const timeline = [target, ...cands.filter((c) => c.match >= 0.55)]
    .filter((c) => c.createdAt).sort((a, b) => a.createdAt - b.createdAt).slice(0, 14)
    .map((c) => ({ address: c.address, symbol: c.symbol, name: c.name, createdAt: c.createdAt, mcap: c.mcap, liquidity: c.liquidity, image: c.image, match: c === target ? 1 : c.match, isTarget: c === target, isOg: c === og }));

  const xq = `"${target.name}" OR $${target.symbol}`;
  return {
    target, og, kind, headline, lean, confidence, evidence: ev, candidates: cands.slice(0, 12), timeline,
    later: later.length, queries, sources, ms: Date.now() - t0, scannedAt: Date.now(),
    x: {
      beforeTarget: xSearchUrl(xq, target.createdAt),
      beforeOg: og ? xSearchUrl(`"${og.name}" OR $${og.symbol}`, og.createdAt) : null,
      latest: xSearchUrl(xq),
    },
  };
}

export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) { let x = a[i] ^ b[i]; while (x) { d += x & 1; x >>>= 1; } }
  return d;
}
const pct = (x) => Math.round(x * 100) + "%";
export function fmtRatio(r) { return r >= 100 ? Math.round(r).toLocaleString("en-US") + "×" : r >= 10 ? Math.round(r) + "×" : r.toFixed(1) + "×"; }

// ── live feed ────────────────────────────────────────────────
export async function latestLaunches() {
  const [profiles, boosts] = await Promise.all([
    getJSON(`${DS}/token-profiles/latest/v1`, { retries: 0 }).catch(() => []),
    getJSON(`${DS}/token-boosts/latest/v1`, { retries: 0 }).catch(() => []),
  ]);
  const addrs = [...new Set([...profiles, ...boosts].filter((p) => p.chainId === "solana").map((p) => p.tokenAddress))].slice(0, 30);
  if (!addrs.length) return [];
  const pairs = await getJSON(`${DS}/tokens/v1/solana/${addrs.join(",")}`, { retries: 0 }).catch(() => []);
  const map = aggregate(pairs);
  const icons = new Map([...profiles, ...boosts].map((p) => [p.tokenAddress, p.icon]));
  return addrs.map((a) => map.get(a)).filter(Boolean).map(clean).map((t) => ({ ...t, image: t.image || icons.get(t.address) }));
}
