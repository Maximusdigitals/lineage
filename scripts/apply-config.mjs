// Sync static <head> tags (title, description, Open Graph, Twitter card) with config.js.
// Usage: node scripts/apply-config.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { SITE } = await import(join(root, "config.js") + "?t=" + Date.now());
const e = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const title = `${SITE.name}: is this coin the original?`;
const img = `${SITE.url}assets/og.jpg`;
const v = SITE.assetVersion ? `?v=${SITE.assetVersion}` : "";
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
<meta property="og:image:type" content="image/jpeg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${e(title)}" />
<meta name="twitter:description" content="${e(SITE.description)}" />
<meta name="twitter:image" content="${e(img)}" />
<meta name="twitter:site" content="${SITE.xHandle ? "@" + e(SITE.xHandle.replace(/^@/, "")) : ""}" />
<meta name="twitter:creator" content="${SITE.xHandle ? "@" + e(SITE.xHandle.replace(/^@/, "")) : ""}" />
<!-- META:END -->`;
const htmlPath = join(root, "index.html");
let html = readFileSync(htmlPath, "utf8").replace(/<!-- META:START[\s\S]*?<!-- META:END -->/, block);
html = html.replace(/(data-site="name"[^>]*>)[^<]*/g, `$1${e(SITE.name)}`);
// cache-bust site assets in href/src/srcset/content, never comments or other .js mentions
html = html.replace(
  /(assets\/[^"'\s]+?\.(?:css|js|png|jpg|webp|ico|svg|webmanifest)|(?:css|js)\/[^"'\s]+?\.(?:css|js)|site\.webmanifest)(?:\?v=[^"'\s]*)?/g,
  `$1${v}`
);
writeFileSync(htmlPath, html);

const manPath = join(root, "site.webmanifest");
try {
  const man = JSON.parse(readFileSync(manPath, "utf8"));
  man.name = SITE.name;
  man.short_name = SITE.name;
  man.description = SITE.description;
  writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n");
} catch {}
console.log(`Applied "${SITE.name}" (v=${SITE.assetVersion || "—"}) to index.html. Re-shoot assets/og.jpg from og.html if the name changed.`);
