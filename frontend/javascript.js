// ========= CONFIG =========
const POLL_MS = 2000;
const REQ_TIMEOUT_MS = 2500;
const MAX_ROWS = 600;

// ========= DOM refs =========
const activeBadge = document.getElementById("activeBadge");
const activeUrl = document.getElementById("activeUrl");
const priState = document.getElementById("priState");
const priCode = document.getElementById("priCode");
const priLat = document.getElementById("priLat");
const bakState = document.getElementById("bakState");
const bakCode = document.getElementById("bakCode");
const bakLat = document.getElementById("bakLat");
const btnData = document.getElementById("btnData");
const btnFail = document.getElementById("btnFail");
const btnRecover = document.getElementById("btnRecover");
const btnAuto = document.getElementById("btnAuto");
const rate = document.getElementById("rate");
const rateOut = document.getElementById("rateOut");
const btnClear = document.getElementById("btnClear");
const counters = document.getElementById("counters");
const wsState = document.getElementById("wsState");
const envBadge = document.getElementById("envBadge");
const backendHint = document.getElementById("backendHint");
const pollInfo = document.getElementById("pollInfo");
const logs = document.getElementById("logs");
const toast = document.getElementById("toast");

// ========= State =========
let API_BASE = "/api";
let WS_URL = null;
let lastActiveUrl = null;
let autoTimer = null;
let stats = { ok: 0, warn: 0, err: 0 };

// ========= Utils =========
const now = () => new Date().toLocaleTimeString();
const ms = (v) => (typeof v === "number" ? `${v} ms` : "—");
function setBadge(el, text, kind) {
  el.className = `badge ${kind}`;
  el.textContent = text;
}
function toastMsg(str) {
  toast.textContent = str;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}
function withTimeout(promise, ms = REQ_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  return {
    run: (url, opts = {}) =>
      fetch(url, { ...opts, signal: ctrl.signal }).finally(() =>
        clearTimeout(t)
      ),
  };
}
function addRow({ action, code, servedBy, latency, detail }) {
  const tr = document.createElement("tr");
  const dotClass =
    code === "ERR"
      ? "err"
      : typeof code === "number" && code >= 500
      ? "err"
      : typeof code === "number" && code >= 400
      ? "warn"
      : "ok";
  tr.innerHTML = `
    <td>${now()}</td>
    <td>${action}</td>
    <td><span class="dot ${dotClass}"></span> ${code ?? "—"}</td>
    <td>${servedBy || "—"}</td>
    <td>${latency ? `${latency} ms` : "—"}</td>
    <td class="muted">${detail || ""}</td>
  `;
  logs.prepend(tr);
  while (logs.rows.length > MAX_ROWS) logs.deleteRow(-1);
  if (dotClass === "ok") stats.ok++;
  else if (dotClass === "warn") stats.warn++;
  else stats.err++;
  counters.textContent = `OK: ${stats.ok} • Warn: ${stats.warn} • Err: ${stats.err}`;
}

// ========= Endpoint discovery =========
async function detectEndpoints() {
  try {
    const res = await fetch("/api/health", { method: "GET" });
    if (res.ok) {
      API_BASE = "/api";
      WS_URL =
        (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/ws";
      envBadge.textContent = "DOCKER";
      backendHint.textContent =
        "Same-origin via Nginx (proxy_pass → proxy:8021)";
      return;
    }
  } catch {}
  API_BASE = "http://localhost:8021";
  WS_URL = "ws://localhost:8021/log";
  envBadge.textContent = "LOCAL";
  backendHint.textContent = "Appels directs au proxy Go (8021).";
}

// ========= Health polling =========
async function pollHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const t0 = performance.now();
    const text = await res.text();
    const dt = Math.max(1, Math.round(performance.now() - t0));

    setBadge(
      activeBadge,
      lastActiveUrl
        ? lastActiveUrl.includes("backend-primary")
          ? "PRIMARY"
          : "BACKUP"
        : "ACTIF",
      lastActiveUrl?.includes("backend-primary")
        ? "primary"
        : lastActiveUrl?.includes("backend-spare")
        ? "backup"
        : "neutral"
    );
    activeUrl.textContent = lastActiveUrl || "";

    if (lastActiveUrl?.includes("backend-primary")) {
      setBadge(priState, res.ok ? "UP" : "DOWN", res.ok ? "ok" : "down");
      priCode.textContent = res.status;
      priLat.textContent = ms(dt);
      setBadge(bakState, "UNKNOWN", "neutral");
      bakCode.textContent = "—";
      bakLat.textContent = "—";
    } else if (lastActiveUrl?.includes("backend-spare")) {
      setBadge(bakState, res.ok ? "UP" : "DOWN", res.ok ? "ok" : "down");
      bakCode.textContent = res.status;
      bakLat.textContent = ms(dt);
      setBadge(priState, "UNKNOWN", "neutral");
      priCode.textContent = "—";
      priLat.textContent = "—";
    } else {
      setBadge(priState, "UNKNOWN", "neutral");
      setBadge(bakState, "UNKNOWN", "neutral");
      priCode.textContent = "—";
      priLat.textContent = "—";
      bakCode.textContent = "—";
      bakLat.textContent = "—";
    }
  } catch (e) {
    setBadge(activeBadge, "OFFLINE", "down");
    setBadge(priState, "UNKNOWN", "neutral");
    setBadge(bakState, "UNKNOWN", "neutral");
  }
}

