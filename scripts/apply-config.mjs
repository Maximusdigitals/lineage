// Sync static <head> tags (title, description, Open Graph, Twitter card) with config.js.
// Usage: node scripts/apply-config.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { SITE } = await import(join(root, "config.js"));
const e = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const title = `${SITE.name}: is this coin the original?`;
const img = `${SITE.url}assets/og.png`;
const block = `<!-- META:START (generated from config.js by scripts/apply-config.mjs) -->
<title>${e(title)}</title>
<meta name="description" content="${e(SITE.description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${e(SITE.name)}" />
<meta property="og:title" content="${e(title)}" />
<meta property="og:description" content="${e(SITE.description)}" />
<meta property="og:url" content="${e(SITE.url)}" />
<meta property="og:image" content="${e(img)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${e(title)}" />
<meta name="twitter:description" content="${e(SITE.description)}" />
<meta name="twitter:image" content="${e(img)}" />
<meta name="twitter:site" content="${SITE.xHandle ? "@" + e(SITE.xHandle.replace(/^@/, "")) : ""}" />
<!-- META:END -->`;
const p = join(root, "index.html");
const html = readFileSync(p, "utf8").replace(/<!-- META:START[\s\S]*?<!-- META:END -->/, block);
writeFileSync(p, html);
// static fallbacks for crawlers / no-JS
const p2 = join(root, "index.html");
writeFileSync(p2, readFileSync(p2, "utf8")
  .replace(/(data-site="name"[^>]*>)[^<]*/g, `$1${e(SITE.name)}`)
  .replace(/(data-site="mark"[^>]*>)[^<]*/g, `$1${e(SITE.mark)}`));
console.log(`Applied "${SITE.name}" to index.html. Re-shoot assets/og.png with og.html if the name changed.`);
