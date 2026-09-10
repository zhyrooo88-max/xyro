const state = { apiKey: "", endpoints: [] };

const $ = (s, el = document) => el.querySelector(s);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function load() {
  try {
    const [keyRes, docsRes, configRes] = await Promise.all([
      fetch("/api/key"),
      fetch("/api/v1/docs"),
      fetch("/api/v1/config")
    ]);
    const keyData = await keyRes.json();
    const docsData = await docsRes.json();
    const configData = await configRes.json();

    state.apiKey = keyData?.data?.apiKey || "";
    state.endpoints = docsData?.endpoints || [];

    $("#keyValue").textContent = state.apiKey || "Unavailable";
    $("#year").textContent = new Date().getFullYear();
    render(state.endpoints);
    const ext = document.querySelector("#externalRequestUrl");
    if (ext) ext.textContent = "Request URL: " + new URL("/api/v1/external/test", location.origin).toString();
    const configured = document.querySelector("#externalConfiguredUrl");
    if (configured) configured.textContent = configData?.externalConfigured
      ? "EXTERNAL_API_URL CONFIGURED"
      : "NOT CONFIGURED";
    const alight = document.querySelector("#alightConfiguredUrl");
    if (alight) alight.textContent = configData?.alightMotionPremConfigured
      ? "ALIGHT MOTION PREMIUM UPSTREAM CONFIGURED"
      : "ALIGHT MOTION PREMIUM UPSTREAM NOT CONFIGURED";
  } catch (error) {
    $("#keyValue").textContent = "Failed to load";
    $("#endpointList").innerHTML =
      `<div class="endpoint"><div class="ep-body" style="display:block">Failed to load documentation.</div></div>`;
  }
}

function render(items) {
  const box = $("#endpointList");
  if (!items.length) {
    box.innerHTML = `<div class="endpoint"><div class="ep-body" style="display:block">No endpoints found.</div></div>`;
    return;
  }

  box.innerHTML = items.map((ep, index) => {
    const params = ep.params || [];
    const fields = params.length
      ? params.map(p => `
          <div class="param">
            <label>${esc(p.name)} ${p.required ? '<span class="required">*</span>' : ''}</label>
            <input data-param="${esc(p.name)}"
                   placeholder="${esc(p.name)}"
                   ${p.name === "link" ? 'type="url"' : ""}>
          </div>
        `).join("")
      : `<div class="empty-param">No additional parameters.</div>`;

    return `
      <article class="endpoint" data-index="${index}">
        <div class="ep-head">
          <div class="method">${esc(ep.method)}</div>
          <div class="ep-main">
            <div class="category">${esc(ep.category)}</div>
            <div class="path">${esc(ep.path)}</div>
          </div>
          <div class="chevron">⌄</div>
        </div>

        <div class="ep-body">
          <div class="description">${esc(ep.description)}</div>

          <div class="request-title">
            <span>REQUEST CONSOLE</span>
            <span class="auth-chip">API KEY: AUTOMATIC</span>
          </div>

          <div class="params">${fields}</div>

          <div class="request-bar" data-url>
            Request URL: ${location.origin}${esc(ep.path)}
          </div>

          <div class="actions">
            <button class="send send-default" type="button">Send Request ${esc(ep.method)}</button>
            <button class="get-test" type="button">Send Request GET</button>
            <button class="clear" type="button">Clear</button>
            <button class="copy-request" type="button">Copy Request</button>
          </div>

          <div class="response">
            <div class="response-title">RESPONSE</div>
            <pre data-response>Belum ada request.</pre>
          </div>
        </div>
      </article>
    `;
  }).join("");

  box.querySelectorAll(".ep-head").forEach(head => {
    head.addEventListener("click", () => head.parentElement.classList.toggle("open"));
  });

  box.querySelectorAll(".send-default").forEach(btn =>
    btn.addEventListener("click", () => send(btn.closest(".endpoint"), getEndpoint(btn.closest(".endpoint")).method))
  );

  box.querySelectorAll(".get-test").forEach(btn =>
    btn.addEventListener("click", () => send(btn.closest(".endpoint"), "GET"))
  );

  box.querySelectorAll(".clear").forEach(btn =>
    btn.addEventListener("click", () => {
      const card = btn.closest(".endpoint");
      card.querySelectorAll("input").forEach(i => i.value = "");
      card.querySelector("[data-response]").textContent = "Belum ada request.";
      updateUrl(card);
    })
  );

  box.querySelectorAll(".copy-request").forEach(btn =>
    btn.addEventListener("click", () => copyRequest(btn.closest(".endpoint")))
  );

  box.querySelectorAll("input").forEach(input =>
    input.addEventListener("input", () => updateUrl(input.closest(".endpoint")))
  );
}

function getEndpoint(card) {
  return state.endpoints[Number(card.dataset.index)];
}

function getValues(card) {
  const values = {};
  card.querySelectorAll("input[data-param]").forEach(input => {
    if (input.value.trim()) values[input.dataset.param] = input.value.trim();
  });
  return values;
}

