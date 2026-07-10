/* ============================================================
   LITPAX CHECKLISTS – Frontend (premium)
   Checklists Google Sheet se load hote hain (dynamic).
   ============================================================ */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwaJBgkCz9ev4Uj56Lsd_OcinAyBxzphVUZxnoTWo1odTZ5cDd6UB5IAxi5eezqQ2Ih9A/exec";

let CHECKLISTS = [];
let current    = null;
let answers    = {};
let submitted  = {};

/* ---------- Boot ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  document.getElementById("todayDate").textContent =
    now.toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.getElementById("greet").textContent = greeting(now) + " 👋";

  submitted = loadState();
  loadChecklists();

  document.getElementById("backBtn").addEventListener("click", goHome);
  document.getElementById("newBtn").addEventListener("click", openBuilder);
});

function greeting(d) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ---------- Local date state ---------- */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function loadState() { try { return JSON.parse(localStorage.getItem("cl_" + todayKey()) || "{}"); } catch { return {}; } }
function saveState() { localStorage.setItem("cl_" + todayKey(), JSON.stringify(submitted)); }

/* ---------- Ring helper ---------- */
function setRing(circleEl, r, pct) {
  const c = 2 * Math.PI * r;
  circleEl.style.strokeDasharray = c.toFixed(2);
  circleEl.style.strokeDashoffset = (c * (1 - pct / 100)).toFixed(2);
}

/* ---------- Load config ---------- */
function loadChecklists() {
  showSkeleton();
  jsonp(SCRIPT_URL + "?action=getChecklists")
    .then(data => {
      if (data && data.success) { CHECKLISTS = data.checklists || []; renderHome(); }
      else showError((data && data.message) || "Load nahi hua");
    })
    .catch(() => showError("Internet ya server issue"));
}

/* ---------- HOME ---------- */
function renderHome() {
  const list = document.getElementById("clList");

  // daily summary
  const total = CHECKLISTS.length;
  const done  = CHECKLISTS.filter(c => submitted[c.id]).length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  setRing(document.getElementById("heroFill"), 27, pct);
  document.getElementById("heroPct").textContent = pct + "%";
  document.getElementById("daySummary").innerHTML = total
    ? (done === total && total > 0 ? "Aaj sab checklist done ✅" : `Aaj <b>${done}/${total}</b> checklist done`)
    : "Abhi koi checklist nahi";

  if (!total) {
    list.innerHTML = `<div class="state">Abhi koi checklist nahi hai.<br>Upar “+ New” se ek banao.</div>`;
    return;
  }
  list.innerHTML = CHECKLISTS.map(cl => {
    const isDone = submitted[cl.id];
    const pill = isDone ? `<span class="pill done">Done</span>` : `<span class="pill pending">Pending</span>`;
    return `
      <div class="card ${isDone ? "done-card" : ""}" data-id="${cl.id}">
        <div class="card-icon">${cl.icon || "\uD83D\uDCCB"}</div>
        <div class="card-body">
          <h3>${esc(cl.name)}</h3>
          <div class="meta">${esc(cl.owner || cl.subtitle || `${cl.items.length} points`)}</div>
        </div>
        ${pill}<span class="chevron">\u203A</span>
      </div>`;
  }).join("");
  list.querySelectorAll(".card").forEach(c =>
    c.addEventListener("click", () => openChecklist(c.dataset.id)));
}

function showSkeleton() {
  document.getElementById("clList").innerHTML = Array(3).fill(`
    <div class="sk">
      <div class="sk-box sk-ic"></div>
      <div style="flex:1"><div class="sk-box sk-l1"></div><div class="sk-box sk-l2"></div></div>
    </div>`).join("");
}
function showError(msg) {
  document.getElementById("clList").innerHTML =
    `<div class="state">${esc(msg)}<br><button class="icon-btn" onclick="loadChecklists()">Dobara try karo</button></div>`;
}

