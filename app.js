/* ============================================================
   LITPAX CHECKLISTS – Frontend
   Checklists Google Sheet se load hote hain (dynamic).
   Naya checklist app ke builder se ya seedhe Sheet se add ho sakta hai.
   ============================================================ */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwaJBgkCz9ev4Uj56Lsd_OcinAyBxzphVUZxnoTWo1odTZ5cDd6UB5IAxi5eezqQ2Ih9A/exec";

let CHECKLISTS = [];        // Sheet se aaya data
let current    = null;      // abhi khula checklist object
let answers    = {};        // { itemIndex: value }
let submitted  = {};        // aaj kaun se submit ho gaye (localStorage)

/* ---------- Boot ---------- */
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("todayDate").textContent = new Date()
    .toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  submitted = loadState();
  loadChecklists();

  document.getElementById("backBtn").addEventListener("click", goHome);
  document.getElementById("newBtn").addEventListener("click", openBuilder);
});

/* ---------- Local date (UTC bug fix) ---------- */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function loadState() {
  try { return JSON.parse(localStorage.getItem("cl_" + todayKey()) || "{}"); }
  catch { return {}; }
}
function saveState() { localStorage.setItem("cl_" + todayKey(), JSON.stringify(submitted)); }

/* ---------- Load config from Sheet ---------- */
function loadChecklists() {
  showHomeState("loading");
  jsonp(SCRIPT_URL + "?action=getChecklists")
    .then(data => {
      if (data && data.success) {
        CHECKLISTS = data.checklists || [];
        renderHome();
      } else {
        showHomeState("error", (data && data.message) || "Load nahi hua");
      }
    })
    .catch(() => showHomeState("error", "Internet ya server issue"));
}

/* ---------- HOME ---------- */
function renderHome() {
  const list = document.getElementById("clList");
  if (!CHECKLISTS.length) {
    list.innerHTML = `<div class="state">Abhi koi checklist nahi hai.<br>Upar “+ New” se ek banao.</div>`;
    return;
  }
  list.innerHTML = CHECKLISTS.map(cl => {
    const done = submitted[cl.id];
    const pill = done ? `<span class="pill done">Done</span>` : `<span class="pill pending">Pending</span>`;
    return `
      <div class="card" data-id="${cl.id}">
        <div class="card-icon">${cl.icon || "\uD83D\uDCCB"}</div>
        <div class="card-body">
          <h3>${esc(cl.name)}</h3>
          <div class="meta">${esc(cl.owner || cl.subtitle || `${cl.items.length} points`)}</div>
        </div>
        ${pill}
        <span class="chevron">\u203A</span>
      </div>`;
  }).join("");
  list.querySelectorAll(".card").forEach(c =>
    c.addEventListener("click", () => openChecklist(c.dataset.id)));
}

function showHomeState(kind, msg) {
  const list = document.getElementById("clList");
  if (kind === "loading")
    list.innerHTML = `<div class="state"><div class="spin"></div>Checklists load ho rahe hain…</div>`;
  else if (kind === "error")
    list.innerHTML = `<div class="state">${esc(msg || "Error")}<br>
      <button class="icon-btn" onclick="loadChecklists()">Dobara try karo</button></div>`;
}

/* ---------- FILL a checklist ---------- */
function openChecklist(id) {
  current = CHECKLISTS.find(c => c.id === id);
  if (!current) return;
  answers = {};

  document.getElementById("headerTitle").textContent = current.name;
  document.getElementById("clTitle").textContent = current.name;
  document.getElementById("clSub").textContent = current.subtitle || current.owner || "";
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("newBtn").classList.add("hidden");

  renderItems();
  updateProgress();
  swap("fill");
}

function renderItems() {
  const body = document.getElementById("items");
  body.innerHTML = current.items.map((item, idx) => `
    <div class="q" id="q-${idx}">
      <div class="q-top">
        <div class="q-num">${idx + 1}</div>
        <div>
          <div class="q-label">${esc(item.label)}</div>
          ${item.tip ? `<div class="q-tip">${esc(item.tip)}</div>` : ""}
        </div>
      </div>
      <div class="q-input">${inputHtml(item, idx)}</div>
    </div>`).join("");

  // wire up
  current.items.forEach((item, idx) => {
    if (item.type === "yesno" || item.type === "percent" || item.type === "select") {
      document.querySelectorAll(`#q-${idx} .opt`).forEach(btn =>
        btn.addEventListener("click", () => setOption(idx, btn.dataset.val, btn)));
    } else {
      const inp = document.querySelector(`#q-${idx} .field`);
      inp.addEventListener("input", () => setValue(idx, inp.value));
    }
  });
  renderSignature(body);
}