function buildUrl(card, method = null) {
  const ep = getEndpoint(card);
  const actualMethod = method || ep.method;
  const url = new URL(ep.path, location.origin);

  if (actualMethod === "GET") {
    url.searchParams.set("apikey", state.apiKey);
    for (const [key, value] of Object.entries(getValues(card))) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function updateUrl(card) {
  if (!card) return;
  card.querySelector("[data-url]").textContent =
    "Request URL: " + buildUrl(card, getEndpoint(card).method).toString();
}

function curlCommand(card, method = null) {
  const ep = getEndpoint(card);
  const actualMethod = method || ep.method;
  const values = getValues(card);
  const url = buildUrl(card, actualMethod).toString();

  if (actualMethod === "GET") {
    return `curl -X GET "${url}" -H "x-api-key: ${state.apiKey}"`;
  }

  return `curl -X ${actualMethod} "${url}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${state.apiKey}" \\
  -d '${JSON.stringify(values)}'`;
}

async function copyRequest(card) {
  const method = getEndpoint(card).method;
  const text = curlCommand(card, method);
  try {
    await navigator.clipboard.writeText(text);
    alert("Contoh request berhasil disalin.");
  } catch (_) {
    prompt("Copy request:", text);
  }
}

async function send(card, method) {
  const responseBox = card.querySelector("[data-response]");
  const values = getValues(card);
  const url = buildUrl(card, method);

  responseBox.textContent = "Sending request...";
  card.querySelector("[data-url]").textContent = "Request URL: " + url.toString();

  try {
    const options = {
      method,
      headers: { "x-api-key": state.apiKey }
    };

    if (method !== "GET") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(values);
    }

    card.querySelector("[data-url]").textContent =
      "Request URL: " + url.toString();

    const response = await fetch(url.toString(), options);
    const text = await response.text();

    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: text }; }

    responseBox.textContent = JSON.stringify({
      http_status: response.status,
      method,
      endpoint: getEndpoint(card).path,
      data
    }, null, 2);
  } catch (error) {
    responseBox.textContent = JSON.stringify({
      status: false,
      method,
      error: error.message
    }, null, 2);
  }
}

function getCustomFields() {
  const result = {};
  document.querySelectorAll("#customFields .custom-field").forEach(row => {
    const name = row.querySelector("[data-field-name]")?.value.trim();
    const value = row.querySelector("[data-field-value]")?.value ?? "";
    if (name) result[name] = value;
  });
  return result;
}

function addCustomField(name = "", value = "") {
  const box = $("#customFields");
  const row = document.createElement("div");
  row.className = "custom-field external-grid";
  row.innerHTML = `
    <div class="param"><input data-field-name placeholder="field name" value="${esc(name)}"></div>
    <div class="param"><input data-field-value placeholder="value" value="${esc(value)}"></div>
    <button class="clear" type="button">Remove</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  box.appendChild(row);
}

async function externalRequest(method) {
  const responseBox = $("#externalResponse");
  const url = new URL("/api/v1/external/test", location.origin);
  const fields = getCustomFields();
  const externalKey = $("#externalApiKey")?.value.trim() || "";

  if (method === "GET") {
    for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  }

  $("#externalRequestUrl").textContent = "Request URL: " + url.toString();
  responseBox.textContent = "Sending request...";

  try {
    const headers = { "x-api-key": state.apiKey };
    const options = { method, headers };
    if (externalKey) headers["x-external-api-key"] = externalKey;
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify({ fields, externalApiKey: externalKey });
    }

    const response = await fetch(url.toString(), options);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    responseBox.textContent = JSON.stringify({ http_status: response.status, method, data }, null, 2);
  } catch (error) {
    responseBox.textContent = JSON.stringify({ status: false, method, error: error.message }, null, 2);
  }
}

async function refreshStatus() {
  const labels = [$("#serviceStatus"), $("#statusWideText")].filter(Boolean);
  const details = [$("#statusDetail"), $("#statusWideDetail")].filter(Boolean);
  const dots = [$("#serviceDot"), $("#statusDot2")].filter(Boolean);
  labels.forEach(el => el.textContent = "Checking...");
  details.forEach(el => el.textContent = "Memeriksa health endpoint...");
  dots.forEach(el => el.classList.remove("online", "offline"));
  try {
    const started = performance.now();
    const response = await fetch("/health", { cache: "no-store" });
    const data = await response.json();
    const ms = Math.round(performance.now() - started);
    const online = response.ok && data?.status === true;
    labels.forEach(el => el.textContent = online ? "ONLINE" : "DEGRADED");
    details.forEach(el => el.textContent = `${data?.service || "XTZYYY Premium API"} · HTTP ${response.status} · ${ms} ms`);
    dots.forEach(el => el.classList.add(online ? "online" : "offline"));
  } catch (error) {
    labels.forEach(el => el.textContent = "OFFLINE");
    details.forEach(el => el.textContent = "Health endpoint tidak dapat diakses: " + error.message);
    dots.forEach(el => el.classList.add("offline"));
  }
}

async function copyKey() {
  if (!state.apiKey) return;
  try {
    await navigator.clipboard.writeText(state.apiKey);
    alert("API key berhasil disalin.");
  } catch (_) {
    prompt("Copy API key:", state.apiKey);
  }
}

$("#copyKey").addEventListener("click", copyKey);
$("#copyKeyTop").addEventListener("click", copyKey);
$("#copyKeyHero").addEventListener("click", copyKey);
$("#addField")?.addEventListener("click", () => addCustomField());
$("#testPost")?.addEventListener("click", () => externalRequest("POST"));
$("#testGet")?.addEventListener("click", () => externalRequest("GET"));
$("#refreshStatus")?.addEventListener("click", refreshStatus);
$("#refreshStatus2")?.addEventListener("click", refreshStatus);

$("#search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  render(state.endpoints.filter(ep =>
    `${ep.method} ${ep.path} ${ep.category} ${ep.description}`
      .toLowerCase().includes(q)
  ));
});

$("#year").textContent = new Date().getFullYear();
load();
refreshStatus();