/* ---------- FILL ---------- */
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
        <div><div class="q-label">${esc(item.label)}</div>
        ${item.tip ? `<div class="q-tip">${esc(item.tip)}</div>` : ""}</div>
      </div>
      <div class="q-input">${inputHtml(item)}</div>
    </div>`).join("");

  current.items.forEach((item, idx) => {
    if (["yesno", "percent", "select"].includes(item.type)) {
      document.querySelectorAll(`#q-${idx} .opt`).forEach(btn =>
        btn.addEventListener("click", () => setOption(idx, btn.dataset.val, btn)));
    } else {
      const inp = document.querySelector(`#q-${idx} .field`);
      inp.addEventListener("input", () => setValue(idx, inp.value));
    }
  });
  renderSignature(body);
}

function inputHtml(item) {
  if (item.type === "yesno")
    return `<div class="opt-row">
      <button class="opt yes" data-val="Yes">\u2705 Yes</button>
      <button class="opt no" data-val="No">\u274C No</button></div>`;
  if (item.type === "percent") {
    const o = item.options.length ? item.options : ["70", "80", "90", "100"];
    return `<div class="opt-row">${o.map(v => `<button class="opt" data-val="${v}%">${v}%</button>`).join("")}</div>`;
  }
  if (item.type === "select") {
    const o = item.options.length ? item.options : ["Option 1", "Option 2"];
    return `<div class="opt-row">${o.map(v => `<button class="opt" data-val="${esc(v)}">${esc(v)}</button>`).join("")}</div>`;
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
  setRing(document.getElementById("fillRing"), 30, pct);
  document.getElementById("ringCount").textContent = `${done}/${total}`;

  const status = document.getElementById("clStatus");
  const btn = document.getElementById("submitBtn");
  if (done === 0) { status.textContent = "Shuru karo"; }
  else if (done === total) { status.textContent = "Sab ho gaya — submit karo"; }
  else { status.textContent = `${total - done} baaki`; }

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

  fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({
    action: "submitChecklist", checklistName: current.name, collectedBy, checkedBy, items }) })
    .then(r => r.json())
    .then(data => {
      btn.disabled = false; document.getElementById("submitNote").textContent = "";
      if (data.success) {
        submitted[current.id] = true; saveState();
        document.getElementById("successOverlay").classList.add("show");
      } else toast("Error: " + (data.message || "unknown"));
    })
    .catch(() => { btn.disabled = false; document.getElementById("submitNote").textContent = ""; toast("Connection error. Internet check karo."); });
}
function closeSuccess() { document.getElementById("successOverlay").classList.remove("show"); goHome(); }

/* ---------- BUILDER ---------- */
let builderIcon = "\uD83D\uDCCB";
const ICONS = ["\uD83D\uDCCB", "\uD83C\uDFED", "\uD83D\uDE9A", "\uD83D\uDCE6", "\uD83D\uDD0B", "\uD83E\uDDFA", "\uD83D\uDD27", "\u2705"];

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
}

function addBuilderItem() {
  const wrap = document.getElementById("bItems");
  const div = document.createElement("div");
  div.className = "q-builder";
  div.innerHTML = `
    <div class="q-builder-head"><span class="n">Sawaal ${wrap.children.length + 1}</span>
      <button class="rm-btn" type="button">Hatao</button></div>
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
  const typeSel = div.querySelector(".b-type"), optsInp = div.querySelector(".b-opts");
  typeSel.addEventListener("change", () =>
    optsInp.classList.toggle("hidden", !(typeSel.value === "percent" || typeSel.value === "select")));
  div.querySelector(".rm-btn").addEventListener("click", () => { div.remove(); renumberBuilder(); });
  wrap.appendChild(div);
}
function renumberBuilder() {
  document.querySelectorAll("#bItems .q-builder .n").forEach((el, i) => el.textContent = "Sawaal " + (i + 1));
}

function saveChecklist() {
  const name = val("bName"), pin = val("bPin");
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
  fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({
    action: "addChecklist", pin, name, owner: val("bOwner"), icon: builderIcon, items }) })
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
