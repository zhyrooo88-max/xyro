const CREATOR = "Xtzyyy";
const VERSION = "4.0.0-cloudflare";

const ENDPOINTS = [
  { method: "POST", path: "/api/v1/capcut/create", category: "CapCut", description: "Create request. Wajib email.", params: [{ name: "email", type: "string", required: true }] },
  { method: "POST", path: "/api/v1/capcut/verify", category: "CapCut", description: "Verify request. Wajib email + code.", params: [{ name: "email", type: "string", required: true }, { name: "code", type: "string", required: true }] },
  { method: "GET", path: "/api/v1/nftoken-gen", category: "Utility", description: "Generate token acak lokal.", params: [] },
  { method: "POST", path: "/api/v1/alight-motion/send", category: "Alight Motion Premium", description: "Mengirim request send ke endpoint yang dikonfigurasi.", params: [{ name: "email", type: "string", required: true }] },
  { method: "POST", path: "/api/v1/alight-motion/verif", category: "Alight Motion Premium", description: "Mengirim request verify dengan email dan link.", params: [{ name: "email", type: "string", required: true }, { name: "link", type: "string", required: true }] },
  { method: "GET", path: "/api/v1/upstream/status", category: "System", description: "Cek status konfigurasi upstream tanpa membocorkan API key.", params: [] },
  { method: "GET", path: "/api/v1/plans", category: "Plans", description: "Daftar paket API yang tersedia.", params: [] },
  { method: "POST", path: "/api/v1/plans/buy", category: "Plans", description: "Membuat order aktivasi plan API. Ini bukan payment gateway.", params: [{ name: "plan", type: "string", required: true }, { name: "email", type: "string", required: true }] }
];

const PLANS = [
  { id: "developer", name: "Developer", price: 0, currency: "IDR", interval: "monthly", description: "Untuk testing, bot kecil, dan project pribadi.", features: ["API key access", "Core endpoints", "Document API", "Request console"] },
  { id: "premium", name: "Premium", price: 0, currency: "IDR", interval: "monthly", description: "Untuk aplikasi dan integrasi API dengan kebutuhan lebih tinggi.", features: ["Premium endpoints", "Global status", "Priority configuration", "Developer support"] },
  { id: "business", name: "Business", price: 0, currency: "IDR", interval: "monthly", description: "Deployment dan kebutuhan API khusus.", features: ["Custom integration", "Dedicated configuration", "Higher limits", "Technical assistance"] }
];

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

function normalizeUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(u.protocol) && u.hostname ? u : null;
  } catch (_) { return null; }
}

function apiKey(req) {
  const url = new URL(req.url);
  return req.headers.get("x-api-key") || req.headers.get("x-apikey") || url.searchParams.get("apikey") || "";
}

function requireAuth(req, env) {
  const key = String(env.API_KEY || "").trim();
  if (!key) return json({ status: false, creator: CREATOR, message: "API_KEY belum dikonfigurasi di Cloudflare Secrets" }, 503);
  if (apiKey(req) !== key) return json({ status: false, creator: CREATOR, message: "Invalid API key" }, 401);
  return null;
}

async function bodyObject(req) {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) return await req.json().catch(() => ({}));
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries((await req.formData()).entries());
  return {};
}

function required(obj, names) {
  return names.filter(n => !String(obj?.[n] ?? "").trim());
}

async function proxy(url, req, env, fields = {}) {
  const cleanFields = { ...fields }; delete cleanFields.apikey; delete cleanFields.externalApiKey;
  const target = normalizeUrl(url);
  if (!target) return json({ status: false, creator: CREATOR, message: "Upstream URL belum dikonfigurasi atau tidak valid" }, 501);
  for (const [k, v] of Object.entries(cleanFields)) if (v !== undefined && v !== "") target.searchParams.set(k, String(v));
  const headers = { accept: "application/json,text/plain,*/*", "user-agent": "XTZYYY-Premium-API/4.0" };
  if (env.EXTERNAL_API_KEY) headers["x-apikey"] = env.EXTERNAL_API_KEY;
  const init = { method: req.method, headers };
  if (req.method !== "GET") { headers["content-type"] = "application/json"; init.body = JSON.stringify(cleanFields); }
  try {
    const r = await fetch(target, init);
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    return json({ status: r.ok, creator: CREATOR, data }, r.status);
  } catch (e) {
    return json({ status: false, creator: CREATOR, message: "Upstream request failed", error: e.message }, 502);
  }
}

