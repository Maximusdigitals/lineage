// Perceptual "difference hash" of a logo, computed in the browser.
// Images go through a CORS-friendly proxy so the canvas stays readable.
import { SITE } from "../config.js";

const cache = new Map();
function load(src, timeout = 7000) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const t = setTimeout(() => { img.src = ""; rej(new Error("timeout")); }, timeout);
    img.onload = () => { clearTimeout(t); res(img); };
    img.onerror = () => { clearTimeout(t); rej(new Error("load")); };
    img.src = src;
  });
}
export function proxied(url, size = 64) {
  if (!url) return "";
  if (/gateway\.pinata\.cloud/.test(url)) return url; // already CORS-enabled
  return `${SITE.imageProxy}${encodeURIComponent(url)}&w=${size}&h=${size}&fit=cover&output=webp`;
}
export async function hashImage(url) {
  if (cache.has(url)) return cache.get(url);
  const p = (async () => {
    let img;
    try { img = await load(proxied(url, 64)); }
    catch { img = await load(url); } // last resort: direct (works when the host sends CORS)
    const c = document.createElement("canvas");
    c.width = 9; c.height = 8;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 9, 8);
    ctx.drawImage(img, 0, 0, 9, 8);
    const d = ctx.getImageData(0, 0, 9, 8).data;
    const g = (x, y) => { const i = (y * 9 + x) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
    const h = new Uint8Array(8);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (g(x, y) > g(x + 1, y)) h[y] |= 1 << x;
    return h;
  })();
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}