function inputHtml(item, idx) {
  if (item.type === "yesno") {
    return `<div class="opt-row">
      <button class="opt yes" data-val="Yes">\u2705 Yes</button>
      <button class="opt no"  data-val="No">\u274C No</button></div>`;
  }
  if (item.type === "percent") {
    const opts = item.options.length ? item.options : ["70", "80", "90", "100"];
    return `<div class="opt-row">${opts.map(o =>
      `<button class="opt" data-val="${o}%">${o}%</button>`).join("")}</div>`;
  }
  if (item.type === "select") {
    const opts = item.options.length ? item.options : ["Option 1", "Option 2"];
    return `<div class="opt-row">${opts.map(o =>
      `<button class="opt" data-val="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  }
  if (item.type === "number")
    return `<input type="number" inputmode="numeric" class="field" placeholder="Number likho…">`;
  return `<input type="text" class="field" placeholder="Yahan likho…">`;
}

function renderSignature(body) {
  const sig = document.createElement("div");
  sig.className = "sig";
  sig.innerHTML = `
    <div class="sig-row"><label>Collected by</label>
      <input id="collectedBy" class="field" placeholder="Naam likho…"></div>
    <div class="sig-row"><label>Checked by</label>
      <input id="checkedBy" class="field" placeholder="Naam likho…"></div>`;
  body.appendChild(sig);
}

function setOption(idx, val, btn) {
  answers[idx] = val;
  btn.parentElement.querySelectorAll(".opt").forEach(b => b.classList.remove("on"));
  btn.classList.add("on");
  document.getElementById("q-" + idx).classList.add("answered");
  updateProgress();
}
function setValue(idx, val) {
  if (val.trim()) { answers[idx] = val.trim(); document.getElementById("q-" + idx).classList.add("answered"); }
  else { delete answers[idx]; document.getElementById("q-" + idx).classList.remove("answered"); }
  updateProgress();
}

function updateProgress() {
  const total = current.items.length;
  const done  = Object.keys(answers).length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  document.getElementById("barFill").style.width = pct + "%";
  document.getElementById("progressCount").textContent = `${done}/${total}`;
  const btn = document.getElementById("submitBtn");
  if (done === total) { btn.classList.add("ready"); btn.textContent = "Submit checklist"; }
  else { btn.classList.remove("ready"); btn.textContent = `Submit (${done}/${total})`; }
}

/* ---------- SUBMIT ---------- */
function submitChecklist() {
  const collectedBy = val("collectedBy");
  const checkedBy   = val("checkedBy");
  if (!collectedBy) { toast("‘Collected by’ ka naam daalo"); focus("collectedBy"); return; }

  const missing = current.items.filter((_, i) => !answers[i]).length;
  if (missing && !confirm(`${missing} sawaal baaki hain. Phir bhi submit karein?`)) return;

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  document.getElementById("submitNote").textContent = "Google Sheet mein save ho raha hai…";

  const items = current.items.map((it, i) => ({ label: it.label, answer: answers[i] || "\u2014" }));

  fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "submitChecklist",
      checklistName: current.name,
      collectedBy, checkedBy, items
    })
  })
    .then(r => r.json())
    .then(data => {
      btn.disabled = false;
      document.getElementById("submitNote").textContent = "";
      if (data.success) {
        submitted[current.id] = true; saveState();
        document.getElementById("successOverlay").classList.add("show");
      } else toast("Error: " + (data.message || "unknown"));
    })
    .catch(() => {
      btn.disabled = false;
      document.getElementById("submitNote").textContent = "";
      toast("Connection error. Internet check karo.");
    });
}
function closeSuccess() {
  document.getElementById("successOverlay").classList.remove("show");
  goHome();
}

/* ---------- BUILDER (add new checklist) ---------- */
let builderIcon = "\uD83D\uDCCB";
const ICONS = ["\uD83D\uDCCB", "\uD83C\uDFED", "\uD83D\uDE9A", "\uD83D\uDCE6", "\uD83D\uDD0B", "\uD83D\uDCB0", "\uD83D\uDD27", "\u2705"];

