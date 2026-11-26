// Optional tiny backend (Cloudflare Worker, free tier).
// pump.fun's API only answers browsers on pump.fun itself (CORS), so the
// static site can't call it directly. Deploy this, then set `backendUrl`
// in config.js to the worker URL to switch on pump.fun search.
//
//   npx wrangler deploy worker/pump-proxy.js --name vamp-hunter-api
//
// Routes
//   GET /pump/search?q=pepe   → pump.fun coins matching q (oldest first)
//   GET /x/earliest?q=..&until=..  → reserved for the X API (needs X_BEARER secret)

const PUMP = "https://frontend-api-v3.pump.fun";
const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "content-type": "application/json" };

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    try {
      if (url.pathname === "/pump/search") {
        const q = (url.searchParams.get("q") || "").slice(0, 60);
        const r = await fetch(`${PUMP}/coins/search-v2?searchTerm=${encodeURIComponent(q)}&limit=50&offset=0&sort=created_timestamp&order=ASC&includeNsfw=false`, {
          headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
          cf: { cacheTtl: 120 },
        });
        const body = await r.text();
        return new Response(r.ok ? body : "[]", { headers: { ...cors, "cache-control": "public, max-age=120" } });
      }
      if (url.pathname === "/x/earliest") {
        if (!env.X_BEARER) return new Response(JSON.stringify({ earliest: [] }), { headers: cors });
        const q = url.searchParams.get("q") || "";
        const until = url.searchParams.get("until");
        // Full-archive search needs X API Pro; recent search covers the last 7 days.
        const api = new URL("https://api.x.com/2/tweets/search/recent");
        api.searchParams.set("query", `${q} -is:retweet`);
        api.searchParams.set("max_results", "50");
        api.searchParams.set("tweet.fields", "created_at,author_id");
        api.searchParams.set("expansions", "author_id");
        if (until) api.searchParams.set("end_time", new Date(+until).toISOString());
        const r = await fetch(api, { headers: { authorization: `Bearer ${env.X_BEARER}` } });
        const j = await r.json();
        const users = Object.fromEntries((j.includes?.users || []).map((u) => [u.id, u.username]));
        const earliest = (j.data || []).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 5)
          .map((t) => ({ url: `https://x.com/i/status/${t.id}`, text: t.text, createdAt: Date.parse(t.created_at), author: users[t.author_id] || "" }));
        return new Response(JSON.stringify({ earliest }), { headers: cors });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: cors });
    }
  },
};
