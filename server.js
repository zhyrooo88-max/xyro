require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CREATOR = process.env.CREATOR || "Xtzyyy";
const DATA_DIR = path.join(__dirname, "data");
const KEY_FILE = path.join(DATA_DIR, "apikey.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

function getApiKey() {
  if (process.env.AUTO_API_KEY === "false") {
    return process.env.API_KEY || "";
  }

  try {
    const saved = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
    if (saved.apiKey) return saved.apiKey;
  } catch (_) {}

  const apiKey = "xtz_" + crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(
    KEY_FILE,
    JSON.stringify({
      apiKey,
      createdAt: new Date().toISOString()
    }, null, 2)
  );
  return apiKey;
}

const API_KEY = getApiKey();
const EXTERNAL_API_URL = String(process.env.EXTERNAL_API_URL || "").trim();
const EXTERNAL_API_KEY = String(process.env.EXTERNAL_API_KEY || "").trim();
const EXTERNAL_API_TIMEOUT_MS = Math.max(1000, Number(process.env.EXTERNAL_API_TIMEOUT_MS || 15000));
const ALIGHT_PREM_URL = String(process.env.ALIGHT_PREM_URL || "").trim();

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function upstreamHeaders(extra = {}) {
  const headers = {
    "accept": "application/json,text/plain,*/*",
    "user-agent": "XTZYYY-Premium-API/4.0",
    ...extra
  };
  if (EXTERNAL_API_KEY) headers["x-apikey"] = EXTERNAL_API_KEY;
  return headers;
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const endpoints = [
  {
    method: "POST",
    path: "/api/v1/capcut/create",
    category: "CapCut",
    description: "Create request. Wajib email. Mendukung POST dan GET test.",
    params: [{ name: "email", type: "string", required: true }]
  },
  {
    method: "POST",
    path: "/api/v1/capcut/verify",
    category: "CapCut",
    description: "Verify request. Wajib email + code. Mendukung POST dan GET test.",
    params: [
      { name: "email", type: "string", required: true },
      { name: "code", type: "string", required: true }
    ]
  },
  {
    method: "GET",
    path: "/api/v1/nftoken-gen",
    category: "Utility",
    description: "Generate token acak lokal.",
    params: []
  },
  {
    method: "POST",
    path: "/api/v1/alight-motion/send",
    category: "Alight Motion Premium",
    description: "Mengirim request send ke endpoint Alight Motion Premium yang dikonfigurasi.",
    params: [{ name: "email", type: "string", required: true }]
  },
  {
    method: "POST",
    path: "/api/v1/alight-motion/verif",
    category: "Alight Motion Premium",
    description: "Mengirim request verify dengan email dan link ke endpoint yang dikonfigurasi.",
    params: [
      { name: "email", type: "string", required: true },
      { name: "link", type: "string", required: true }
    ]
  },
  {
    method: "GET",
    path: "/api/v1/upstream/status",
    category: "System",
    description: "Cek status konfigurasi upstream tanpa membocorkan API key.",
    params: []
  }
];

function getRequestKey(req) {
  return (
    req.get("x-api-key") ||
    req.get("x-apikey") ||
    req.query.apikey ||
    req.body?.apikey ||
    ""
  );
}

function auth(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({
      status: false,
      creator: CREATOR,
      message: "API key belum dikonfigurasi"
    });
  }

  if (getRequestKey(req) !== API_KEY) {
    return res.status(401).json({
      status: false,
      creator: CREATOR,
      message: "Invalid API key"
    });
  }

  next();
}

function requireFields(names) {
  return (req, res, next) => {
    const source = req.method === "GET" ? req.query : (req.body || {});
    const missing = names.filter(name => !String(source[name] || "").trim());

    if (missing.length) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        message: "Parameter wajib belum diisi",
        missing
      });
    }
    next();
  };
}