// ========= Data =========
async function doData() {
  const t0 = performance.now();
  try {
    const { run } = withTimeout(null);
    const res = await run(`${API_BASE}/api/data`);
    const body = await res.text();
    const dt = Math.max(1, Math.round(performance.now() - t0));
    const servedBy = res.headers.get("X-Served-By") || lastActiveUrl || "";
    addRow({
      action: "GET /api/data",
      code: res.status,
      servedBy,
      latency: dt,
    });
  } catch (err) {
    const dt = Math.max(1, Math.round(performance.now() - t0));
    addRow({
      action: "GET /api/data",
      code: "ERR",
      latency: dt,
      detail: String(err?.message || err),
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========= Simulation Functions =========
async function simulateFailure() {
  const t0 = performance.now();
  try {
    const { run } = withTimeout(null);
    const res = await run(`${API_BASE}/fail`, { method: "POST" });
    toastMsg("Panne déclenchée sur le serveur actif");
    const dt = Math.max(1, Math.round(performance.now() - t0));
    addRow({
      action: "POST /fail",
      code: res.status,
      servedBy: lastActiveUrl || "",
      latency: dt,
    });
    const { latency, total, errorRate } = await pingUntilSuccess();

    addRow({
      action: "GET /health *" + total,
      code: res.status,
      servedBy: lastActiveUrl || "",
      latency,
      detail:
        "Serveur de nouveau actif après " +
        latency +
        "ms avec un taux d'erreur à " +
        errorRate +
        " %",
    });
  } catch (err) {
    const dt = Math.max(1, Math.round(performance.now() - t0));
    addRow({
      action: "POST /fail",
      code: "ERR",
      latency: dt,
      detail: String(err?.message || err),
    });
  }
}

const pingUntilSuccess = async () => {
  const t1 = performance.now();
  let total = 0;
  let fails = 0;
  let res = { status: 0 };
  const requests = [];

  while (res.status !== 200) {
    try {
      res = await fetch(`${API_BASE}/health`);
      total++;
      if (res.status !== 200) fails++;
      requests.push(res.status);
    } catch (e) {
      fails++;
      total++;
      requests.push("ERR");
    }finally{
      await sleep(100)
    }
  }

  const latency = Math.max(1, Math.round(performance.now() - t1));
  const errorRate = ((fails / total) * 100).toFixed(1);

  return {
    latency,
    errorRate,
    total,
  };
};

// ========= WebSocket =========
let ws = null;
function connectWS() {
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      wsState.textContent = "connecté";
      wsState.style.color = "#16a34a";
      console.log("WebSocket: Connected to reverse-proxy");
    };
    ws.onclose = () => {
      wsState.textContent = "fermé";
      wsState.style.color = "#ef4444";
      console.log("WebSocket: Disconnected from reverse-proxy");
      setTimeout(connectWS, 1500);
    };
    ws.onerror = () => {
      wsState.textContent = "erreur";
      wsState.style.color = "#ef4444";
      console.error("WebSocket: Connection error");
    };

    ws.onmessage = (ev) => {
      const msg = String(ev.data || "");
      console.log("Reverse-Proxy WebSocket:", msg);

      if (msg.startsWith("Proxying request:")) {
        const match = msg.match(/->\s+(\S+)/);
        if (match) {
          lastActiveUrl = match[1];
          activeUrl.textContent = lastActiveUrl;
          setBadge(
            activeBadge,
            lastActiveUrl.includes("backend-primary") ? "PRIMARY" : "BACKUP",
            lastActiveUrl.includes("backend-primary") ? "primary" : "backup"
          );
        }
      }
      if (msg.startsWith("Switching active target to:")) {
        if (msg.includes("backend-spare")) {
          setBadge(priState, "DOWN", "down");
          priCode.textContent = "—";
          priLat.textContent = "—";
        }
        toastMsg(msg.replace("Switching active target to:", "Bascule →"));
        addRow({
          action: "FAILOVER",
          code: "—",
          servedBy: lastActiveUrl || "",
          detail: msg,
        });
      }
    };
  } catch (e) {
    wsState.textContent = "échec";
    wsState.style.color = "#ef4444";
    console.error("WebSocket: Failed to connect", e);
  }
}

// ========= Auto-ping =========
function startAuto() {
  stopAuto();
  const itv = Math.max(100, Math.round(1000 / Number(rate.value)));
  autoTimer = setInterval(doData, itv);
  btnAuto.textContent = "Auto-ping : ON";
  btnAuto.classList.add("primary");
}

function stopAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  btnAuto.textContent = "Auto-ping : OFF";
  btnAuto.classList.remove("primary");
}

// ========= Wire UI =========
btnData.onclick = doData;
btnFail.onclick = simulateFailure;
btnAuto.onclick = () => (autoTimer ? stopAuto() : startAuto());
rate.oninput = () => {
  rateOut.textContent = `${rate.value} req/s`;
  if (autoTimer) startAuto();
};
btnClear.onclick = () => {
  logs.innerHTML = "";
  stats = { ok: 0, warn: 0, err: 0 };
  counters.textContent = "—";
};

// ========= Boot =========
(function boot() {
  pollInfo.textContent = `${POLL_MS / 1000}s`;
  rateOut.textContent = `${rate.value} req/s`;
  (async function () {
    await detectEndpoints();
    connectWS();
    await pollHealth();
    setInterval(pollHealth, POLL_MS);
  })();
})();