function openBuilder() {
  document.getElementById("headerTitle").textContent = "New checklist";
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("newBtn").classList.add("hidden");

  builderIcon = ICONS[0];
  document.getElementById("bName").value = "";
  document.getElementById("bOwner").value = "";
  document.getElementById("bPin").value = "";
  document.getElementById("iconPick").innerHTML = ICONS.map(ic =>
    `<button class="emoji-opt ${ic === builderIcon ? "on" : ""}" data-ic="${ic}">${ic}</button>`).join("");
  document.querySelectorAll("#iconPick .emoji-opt").forEach(b =>
    b.addEventListener("click", () => {
      builderIcon = b.dataset.ic;
      document.querySelectorAll("#iconPick .emoji-opt").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
    }));

  document.getElementById("bItems").innerHTML = "";
  addBuilderItem(); addBuilderItem();
  swap("builder");
  window.scrollTo(0, 0);
}

function addBuilderItem() {
  const wrap = document.getElementById("bItems");
  const n = wrap.children.length + 1;
  const div = document.createElement("div");
  div.className = "q-builder";
  div.innerHTML = `
    <div class="q-builder-head">
      <span class="n">Sawaal ${n}</span>
      <button class="rm-btn" type="button">Hatao</button>
    </div>
    <input class="field b-label" placeholder="Sawaal likho…">
    <div class="row-2" style="margin-top:9px">
      <input class="field b-tip" placeholder="Tip (optional)">
      <select class="field b-type">
        <option value="yesno">Yes / No</option>
        <option value="percent">Percent %</option>
        <option value="number">Number</option>
        <option value="text">Text</option>
        <option value="select">Options list</option>
      </select>
    </div>
    <input class="field b-opts hidden" placeholder="Options comma se: A, B, C" style="margin-top:9px">`;
  const typeSel = div.querySelector(".b-type");
  const optsInp = div.querySelector(".b-opts");
  typeSel.addEventListener("change", () =>
    optsInp.classList.toggle("hidden", !(typeSel.value === "percent" || typeSel.value === "select")));
  div.querySelector(".rm-btn").addEventListener("click", () => { div.remove(); renumberBuilder(); });
  wrap.appendChild(div);
}
function renumberBuilder() {
  document.querySelectorAll("#bItems .q-builder .n").forEach((el, i) => el.textContent = "Sawaal " + (i + 1));
}

function saveChecklist() {
  const name = val("bName");
  const pin  = val("bPin");
  if (!name) { toast("Checklist ka naam daalo"); return; }
  if (!pin)  { toast("Admin PIN daalo"); return; }

  const items = [];
  document.querySelectorAll("#bItems .q-builder").forEach(row => {
    const label = row.querySelector(".b-label").value.trim();
    if (!label) return;
    const type = row.querySelector(".b-type").value;
    const optsRaw = row.querySelector(".b-opts").value.trim();
    const options = optsRaw ? optsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
    items.push({ label, tip: row.querySelector(".b-tip").value.trim(), type, options });
  });
  if (!items.length) { toast("Kam se kam ek sawaal daalo"); return; }

  const btn = document.getElementById("saveBtn");
  btn.disabled = true; btn.textContent = "Save ho raha hai…";

  fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "addChecklist",
      pin, name, owner: val("bOwner"), icon: builderIcon, items
    })
  })
    .then(r => r.json())
    .then(data => {
      btn.disabled = false; btn.textContent = "Checklist save karo";
      if (data.success) { toast("Ban gaya \u2705"); loadChecklists(); goHome(); }
      else toast(data.message || "Save nahi hua");
    })
    .catch(() => { btn.disabled = false; btn.textContent = "Checklist save karo"; toast("Connection error"); });
}

/* ---------- Nav / utils ---------- */
function swap(screen) {
  ["home", "fill", "builder"].forEach(s =>
    document.getElementById("screen-" + s).classList.toggle("hidden", s !== screen));
  window.scrollTo(0, 0);
}
function goHome() {
  document.getElementById("headerTitle").textContent = "Litpax Checklists";
  document.getElementById("backBtn").classList.add("hidden");
  document.getElementById("newBtn").classList.remove("hidden");
  current = null;
  renderHome();
  swap("home");
}
function val(id) { return (document.getElementById(id).value || "").trim(); }
function focus(id) { document.getElementById(id).focus(); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* JSONP loader (GitHub Pages → GAS ke liye reliable) */
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cl_cb_" + Date.now();
    const s = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 15000);
    function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
    window[cb] = data => { cleanup(); resolve(data); };
    s.onerror = () => { cleanup(); reject(new Error("network")); };
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.body.appendChild(s);
  });
}
