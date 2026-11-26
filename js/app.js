import { SITE } from "../config.js";
import { scan, isSolAddress, latestLaunches, fmtGap, fmtUsd, fmtRatio, xNarrativeCheck } from "./engine.js";
import { hashImage, proxied } from "./imagehash.js";
import { fetchOnchainMeta } from "./solana.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const short = (a) => (a ? a.slice(0, 4) + "…" + a.slice(-4) : "");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const img = (url, size, cls = "", alt = "") =>
  url ? `<img class="${cls}" src="${esc(proxied(url, size))}" alt="${esc(alt)}" loading="lazy" decoding="async" crossorigin="anonymous" onerror="this.outerHTML='<span class=&quot;ph ${cls}&quot;>?</span>'">`
      : `<span class="ph ${cls}" aria-hidden="true">?</span>`;
const ago = (ms) => (ms ? fmtGap(Date.now() - ms) : "—");
const dateStr = (ms) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

// Real Solana pairs found on DexScreener (Nov 2026). Suspect → expected OG.
const DEMOS = [
  { ca: "9bgy4dVrPqa7HozGvBRV5Qy1ccbDdYHHMyzKrJjqpump", og: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", title: "The <em>squirrel</em> returns", blurb: "A fresh $PNUT, same name, launched this week. Two years after the original.", kind: "vamp" },
  { ca: "AjMqYMZam2Zbudn4gpWYqRku7Hmyv9RytyNexstVpump", og: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", title: "Just a <em>copy</em> guy", blurb: "“Just a chill guy”, word for word, minted days ago.", kind: "vamp" },
  { ca: "HnXDnwTa68tRhLRZdJkVRLAeYrUkCYgFgDavtwD1pump", og: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", title: "Second <em>wind</em>", blurb: "Another $Fartcoin. Same ticker, same name, a year late.", kind: "vamp" },
  { ca: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", og: null, title: "The <em>original</em> Peanut", blurb: "Run the real $PNUT and see how many copies trail behind it.", kind: "og" },
];

/* ── brand from config ── */
const emblem = (size, cls = "", alt = "") =>
  `<img class="${cls}" src="assets/brand/emblem-${size}.webp" alt="${esc(alt)}" width="${size}" height="${size}" decoding="async">`;

function applySite() {
  $$('[data-site="name"]').forEach((n) => (n.textContent = SITE.name));
  const h = SITE.xHandle?.replace(/^@/, "");
  $$("[data-x-follow]").forEach((a) => {
    if (h) {
      a.href = `https://x.com/${h}`; a.target = "_blank"; a.rel = "noopener";
      a.classList.remove("is-soon");
    } else if (a.classList.contains("btn-primary")) {
      // The in-page CTA would only jump to the section it's already in.
      a.removeAttribute("href");
      a.classList.add("is-soon");
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("role", "text");
      const lab = a.querySelector("[data-x-label]");
      if (lab) lab.textContent = "X page coming soon";
    } else {
      a.href = "#field";
      a.setAttribute("aria-label", "X account coming soon — see Field notes");
    }
  });
  $$("[data-x-handle]").forEach((n) => (n.textContent = h ? `@${h}` : "@ handle coming soon"));
  $$("[data-x-profile]").forEach((a) => {
    if (h) { a.href = `https://x.com/${h}`; a.target = "_blank"; a.rel = "noopener me"; a.textContent = `@${h}`; }
  });
  if (h && SITE.xFeedEmbed) {
    const slot = $("#xFeedSlot");
    slot.classList.add("live");
    slot.innerHTML = `<a class="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter noborders transparent" data-height="520" href="https://twitter.com/${h}">Posts by @${h}</a>`;
    const sc = document.createElement("script"); sc.async = true; sc.src = "https://platform.twitter.com/widgets.js"; document.body.appendChild(sc);
  }
}

/* ── motion ── */
function motion() {
  $$("[data-split] .line").forEach((l) => (l.innerHTML = `<span>${l.innerHTML}</span>`));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = el.closest(".hero") ? `${0.08 * i}s` : "0s"; io.observe(el); });
  window.__io = io;
  const nav = $(".nav");
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 30), { passive: true });
  if (!reduced && matchMedia("(hover:hover)").matches) {
    const g = $(".glow");
    const magnets = () => $$(".hunt,.btn-primary:not(.is-soon)");
    const onMove = (e) => {
      g.style.setProperty("--gx", e.clientX + "px");
      g.style.setProperty("--gy", e.clientY + "px");
      const b = e.target.closest?.(".hunt,.btn-primary:not(.is-soon)");
      magnets().forEach((x) => { if (x !== b) x.style.transform = ""; });
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px,${(e.clientY - r.top - r.height / 2) * 0.2}px)`;
    };
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerleave", () => magnets().forEach((x) => (x.style.transform = "")), { passive: true });
  }
}

/* ── live feed + ticker ── */
let pool = [], feedIdx = 0, feedTimer, liveBusy = false;
function feedItem(t) {
  return `<button class="feed-item" data-ca="${esc(t.address)}" aria-label="Scan ${esc(t.symbol)}">
    ${img(t.image, 72, "", "")}
    <span class="t"><span class="s">$${esc(t.symbol)}</span><span class="n">${esc(t.name)}</span></span>
    <span class="r">${fmtUsd(t.mcap)}<b>${ago(t.createdAt)} old</b></span><span class="go" aria-hidden="true">→</span></button>`;
}
async function loadLive() {
  if (liveBusy) return;
  liveBusy = true;
  let list = [];
  try { list = await latestLaunches(); } catch { list = []; } finally { liveBusy = false; }
  if (!list.length) {
    if (!pool.length) $("#feedList").innerHTML = `<li><span class="n" style="color:var(--mute);font-size:13px">Live feed is resting (DexScreener rate limit). It retries in a minute.</span></li>`;
    return;
  }
  pool = list;
  const fl = $("#feedList");
  fl.innerHTML = list.slice(0, 5).map((t) => `<li>${feedItem(t)}</li>`).join("");
  feedIdx = 5;
  clearInterval(feedTimer);
  if (!reduced) feedTimer = setInterval(() => {
    if (document.hidden || !pool.length) return;
    const t = pool[feedIdx++ % pool.length];
    const li = document.createElement("li"); li.className = "enter"; li.innerHTML = feedItem(t);
    fl.prepend(li);
    while (fl.children.length > 6) fl.lastElementChild.remove();
  }, 3800);
  const row = list.map((t) => `<button class="tk" data-ca="${esc(t.address)}">${img(t.image, 40)}<b>$${esc(t.symbol)}</b>${fmtUsd(t.mcap)}${t.change24 != null ? `<span class="${t.change24 >= 0 ? "up" : "dn"}">${t.change24 >= 0 ? "+" : ""}${Math.round(t.change24)}%</span>` : ""}</button>`).join("");
  const tr = $("#tickerRow");
  tr.innerHTML = row + row.replace(/<button /g, '<button tabindex="-1" aria-hidden="true" ');
  tr.style.setProperty("--dur", `${Math.max(40, list.length * 4)}s`);
}
function clock() {
  const el = $("#feedClock");
  const tick = () => (el.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false }) + " local");
  tick(); setInterval(tick, 1000);
}

/* ── demos ── */
async function loadCases() {
  const grid = $("#caseGrid");
  grid.innerHTML = DEMOS.map((d, i) => `<button class="case reveal" data-ca="${d.ca}">
    <span class="case-top"><span>Case ${String(i + 1).padStart(3, "0")}</span><span>${short(d.ca)}</span></span>
    <span class="tag ${d.kind}">${d.kind === "vamp" ? "Suspected copy" : "Suspected original"}</span>
    <h3>${d.title}</h3><p>${d.blurb}</p>
    <span class="case-imgs" data-imgs="${d.og ? d.og + "," : ""}${d.ca}"></span>
    <span class="arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span></button>`).join("");
  $$(".case.reveal", grid).forEach((el) => window.__io.observe(el));
  const all = [...new Set(DEMOS.flatMap((d) => [d.ca, d.og]).filter(Boolean))];
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${all.join(",")}`).then((r) => r.json());
    const imgs = {};
    r.forEach((p) => { if (p.info?.imageUrl && !imgs[p.baseToken.address]) imgs[p.baseToken.address] = p.info.imageUrl; });
    const draw = () => $$("[data-imgs]", grid).forEach((n) => (n.innerHTML = n.dataset.imgs.split(",").map((a) => img(imgs[a], 128)).join("")));
    draw();
    const missing = all.filter((a) => !imgs[a]);
    if (missing.length) {
      const meta = await fetchOnchainMeta(missing).catch(() => new Map());
      meta.forEach((m, a) => m.image && (imgs[a] = m.image));
      draw();
    }
  } catch {}
}

/* ── recent scans (this device only) ── */
const RKEY = "vh.recent";
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch { return []; } };
function pushRecent(r) {
  const list = [{ ca: r.target.address, s: r.target.symbol, i: r.target.image, k: r.kind }, ...getRecent().filter((x) => x.ca !== r.target.address)].slice(0, 6);
  try { localStorage.setItem(RKEY, JSON.stringify(list)); } catch {}
  renderRecent();
}
function renderRecent() {
  const list = getRecent(), el = $("#recent");
  if (!list.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="lbl">Recent</span>` + list.map((x) => `<button type="button" class="chip" data-ca="${esc(x.ca)}">${img(x.i, 36)}$${esc(x.s)}</button>`).join("");
}

/* ── scanning ── */
const STEPS = [["fetch", "Pulling the coin"], ["search", "Searching every earlier launch"], ["meta", "Reading descriptions and socials"], ["images", "Fingerprinting logos"], ["narrative", "Comparing narratives"], ["verdict", "Weighing the evidence"]];
let busy = false;
async function run(ca, { push = true } = {}) {
  ca = (ca || "").trim();
  const form = $("#scanForm");
  if (!isSolAddress(ca)) {
    form.classList.remove("invalid"); void form.offsetWidth; form.classList.add("invalid");
    $("#scanHint").textContent = "That doesn't look like a Solana address. It's 32 to 44 characters, letters and numbers.";
    return;
  }
  if (busy) return;
  busy = true;
  form.classList.remove("invalid");
  $("#scanHint").textContent = "pump.fun, Raydium, PumpSwap, Meteora. Anything with a Solana mint.";
  $("#ca").value = ca;
  if (push) history.replaceState(null, "", `?ca=${ca}`);
  const res = $("#result"), prog = $("#progress"), rep = $("#report"), err = $("#error");
  res.hidden = false; err.hidden = true; rep.innerHTML = ""; prog.hidden = false;
  $("#steps").innerHTML = STEPS.map(([k, l]) => `<li data-k="${k}">${l}</li>`).join("");
  $("#progressFill").style.width = "4%";
  $("#huntBtn").disabled = true;
  res.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  try {
    const r = await scan(ca, {
      hashImage,
      onStep: (k, label) => {
        const i = STEPS.findIndex((s) => s[0] === k);
        $$("#steps li").forEach((li, j) => { li.className = j < i ? "done" : j === i ? "on" : ""; if (j === i && label) li.textContent = label; });
        $("#progressFill").style.width = `${Math.round(((i + 1) / (STEPS.length + 0.5)) * 100)}%`;
      },
    });
    $("#progressFill").style.width = "100%";
    await new Promise((ok) => setTimeout(ok, 250));
    prog.hidden = true;
    render(r);
    pushRecent(r);
    document.title = `${r.headline} · $${r.target.symbol} · ${SITE.name}`;
    xNarrativeCheck({ name: r.target.name, symbol: r.target.symbol, before: r.target.createdAt }).then((x) => x && renderXHook(x));
  } catch (e) {
    prog.hidden = true;
    err.hidden = false;
    err.innerHTML = `<b>Couldn't finish the hunt.</b> ${esc(e.message || e)}${/rate|429/i.test(e.message) ? " DexScreener is rate-limiting. Give it a few seconds and try again." : ""}`;
  } finally {
    busy = false; $("#huntBtn").disabled = false;
  }
}

/* ── render ── */
function signalBars(c, kind) {
  const rows = [["Ticker", c?.sig?.ticker], ["Name", c?.sig?.name], ["Logo", c?.sig?.image], ["Narrative", c?.sig?.narrative], ["Socials", c?.sig?.socials]];
  return rows.map(([k, v]) => {
    const na = v == null;
    const hot = !na && v >= 0.75;
    return `<div class="bar ${na ? "na" : ""} ${hot ? "hot" : ""}"><span>${k}</span><span class="tr"><i data-w="${na ? 0 : Math.round(v * 100)}"></i></span><span class="v">${na ? (k === "Socials" ? "none" : "n/a") : Math.round(v * 100) + "%"}</span></div>`;
  }).join("");
}
function entity(t, role, cls) {
  return `<div class="c-ent ${cls}"><span class="c-role">${role}</span>${img(t.image, 320, "c-img", t.symbol)}
    <div class="c-tk ${t.symbol.length > 7 ? "long" : ""}">$${esc(t.symbol)}</div><div class="c-nm">${esc(t.name)}</div>
    <div class="c-meta">${dateStr(t.createdAt)}<br><b>${fmtUsd(t.mcap)}</b> mcap</div></div>`;
}
function cardHTML(r) {
  const t = r.target, og = r.og;
  const stamp = r.kind === "vamp" ? "Likely vamp" : r.kind === "og" ? "Possible OG" : "Unclear";
  const host = SITE.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  let pair, side;
  if (r.kind !== "og" && og) {
    pair = `${entity(og, "The original", "og")}
      <div class="c-mid"><span class="gapl">launched</span><span class="gapv">+${fmtGap(og.gap)}</span><span class="gapl">later</span><span class="rule"></span></div>
      ${entity(t, "The suspect", "sus")}`;
    side = `<div class="c-verdict">${r.kind === "vamp" ? `Likely a vamp<br>of <em>$${esc(og.symbol)}</em>` : `<em>Unclear.</em><br>${esc(r.lean || "")}`}</div>
      <div class="c-stats"><div class="c-stat"><b>${r.confidence}</b><span>Confidence</span></div>
      <div class="c-stat"><b>${og.mcapRatio >= 1 ? fmtRatio(og.mcapRatio) : "1/" + fmtRatio(1 / og.mcapRatio)}</b><span>OG mcap ratio</span></div>
      <div class="c-stat"><b>${fmtGap(og.gap)}</b><span>Launch gap</span></div></div>
      <div class="c-bars">${signalBars(og, r.kind)}</div>`;
  } else {
    const copies = r.candidates.filter((c) => c.gap != null && c.gap < 0 && c.match >= 0.6);
    pair = `${entity(t, r.kind === "og" ? "The original?" : "Under the glass", "og")}
      <div class="c-mid"><span class="gapl">copies after</span><span class="gapv">${copies.length}</span><span class="rule"></span></div>
      <div class="c-ent sus"><span class="c-role">Look-alikes since</span><div class="c-copies">${(() => { const w = copies.filter((c) => c.image).slice(0, 4); return (w.map((c) => img(c.image, 160)).join("") || '<span class="ph">0</span>') + (copies.length > w.length ? `<span class="more">+${copies.length - w.length}</span>` : ""); })()}</div>
      <div class="c-meta">${copies.length ? `first copy ${fmtGap(Math.min(...copies.map((c) => -c.gap)))} after` : "none found yet"}</div></div>`;
    const top = copies[0] || r.candidates[0];
    side = `<div class="c-verdict">${r.kind === "og" ? `No earlier coin<br>found. <em>Possible OG.</em>` : `<em>Unclear.</em><br>${esc(r.lean || "Not enough signal")}`}</div>
      <div class="c-stats"><div class="c-stat"><b>${r.confidence}</b><span>Confidence</span></div>
      <div class="c-stat"><b>${copies.length}</b><span>Later copies</span></div>
      <div class="c-stat"><b>${t.createdAt ? fmtGap(Date.now() - t.createdAt) : "—"}</b><span>Age</span></div></div>
      ${top ? `<div class="c-bars">${signalBars(top, r.kind)}</div>` : ""}`;
  }
  return `<div class="card k-${r.kind}" id="shareCard"><div class="sheen"></div><div class="c-in">
    <div class="c-top"><span class="c-brand">${emblem(64, "c-logo")}${esc(SITE.name)}</span><span class="c-stamp">${stamp}</span></div>
    <div class="c-pair">${pair}</div><div class="c-side">${side}</div>
    <div class="c-foot"><span>${host}</span><span>${short(t.address)} · ${new Date(r.scannedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</span><span class="c-dyor">Likely ≠ certain · DYOR</span></div>
  </div></div>`;
}

function render(r) {
  const t = r.target, og = r.og;
  const caseNo = String(parseInt(t.address.slice(-6), 36) % 9973).padStart(4, "0");
  const titleEm = r.kind === "vamp" ? `of $${esc(og.symbol)}` : r.kind === "og" ? "OG." : "for now.";
  const titleLead = r.kind === "vamp" ? "Likely vamp" : r.kind === "og" ? "Possible" : "Unclear,";
  const copies = r.candidates.filter((c) => c.gap != null && c.gap < 0 && c.match >= 0.6);
  const sym = (s) => `$${esc(s)}`;
  const tl = r.timeline;
  const tlHtml = tl.map((n, i) => {
    const left = tl.length === 1 ? 50 : (i / (tl.length - 1)) * 100;
    const cls = [n.isOg ? "og" : "", n.isTarget ? "me" : "", i % 2 ? "lo" : ""].join(" ");
    const role = n.isTarget ? "Scanned" : n.isOg ? "Likely OG" : `${Math.round(n.match * 100)}% match`;
    return `<a class="tl-node ${cls}" style="left:${left}%" href="?ca=${n.address}" data-ca="${n.address}">${img(n.image, 96, "", n.symbol)}
      <span class="tx"><span class="role">${role}</span><span class="s">${sym(n.symbol)}</span><span class="d">${dateStr(n.createdAt)}<br>${fmtUsd(n.mcap)}</span></span><span class="pin"></span></a>`;
  }).join("");
  const rows = r.candidates.map((c) => {
    const badge = c === og ? `<span class="badge og">Likely OG</span>` : c.gap > 0 ? `<span class="badge early">Earlier</span>` : `<span class="badge late">Later</span>`;
    return `<div class="la-row">${img(c.image, 72, "", c.symbol)}<div class="nm"><b>${sym(c.symbol)}${badge}</b><span>${esc(c.name)}</span></div>
      <div class="num c-when">${c.gap != null ? fmtGap(c.gap) + (c.gap > 0 ? " before" : " after") : "—"}</div>
      <div class="num c-mc">${fmtUsd(c.mcap)}</div><div class="num c-liq">${fmtUsd(c.liquidity)}</div>
      <div class="mt"><span class="tr"><i style="width:${Math.round(c.match * 100)}%"></i></span>${Math.round(c.match * 100)}%</div>
      <div class="acts"><button data-ca="${c.address}" aria-label="Scan ${esc(c.symbol)}">Scan</button><a href="${esc(c.url || `https://dexscreener.com/solana/${c.address}`)}" target="_blank" rel="noopener" aria-label="Open ${esc(c.symbol)} on DexScreener">Chart</a></div></div>`;
  }).join("");
  const s = r.sources;
  const srcRow = `<div class="sources">
    <span>DexScreener <span class="${s.dexscreener === "ok" ? "ok" : "no"}">${s.dexscreener === "ok" ? "●" : "○"}</span></span>
    <span>Solana RPC metadata <span class="${s.rpc === "ok" ? "ok" : "no"}">${s.rpc === "ok" ? "●" : "○"}</span></span>
    <span>pump.fun ${s.pumpfun === "ok" ? '<span class="ok">●</span>' : '<span class="no">○</span> (blocks browser requests, needs the backend hook)'}</span>
    <span>${s.images} logos fingerprinted</span><span>${r.queries.length} searches</span><span>${(r.ms / 1000).toFixed(1)}s</span></div>`;

  $("#report").innerHTML = `
  <div class="k-${r.kind}">
    <div class="verdict-head">
      <div><div class="case-no"><span>Case <b>${caseNo}</b></span><span><b>${sym(t.symbol)}</b> · ${short(t.address)}</span><span>${new Date(r.scannedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></div>
        <h2 class="verdict-title">${titleLead} <em>${titleEm}</em></h2>
        ${r.lean ? `<p class="verdict-lean">${esc(r.lean)}</p>` : ""}</div>
      <div class="conf"><span class="conf-n" data-count="${r.confidence}">0</span><span class="conf-l">Confidence / 100</span></div>
    </div>
    <div class="result-grid">
      <div>
        <div class="card-wrap">${cardHTML(r)}</div>
        <div class="actions">
          <a class="btn solid" id="shareX" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.7 3Zm-1.1 16.2h1.7L7.5 4.7H5.7l10.9 14.5Z"/></svg>Share on X</a>
          <button class="btn" id="saveImg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11.2l4-4 1.4 1.4L12 17l-5.4-5.4L8 10.2l4 4V3h0ZM4 19h16v2H4z"/></svg>Save card</button>
          <button class="btn" id="copyLink"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0ZM8.5 18.5a3.5 3.5 0 0 1-2.5-6l2.1-2.1 1.4 1.4-2.1 2.1a1.5 1.5 0 0 0 2.1 2.1l2.1-2.1 1.4 1.4-2.1 2.1a3.5 3.5 0 0 1-2.4 1.1Zm7.4-4.9-1.4-1.4 2.1-2.1a1.5 1.5 0 0 0-2.1-2.1l-2.1 2.1L11 8.7l2.1-2.1a3.5 3.5 0 0 1 4.9 4.9l-2.1 2.1Z"/></svg>Copy link</button>
        </div>
        <div class="panel xpanel"><h3>Trace the narrative on X</h3>
          <div class="xlinks" id="xlinks">
            <a class="xlink" href="${esc(r.x.beforeTarget)}" target="_blank" rel="noopener"><span>Posts before ${sym(t.symbol)} launched<small>“${esc(t.name)}” or ${sym(t.symbol)}, up to ${dateStr(t.createdAt)}</small></span><svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></a>
            ${r.x.beforeOg ? `<a class="xlink" href="${esc(r.x.beforeOg)}" target="_blank" rel="noopener"><span>Posts before the OG launched<small>Where the ${sym(og.symbol)} narrative started, up to ${dateStr(og.createdAt)}</small></span><svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></a>` : ""}
            <a class="xlink" href="${esc(r.x.latest)}" target="_blank" rel="noopener"><span>Latest posts<small>What people are saying now</small></span><svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></a>
          </div>
          <p class="hook-note" id="xHookNote">Automatic earliest-post detection switches on with the X integration.</p>
      </div>
      <aside>
        <div class="panel"><h3>Receipts <span>${r.evidence.length}</span></h3>
          <ol class="receipts">${r.evidence.map((e, i) => `<li style="animation-delay:${0.06 * i + 0.2}s"><span class="rk">${esc(e.k)}</span><span class="rv">${esc(e.v)}</span></li>`).join("")}</ol></div>
        <div class="panel"><h3>The scanned coin <span>${esc(t.launchDex || t.dexId || "")}</span></h3>
          <div class="coin-stats"><div><b>${fmtUsd(t.mcap)}</b><span>Market cap</span></div><div><b>${fmtUsd(t.liquidity)}</b><span>Liquidity</span></div>
          <div><b>${fmtUsd(t.volume24)}</b><span>Volume 24h</span></div><div><b>${t.txns24 ? (t.txns24.buys + t.txns24.sells).toLocaleString("en-US") : "—"}</b><span>Trades 24h</span></div></div>
          ${t.meta?.description ? `<p class="desc">${esc(t.meta.description)}</p>` : ""}
          <div class="addr"><span>${esc(t.address)}</span><button data-copy="${esc(t.address)}">Copy</button></div></div>
</div>
      </aside>
    </div>
    ${tl.length > 1 ? `<div class="timeline"><div class="tl-head"><h3>The <em>lineage</em></h3><span>${tl.length} coins · oldest → newest</span></div><div class="tl">${tlHtml}</div></div>` : ""}
    ${rows ? `<div class="lookalikes"><div class="tl-head"><h3>Look-alikes</h3><span>${r.candidates.length} closest · ${copies.length} launched after</span></div>
      <div class="la-row h"><span></span><span>Coin</span><span class="c-when">Launched</span><span class="c-mc">Mcap</span><span class="c-liq">Liquidity</span><span>Match</span><span></span></div>${rows}</div>` : ""}
    ${srcRow}
  </div>`;

  // animate
  requestAnimationFrame(() => setTimeout(() => $$("#report .bar .tr i").forEach((i) => (i.style.width = i.dataset.w + "%")), 120));
  const cn = $("#report .conf-n");
  const target = +cn.dataset.count, t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / 1300); cn.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(step); };
  reduced ? (cn.textContent = target) : requestAnimationFrame(step);

  // tilt
  const card = $("#shareCard");
  if (!reduced && matchMedia("(hover:hover)").matches) {
    card.addEventListener("pointermove", (e) => {
      const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      card.style.transform = `rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg)`;
      card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  }

  // share
  const link = `${SITE.url}?ca=${t.address}`;
  const via = SITE.xHandle ? `&via=${encodeURIComponent(SITE.xHandle.replace(/^@/, ""))}` : "";
  let text;
  const sameTk = t.symbol.toLowerCase() === og?.symbol?.toLowerCase();
  if (r.kind === "vamp") text = `${sameTk ? `This $${t.symbol} (${short(t.address)})` : `$${t.symbol}`} looks like a likely vamp of ${sameTk ? "the original " : ""}$${og.symbol}.\n\nLaunched ${fmtGap(og.gap)} later${og.mcapRatio >= 1.5 ? `, ${fmtRatio(og.mcapRatio)} smaller` : ""}. ${r.confidence}/100 confidence.\n\nReceipts:`;
  else if (r.kind === "og") text = `$${t.symbol} checks out as a possible OG.${copies.length ? ` ${copies.length} look-alike${copies.length > 1 ? "s" : ""} launched after it.` : ""}\n\nReceipts:`;
  else text = `Ran $${t.symbol} through ${SITE.name}. Verdict: unclear${r.lean ? ` (${r.lean.toLowerCase()})` : ""}.\n\nReceipts:`;
  $("#shareX").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}${via}`;
  $("#copyLink").onclick = () => copy(link, "Link copied");
  $("#saveImg").onclick = () => saveCard(card, t.symbol);
}

function renderXHook(x) {
  // Future: backend returns { earliest:[{url,text,createdAt,author}] }
  if (!x?.earliest?.length) return;
  $("#xHookNote").textContent = "";
  $("#xlinks").insertAdjacentHTML("afterbegin", x.earliest.slice(0, 3).map((p) => `<a class="xlink" href="${esc(p.url)}" target="_blank" rel="noopener"><span>${esc(p.text.slice(0, 90))}<small>@${esc(p.author)} · ${dateStr(p.createdAt)}</small></span></a>`).join(""));
}

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  toast(msg);
}
function toast(msg) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div"); t.className = "toast"; t.role = "status"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
async function saveCard(card, sym) {
  toast("Rendering card…");
  try {
    const { toBlob } = await import("https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm");
    const prev = card.style.transform; card.style.transform = "none";
    const blob = await toBlob(card, { pixelRatio: Math.max(2, 1600 / card.offsetWidth), backgroundColor: "#100f0c", cacheBust: false });
    card.style.transform = prev;
    const file = new File([blob], `${SITE.name.toLowerCase().replace(/\s+/g, "-")}-${sym}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] }) && matchMedia("(hover:none)").matches) {
      await navigator.share({ files: [file], title: `${SITE.name} · $${sym}` }).catch(() => {});
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Card saved");
    }
  } catch (e) { toast("Couldn't render the image here. Try a screenshot."); }
}

