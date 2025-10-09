// ========= CONFIG =========
// Mode Docker (même origine) : on passe par Nginx -> /api et /ws
// Mode local (sans Docker) : fallback auto vers http://localhost:8021 et ws://localhost:8021/log

const POLL_MS = 2000;        // période du poll de santé
const REQ_TIMEOUT_MS = 2500; // timeout requêtes data/fail/recover
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
let API_BASE = "/api";         // utilisera nginx.conf en Docker ; fallback local si indisponible
let WS_URL = null;             // défini dynamiquement
let lastActiveUrl = null;
let autoTimer = null;
let stats = {ok:0,warn:0,err:0};

// ========= Utils =========
const now = () => new Date().toLocaleTimeString();
const ms = v => (typeof v === "number" ? `${v} ms` : "—");
function setBadge(el, text, kind){
  el.className = `badge ${kind}`; el.textContent = text;
}
function toastMsg(str){ toast.textContent = str; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), 1500); }
function withTimeout(promise, ms=REQ_TIMEOUT_MS){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort("timeout"), ms);
  return { run: (url, opts={}) => fetch(url, {...opts, signal: ctrl.signal}).finally(()=>clearTimeout(t)) };
}
function addRow({action, code, servedBy, latency, detail}){
  const tr = document.createElement("tr");
  const dotClass = code === "ERR" ? "err" : (typeof code === "number" && code >=500) ? "err" : (typeof code === "number" && code >=400) ? "warn" : "ok";
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
  if(dotClass==="ok") stats.ok++; else if(dotClass==="warn") stats.warn++; else stats.err++;
  counters.textContent = `OK: ${stats.ok} • Warn: ${stats.warn} • Err: ${stats.err}`;
}

// ========= Endpoint discovery (Docker vs Local) =========
async function detectEndpoints(){
  // Try same-origin (Docker via nginx.conf -> /api -> proxy:8021)
  try{
    const res = await fetch("/api/health", { method:"GET" });
    if (res.ok) {
      API_BASE = "/api";
      WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
      envBadge.textContent = "DOCKER";
      backendHint.textContent = "Same-origin via Nginx (proxy_pass → proxy:8021)";
      return;
    }
  }catch{}
  // Fallback local dev
  API_BASE = "http://localhost:8021";
  WS_URL = "ws://localhost:8021/log";
  envBadge.textContent = "LOCAL";
  backendHint.textContent = "Appels directs au proxy Go (8021). Assure-toi qu'il tourne.";
}

// ========= Health polling =========
async function pollHealth(){
  try{
    const res = await fetch(`${API_BASE}/health`);
    const t0 = performance.now();
    const text = await res.text(); // backends renvoient souvent texte simple "OK" / payload
    const dt = Math.max(1, Math.round(performance.now() - t0));

    // On ne connaît pas l'état détaillé des 2 cibles via un endpoint agrégé.
    // On déduit l'actif via WebSocket (routage) + on montre latence de l'appel.
    setBadge(activeBadge, lastActiveUrl ? (lastActiveUrl.includes("8022") ? "PRIMARY" : "BACKUP") : "ACTIF", lastActiveUrl?.includes("8022") ? "primary" : lastActiveUrl?.includes("8023") ? "backup" : "neutral");
    activeUrl.textContent = lastActiveUrl || "";

    // On affiche la latence sur la cible active (approx via /health)
    if(lastActiveUrl?.includes("8022")){
      setBadge(priState, res.ok ? "UP" : "DOWN", res.ok ? "ok" : "down");
      priCode.textContent = res.status;
      priLat.textContent = ms(dt);
    } else if(lastActiveUrl?.includes("8023")){
      setBadge(bakState, res.ok ? "UP" : "DOWN", res.ok ? "ok" : "down");
      bakCode.textContent = res.status;
      bakLat.textContent = ms(dt);
    } else {
      // inconnu (avant 1er log)
      priLat.textContent = "—"; bakLat.textContent = "—";
    }
  }catch(e){
    setBadge(activeBadge, "OFFLINE", "down");
  }
}