async function proxy(url, req, res) {
  if (!url) {
    return res.status(501).json({
      status: false,
      creator: CREATOR,
      message: "Upstream URL belum dikonfigurasi di .env",
      hint: "Isi URL provider yang sah pada .env untuk endpoint proxy."
    });
  }

  try {
    const input = req.method === "GET" ? req.query : (req.body || {});
    const body = { ...input };
    delete body.apikey;

    const parsed = normalizeUrl(url);
    if (!parsed) {
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        message: "Upstream URL tidak valid",
        hint: "Gunakan URL lengkap seperti https://domain.tld/api/"
      });
    }
    let target = parsed;

    if (req.method === "GET") {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== "") {
          target.searchParams.set(key, String(value));
        }
      }
    }

    const headers = upstreamHeaders();

    const options = {
      method: req.method,
      headers
    };

    if (req.method !== "GET") {
      headers["content-type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetchWithTimeout(target.toString(), options);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    return res.status(response.status).json({
      status: response.ok,
      creator: CREATOR,
      data
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      creator: CREATOR,
      message: "Upstream request failed",
      error: error.name === "AbortError" ? `Upstream timeout after ${EXTERNAL_API_TIMEOUT_MS}ms` : error.message
    });
  }
}

function humanUptime(seconds) {
  seconds = Math.floor(seconds);
  const d = Math.floor(seconds / 86400); seconds %= 86400;
  const h = Math.floor(seconds / 3600); seconds %= 3600;
  const m = Math.floor(seconds / 60); const sec = seconds % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

app.get("/api/v1/status/global", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    status: true,
    creator: CREATOR,
    timestamp: new Date().toISOString(),
    service: {
      name: "xtzyyy-premium-api",
      status: "online",
      version: "3.2.0",
      uptime: process.uptime(),
      uptimeHuman: humanUptime(process.uptime())
    },
    scope: "core-api"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: true,
    service: "xtzyyy-premium-api",
    creator: CREATOR,
    version: "3.2.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/key", (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    message: "API key otomatis tersedia",
    data: {
      apiKey: API_KEY
    }
  });
});

app.get("/api/v1/upstream/status", auth, (req, res) => {
  const parsed = normalizeUrl(EXTERNAL_API_URL);
  res.json({
    status: true,
    creator: CREATOR,
    configured: Boolean(parsed),
    url: parsed ? parsed.toString() : null,
    apiKeyConfigured: Boolean(EXTERNAL_API_KEY),
    timeoutMs: EXTERNAL_API_TIMEOUT_MS
  });
});

app.get("/api/key/status", (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    autoGenerated: process.env.AUTO_API_KEY !== "false",
    configured: Boolean(API_KEY),
    keyFile: "data/apikey.json"
  });
});

app.get("/api/v1/docs", (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    endpoints
  });
});

app.get("/api/v1/config", (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    externalConfigured: Boolean(normalizeUrl(EXTERNAL_API_URL)),
    externalUrl: normalizeUrl(EXTERNAL_API_URL)?.origin || null,
    externalApiKeyConfigured: Boolean(EXTERNAL_API_KEY),
    alightMotionPremConfigured: Boolean(normalizeUrl(ALIGHT_PREM_URL)),
    alightMotionPremUrl: normalizeUrl(ALIGHT_PREM_URL)?.origin || null,
    timeoutMs: EXTERNAL_API_TIMEOUT_MS
  });
});


app.get("/api/v1/capcut/create", auth, requireFields(["email"]), (req, res) =>
  proxy(process.env.CAPCUT_CREATE_URL, req, res)
);

app.post("/api/v1/capcut/create", auth, requireFields(["email"]), (req, res) =>
  proxy(process.env.CAPCUT_CREATE_URL, req, res)
);


app.get("/api/v1/capcut/verify", auth, requireFields(["email", "code"]), (req, res) =>
  proxy(process.env.CAPCUT_VERIFY_URL, req, res)
);

app.post("/api/v1/capcut/verify", auth, requireFields(["email", "code"]), (req, res) =>
  proxy(process.env.CAPCUT_VERIFY_URL, req, res)
);

app.get("/api/v1/nftoken-gen", auth, (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");

  res.json({
    status: true,
    creator: CREATOR,
    data: {
      token,
      type: "hex",
      length: token.length
    }
  });
});