/* ── wire up ── */
function wire() {
  $("#scanForm").addEventListener("submit", (e) => { e.preventDefault(); run($("#ca").value); });
  $("#ca").addEventListener("input", (e) => {
    const v = e.target.value.trim();
    const m = v.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/); // accept pasted dexscreener / pump.fun links
    if (m && v !== m[0] && /\//.test(v)) e.target.value = m[0];
  });
  $("#ca").addEventListener("paste", () => setTimeout(() => { const v = $("#ca").value.trim(); if (isSolAddress(v)) run(v); }, 30));
  $("#pasteBtn").addEventListener("click", async () => {
    try {
      const txt = (await navigator.clipboard.readText()).trim();
      const m = txt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      if (m) { $("#ca").value = m[0]; run(m[0]); } else { $("#ca").focus(); toast("No address on your clipboard"); }
    } catch { $("#ca").focus(); toast("Long-press the field to paste"); }
  });
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]");
    if (c) { copy(c.dataset.copy, "Address copied"); return; }
    const b = e.target.closest("[data-ca]");
    if (b && !e.metaKey && !e.ctrlKey) { e.preventDefault(); run(b.dataset.ca); }
  });
}

function fitFoot() {
  const el = $(".foot-big"); if (!el) return;
  el.style.fontSize = "80px";
  const w = el.scrollWidth;
  const avail = (el.parentElement?.clientWidth || el.clientWidth) * 0.9; // 0.9 leaves room for italic overhang
  if (!w || !avail) return;
  el.style.fontSize = Math.min(320, (80 * avail) / w) + "px";
}

function init() {
  applySite(); motion(); document.fonts?.ready.then(fitFoot); addEventListener("resize", fitFoot); wire(); clock(); renderRecent(); loadCases();
  loadLive(); setInterval(() => !document.hidden && loadLive(), 60000);
  const q = new URLSearchParams(location.search).get("ca") || (location.hash.match(/ca=([1-9A-HJ-NP-Za-km-z]{32,44})/) || [])[1];
  if (q) setTimeout(() => run(q, { push: false }), 300);
}
init();