// ========= Data / Fail / Recover =========
async function doData(){
  const t0 = performance.now();
  try{
    const { run } = withTimeout(null);
    const res = await run(`${API_BASE}/data`);
    const body = await res.text();
    const dt = Math.max(1, Math.round(performance.now() - t0));
    // Essayez de lire X-Served-By si ajouté côté proxy (sinon laisser vide)
    const servedBy = res.headers.get("X-Served-By") || (lastActiveUrl || "");
    addRow({action:"GET /data", code:res.status, servedBy, latency:dt});
  }catch(err){
    const dt = Math.max(1, Math.round(performance.now() - t0));
    addRow({action:"GET /data", code:"ERR", latency:dt, detail:String(err?.message || err)});
  }
}

async function doPost(path, label){
  const t0 = performance.now();
  try{
    const { run } = withTimeout(null);
    const res = await run(`${API_BASE}${path}`, { method:"POST" });
    const dt = Math.max(1, Math.round(performance.now() - t0));
    addRow({action:`POST ${path}`, code:res.status, servedBy:(lastActiveUrl||""), latency:dt});
    toastMsg(label);
  }catch(err){
    const dt = Math.max(1, Math.round(performance.now() - t0));
    addRow({action:`POST ${path}`, code:"ERR", latency:dt, detail:String(err?.message || err)});
  }
}

// ========= WebSocket logs (live) =========
let ws = null;
function connectWS(){
  try{
    ws = new WebSocket(WS_URL);
    ws.onopen = ()=> { wsState.textContent = "connecté"; wsState.style.color = "#16a34a"; };
    ws.onclose = ()=> { wsState.textContent = "fermé"; wsState.style.color = "#ef4444"; setTimeout(connectWS, 1500); };
    ws.onerror = ()=> { wsState.textContent = "erreur"; wsState.style.color = "#ef4444"; };

    ws.onmessage = (ev)=>{
      const msg = String(ev.data || "");
      // Exemple de log : "Proxying request: /data -> http://localhost:8022"
      if (msg.startsWith("Proxying request:")) {
        const match = msg.match(/->\s+(\S+)/);
        if (match) {
          lastActiveUrl = match[1];
          activeUrl.textContent = lastActiveUrl;
          setBadge(activeBadge, lastActiveUrl.includes("8022") ? "PRIMARY" : lastActiveUrl.includes("8023") ? "BACKUP" : "ACTIF",
            lastActiveUrl.includes("8022") ? "primary" : lastActiveUrl.includes("8023") ? "backup" : "neutral");
        }
      }
      if (msg.startsWith("Switching active target to:")){
        toastMsg(msg.replace("Switching active target to:", "Bascule →"));
        addRow({action:"FAILOVER", code:"—", servedBy: lastActiveUrl||"", detail: msg});
      }
      // Affichage brut du log WS (optionnel) :
      // addRow({action:"WS", code:"—", detail: msg});
    };
  }catch(e){
    wsState.textContent = "échec";
    wsState.style.color = "#ef4444";
  }
}

// ========= Auto-ping =========
function startAuto(){ stopAuto(); const itv = Math.max(100, Math.round(1000/Number(rate.value))); autoTimer = setInterval(doData, itv); btnAuto.textContent = "Auto-ping : ON"; btnAuto.classList.add("primary"); }
function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer = null; } btnAuto.textContent = "Auto-ping : OFF"; btnAuto.classList.remove("primary"); }

// ========= Wire UI =========
btnData.onclick = doData;
btnFail.onclick = ()=> doPost("/fail","Panne simulée sur la cible active");
btnRecover.onclick = ()=> doPost("/recover","Cible active récupérée");
btnAuto.onclick = ()=> (autoTimer ? stopAuto() : startAuto());
rate.oninput = ()=>{ rateOut.textContent = `${rate.value} req/s`; if(autoTimer) startAuto(); };
btnClear.onclick = ()=>{ logs.innerHTML = ""; stats = {ok:0,warn:0,err:0}; counters.textContent = "—"; };

// ========= Boot =========
(async function boot(){
  pollInfo.textContent = `${POLL_MS/1000}s`;
  rateOut.textContent = `${rate.value} req/s`;
  await detectEndpoints();
  connectWS();
  await pollHealth();
  setInterval(pollHealth, POLL_MS);
})();
