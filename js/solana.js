// On-chain metadata (name / symbol / uri → description, socials, image)
// Works for Token-2022 (pump.fun's current standard, metadata lives in the
// mint) and classic SPL tokens (Metaplex metadata PDA).
import { SITE } from "../config.js";

const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58decode(s) {
  let bytes = [0];
  for (const ch of s) {
    const v = ALPHA.indexOf(ch);
    if (v < 0) throw new Error("bad base58");
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const ch of s) { if (ch === "1") bytes.push(0); else break; }
  return Uint8Array.from(bytes.reverse());
}
export function b58encode(buf) {
  let digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "";
  for (const b of buf) { if (b === 0) out += "1"; else break; }
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHA[digits[i]];
  return out;
}

const META_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
let _ed;
async function ed() {
  if (_ed) return _ed;
  if (globalThis.__nobleEd) return (_ed = globalThis.__nobleEd);
  const m = await import("https://esm.sh/@noble/curves@1.4.0/ed25519");
  return (_ed = m.ed25519);
}
async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
async function findPda(seeds, programId) {
  const curve = await ed();
  const prog = b58decode(programId);
  const tail = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, Uint8Array.of(bump), prog, tail];
    const len = parts.reduce((a, p) => a + p.length, 0);
    const buf = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    const h = await sha256(buf);
    let onCurve = true;
    try { curve.ExtendedPoint.fromHex(h); } catch { onCurve = false; }
    if (!onCurve) return b58encode(h);
  }
  throw new Error("no pda");
}

async function rpc(method, params, timeout = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(SITE.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctl.signal,
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
  } finally { clearTimeout(t); }
}

function readStr(dv, bytes, o) {
  const n = dv.getUint32(o, true);
  const s = new TextDecoder().decode(bytes.slice(o + 4, o + 4 + n)).replace(/\0+$/g, "").trim();
  return [s, o + 4 + n];
}
function parseMetaplex(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const dv = new DataView(bytes.buffer);
  let o = 1 + 32 + 32;
  let name, symbol, uri;
  [name, o] = readStr(dv, bytes, o);
  [symbol, o] = readStr(dv, bytes, o);
  [uri, o] = readStr(dv, bytes, o);
  return { name, symbol, uri };
}

export function ipfsRewrite(u) {
  if (!u) return u;
  const m = u.match(/(?:ipfs:\/\/|\/ipfs\/)([A-Za-z0-9]+[^?#]*)/);
  if (m) return SITE.ipfsGateway + m[1];
  return u;
}

async function fetchJsonUri(uri, timeout = 6500) {
  if (!uri || !/^https?:|^ipfs:/.test(uri)) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(ipfsRewrite(uri), { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

/** mints[] → Map<mint, {name,symbol,uri,description,image,twitter,website,telegram,standard}> */
export async function fetchOnchainMeta(mints) {
  const out = new Map();
  if (!mints.length) return out;
  let accs;
  try {
    accs = await rpc("getMultipleAccounts", [mints, { encoding: "jsonParsed" }]);
  } catch { return out; }
  const classic = [];
  accs.value.forEach((a, i) => {
    const mint = mints[i];
    if (!a) return;
    const ext = a.data?.parsed?.info?.extensions?.find((e) => e.extension === "tokenMetadata");
    if (ext) out.set(mint, { ...ext.state, standard: "token-2022" });
    else classic.push(mint);
  });
  if (classic.length) {
    try {
      const pdas = await Promise.all(
        classic.map((m) => findPda([new TextEncoder().encode("metadata"), b58decode(META_PROGRAM), b58decode(m)], META_PROGRAM))
      );
      const r = await rpc("getMultipleAccounts", [pdas, { encoding: "base64" }]);
      r.value.forEach((a, i) => {
        if (!a) return;
        try { out.set(classic[i], { ...parseMetaplex(a.data[0]), standard: "spl" }); } catch {}
      });
    } catch {}
  }
  await Promise.all(
    [...out.entries()].map(async ([mint, m]) => {
      const j = await fetchJsonUri(m.uri);
      if (!j) return;
      const ex = j.extensions || {};
      Object.assign(m, {
        description: (j.description || "").slice(0, 1200),
        image: ipfsRewrite(j.image || ""),
        twitter: j.twitter || ex.twitter || "",
        website: j.website || ex.website || "",
        telegram: j.telegram || ex.telegram || "",
        createdOn: j.createdOn || "",
      });
    })
  );
  return out;
}