function uptimeHuman(seconds) {
  let s = Math.floor(seconds); const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

async function handleApi(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/health") return json({ status: true, service: "xtzyyy-premium-api", creator: CREATOR, version: VERSION, runtime: "cloudflare-workers", timestamp: new Date().toISOString() });

  if (path === "/api/v1/status/global") return json({ status: true, creator: CREATOR, timestamp: new Date().toISOString(), service: { name: "xtzyyy-premium-api", status: "online", version: VERSION, runtime: "cloudflare-workers", uptimeHuman: "edge runtime" }, scope: "core-api" });

  if (path === "/api/key") return env.API_KEY
    ? json({ status: true, creator: CREATOR, message: "API key tersedia dari Cloudflare Secret", data: { apiKey: env.API_KEY } })
    : json({ status: false, creator: CREATOR, message: "API_KEY belum dikonfigurasi" }, 503);

  if (path === "/api/key/status") return json({ status: true, creator: CREATOR, autoGenerated: false, configured: Boolean(env.API_KEY), keyFile: null, source: "Cloudflare Secret" });

  if (path === "/api/v1/docs") return json({ status: true, creator: CREATOR, version: VERSION, endpoints: ENDPOINTS });

  if (path === "/api/v1/plans" && req.method === "GET") return json({ status: true, creator: CREATOR, plans: PLANS });

  if (path === "/api/v1/plans/buy" && req.method === "POST") {
    const auth = requireAuth(req, env); if (auth) return auth;
    const b = await bodyObject(req); const missing = required(b, ["plan", "email"]);
    if (missing.length) return json({ status: false, creator: CREATOR, message: "Parameter wajib belum diisi", missing }, 400);
    const plan = PLANS.find(p => p.id === String(b.plan).toLowerCase());
    if (!plan) return json({ status: false, creator: CREATOR, message: "Plan tidak ditemukan", availablePlans: PLANS.map(p => p.id) }, 404);
    const orderId = `order_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    return json({ status: true, creator: CREATOR, message: "Order berhasil dibuat dan menunggu aktivasi admin", order: { id: orderId, plan: plan.id, email: String(b.email).trim(), status: "pending", createdAt: new Date().toISOString() }, note: "Endpoint ini membuat order aktivasi; proses pembayaran/settlement harus diintegrasikan dengan payment gateway resmi." }, 201);
  }

  if (path === "/api/v1/nftoken-gen" && req.method === "GET") {
    const auth = requireAuth(req, env); if (auth) return auth;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, "0")).join("");
    return json({ status: true, creator: CREATOR, data: { token, type: "hex", length: token.length } });
  }

  if (path === "/api/v1/upstream/status" && req.method === "GET") {
    const auth = requireAuth(req, env); if (auth) return auth;
    const u = normalizeUrl(env.EXTERNAL_API_URL);
    return json({ status: true, creator: CREATOR, configured: Boolean(u), url: u ? u.toString() : null, apiKeyConfigured: Boolean(env.EXTERNAL_API_KEY) });
  }

  const auth = requireAuth(req, env); if (auth) return auth;

  if (path === "/api/v1/capcut/create") {
    const b = await bodyObject(req); const missing = required(b, ["email"]); if (missing.length) return json({ status: false, creator: CREATOR, message: "Parameter wajib belum diisi", missing }, 400);
    return proxy(env.CAPCUT_CREATE_URL, req, env, b);
  }
  if (path === "/api/v1/capcut/verify") {
    const b = await bodyObject(req); const missing = required(b, ["email", "code"]); if (missing.length) return json({ status: false, creator: CREATOR, message: "Parameter wajib belum diisi", missing }, 400);
    return proxy(env.CAPCUT_VERIFY_URL, req, env, b);
  }
  if (path === "/api/v1/alight-motion/send" || path === "/api/v1/alight-motion/verif") {
    const b = await bodyObject(req); const names = path.endsWith("/verif") ? ["email", "link"] : ["email"]; const missing = required(b, names);
    if (missing.length) return json({ status: false, creator: CREATOR, message: "Parameter wajib belum diisi", missing }, 400);
    const target = env.ALIGHT_PREM_URL || (path.endsWith("/verif") ? env.ALIGHT_VERIFY_URL : env.ALIGHT_SEND_URL);
    const u = normalizeUrl(target); if (!u) return json({ status: false, creator: CREATOR, message: "Alight Motion upstream belum dikonfigurasi" }, 501);
    const headers = { "content-type": "application/json", accept: "application/json,text/plain,*/*", "user-agent": "XTZYYY-Premium-API/4.0" }; if (env.EXTERNAL_API_KEY) headers["x-apikey"] = env.EXTERNAL_API_KEY;
    try { const r = await fetch(u, { method: "POST", headers, body: JSON.stringify({ action: path.endsWith("/verif") ? "verify" : "send", ...(() => { const x={...b}; delete x.apikey; delete x.externalApiKey; return x; })() }) }); const text = await r.text(); let data; try { data = JSON.parse(text); } catch (_) { data = { raw: text }; } return json({ status: r.ok, creator: CREATOR, endpoint: path, data }, r.status); }
    catch (e) { return json({ status: false, creator: CREATOR, message: "Alight Motion upstream request failed", error: e.message }, 502); }
  }

  return json({ status: false, creator: CREATOR, message: "Endpoint not found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") return handleApi(request, env, ctx);
    return env.ASSETS.fetch(request);
  }
};