async function alightMotionPrem(action, req, res) {
  if (!ALIGHT_PREM_URL) {
    return res.status(501).json({
      status: false,
      creator: CREATOR,
      message: "ALIGHT_PREM_URL belum dikonfigurasi di .env",
      hint: "Isi dengan endpoint upstream yang sah/diizinkan."
    });
  }

  const parsed = normalizeUrl(ALIGHT_PREM_URL);
  if (!parsed) {
    return res.status(500).json({
      status: false,
      creator: CREATOR,
      message: "ALIGHT_PREM_URL tidak valid"
    });
  }

  const input = req.method === "GET" ? req.query : (req.body || {});
  const email = String(input.email || "").trim();
  const link = String(input.link || "").trim();

  if (!email || (action === "verify" && !link)) {
    return res.status(400).json({
      status: false,
      creator: CREATOR,
      message: "Parameter wajib belum diisi",
      missing: [
        ...(!email ? ["email"] : []),
        ...(action === "verify" && !link ? ["link"] : [])
      ]
    });
  }

  try {
    const payload = { action, email };
    if (action === "verify") payload.link = link;

    const response = await fetchWithTimeout(parsed.toString(), {
      method: "POST",
      headers: upstreamHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: text }; }

    return res.status(response.status).json({
      status: response.ok,
      creator: CREATOR,
      endpoint: `/api/v1/alight-motion/${action === "send" ? "send" : "verif"}`,
      upstream: parsed.toString(),
      data
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      creator: CREATOR,
      message: "Alight Motion upstream request failed",
      error: error.name === "AbortError"
        ? `Upstream timeout after ${EXTERNAL_API_TIMEOUT_MS}ms`
        : error.message
    });
  }
}

app.get("/api/v1/alight-motion/send", auth, (req, res) => alightMotionPrem("send", req, res));
app.post("/api/v1/alight-motion/send", auth, (req, res) => alightMotionPrem("send", req, res));
app.get("/api/v1/alight-motion/verif", auth, (req, res) => alightMotionPrem("verify", req, res));
app.post("/api/v1/alight-motion/verif", auth, (req, res) => alightMotionPrem("verify", req, res));


// Generic multipart/form-data proxy for custom /api/ requests.
// Uses only user-supplied form fields and the local API key.
// File uploads are intentionally not handled by this endpoint.
app.post("/api/custom-post", auth, async (req, res) => {
  const target = String(req.body?.target || "https://api.xtzyyy.my.id/api/").trim();
  const fields = req.body?.fields;

  if (!/^https:\/\//i.test(target)) {
    return res.status(400).json({
      status: false,
      creator: CREATOR,
      message: "Target URL harus menggunakan HTTPS"
    });
  }

  let parsedFields = {};
  try {
    parsedFields = typeof fields === "string" ? JSON.parse(fields || "{}") : (fields || {});
  } catch (_) {
    return res.status(400).json({
      status: false,
      creator: CREATOR,
      message: "fields harus berupa JSON object"
    });
  }

  try {
    const form = new FormData();

    for (const [name, value] of Object.entries(parsedFields)) {
      if (name && value !== undefined && value !== null) {
        form.append(String(name), String(value));
      }
    }

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "x-apikey": getRequestKey(req),
        "user-agent": "XTZYYY-Premium-API/3.1"
      },
      body: form
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

    return res.status(upstream.status).json({
      http_status: upstream.status,
      data
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      creator: CREATOR,
      message: "Custom upstream request failed",
      error: error.message
    });
  }
});


app.post("/api/v1/xtzyyy/test", auth, async (req, res) => {
  if (!EXTERNAL_API_URL) {
    return res.status(501).json({
      status: false,
      creator: CREATOR,
      message: "EXTERNAL_API_URL belum dikonfigurasi di .env",
      hint: "Isi EXTERNAL_API_URL dengan URL lengkap, contoh https://domain.tld/api/"
    });
  }

  try {
    const fields = req.body?.fields && typeof req.body.fields === "object"
      ? req.body.fields
      : {};

    const externalKey = String(req.body?.externalApiKey || EXTERNAL_API_KEY || "").trim();
    const form = new FormData();

    for (const [name, value] of Object.entries(fields)) {
      if (name && value !== undefined && value !== null) {
        form.append(String(name), String(value));
      }
    }

    const externalTarget = normalizeUrl(EXTERNAL_API_URL);
    if (!externalTarget) return res.status(500).json({ status: false, creator: CREATOR, message: "EXTERNAL_API_URL tidak valid" });
    const response = await fetchWithTimeout(externalTarget.toString(), {
      method: "POST",
      headers: externalKey ? { "x-apikey": externalKey } : {},
      body: form
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: text }; }

    return res.status(response.status).json({
      status: response.ok,
      creator: CREATOR,
      upstream: externalTarget.toString(),
      data
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      creator: CREATOR,
      upstream: EXTERNAL_API_URL,
      message: "External API request failed",
      error: error.message
    });
  }
});

app.get("/api/v1/xtzyyy/test", auth, async (req, res) => {
  if (!EXTERNAL_API_URL) {
    return res.status(501).json({
      status: false,
      creator: CREATOR,
      message: "EXTERNAL_API_URL belum dikonfigurasi di .env",
      hint: "Isi EXTERNAL_API_URL dengan URL lengkap, contoh https://domain.tld/api/"
    });
  }

  try {
    const externalTarget = normalizeUrl(EXTERNAL_API_URL);
    if (!externalTarget) return res.status(500).json({ status: false, creator: CREATOR, message: "EXTERNAL_API_URL tidak valid" });
    const response = await fetchWithTimeout(externalTarget.toString(), {
      method: "GET",
      headers: upstreamHeaders((req.get("x-apikey") || req.get("x-api-key")) ? { "x-apikey": req.get("x-apikey") || req.get("x-api-key") } : {})
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: text }; }

    return res.status(response.status).json({
      status: response.ok,
      creator: CREATOR,
      upstream: EXTERNAL_API_URL,
      data
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      creator: CREATOR,
      upstream: EXTERNAL_API_URL,
      message: "External GET request failed",
      error: error.message
    });
  }
});


app.get("/api/v1/external/test", auth, async (req, res) => {
  if (!EXTERNAL_API_URL) {
    return res.status(501).json({
      status: false,
      creator: CREATOR,
      message: "EXTERNAL_API_URL belum dikonfigurasi di .env",
      hint: "Isi EXTERNAL_API_URL dengan URL lengkap, contoh https://domain.tld/api/"
    });
  }

  try {
    const target = normalizeUrl(EXTERNAL_API_URL);
    if (!target) return res.status(500).json({ status: false, creator: CREATOR, message: "EXTERNAL_API_URL tidak valid" });
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key !== "apikey" && value !== undefined && value !== "") {
        target.searchParams.set(key, String(value));
      }
    }
    const externalKey = String(req.query.externalApiKey || EXTERNAL_API_KEY || "").trim();
    const response = await fetchWithTimeout(target.toString(), {
      method: "GET",
      headers: externalKey ? { "x-apikey": externalKey } : {}
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    return res.status(response.status).json({
      status: response.ok,
      creator: CREATOR,
      upstream: EXTERNAL_API_URL,
      data
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      creator: CREATOR,
      message: "External GET request failed",
      error: error.message
    });
  }
});

app.post("/api/v1/external/test", auth, async (req, res) => {
  if (!EXTERNAL_API_URL) {
    return res.status(501).json({
      status: false,
      creator: CREATOR,
      message: "EXTERNAL_API_URL belum dikonfigurasi di .env"
    });
  }

  try {
    const fields = req.body?.fields && typeof req.body.fields === "object"
      ? req.body.fields : {};
    const externalKey = String(req.body?.externalApiKey || EXTERNAL_API_KEY || "").trim();
    const form = new FormData();

    for (const [name, value] of Object.entries(fields)) {
      if (name) form.append(String(name), String(value ?? ""));
    }

    const externalTarget = normalizeUrl(EXTERNAL_API_URL);
    if (!externalTarget) return res.status(500).json({ status: false, creator: CREATOR, message: "EXTERNAL_API_URL tidak valid" });
    const upstream = await fetchWithTimeout(externalTarget.toString(), {
      method: "POST",
      headers: externalKey ? { "x-apikey": externalKey } : {},
      body: form
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

    res.status(upstream.status).json({
      status: upstream.ok,
      creator: CREATOR,
      data
    });
  } catch (error) {
    res.status(502).json({
      status: false,
      creator: CREATOR,
      message: "External request failed",
      error: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    status: false,
    creator: CREATOR,
    message: "Endpoint not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║       XTZYYY PREMIUM REST API        ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Server : http://127.0.0.1:${PORT}`);
  console.log(`Health : http://127.0.0.1:${PORT}/health`);
  console.log(`Docs   : http://127.0.0.1:${PORT}/api/v1/docs`);
  console.log(`Key    : http://127.0.0.1:${PORT}/api/key`);
  console.log(`API Key: ${API_KEY || "(not configured)"}`);
  console.log("");
});
