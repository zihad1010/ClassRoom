const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let appState = { notices: [], settings: {}, countdowns: [], routine: [], isAdmin: false, filter: "all", editingId: null };
let toastTimer;
const safeText = (value) => String(value ?? "");
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2800); }
function showModal(id) { $("#" + id).classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(id) { $("#" + id).classList.add("hidden"); if ($$(".modal:not(.hidden)").length === 0) document.body.style.overflow = ""; }
function prettyDate(value, withTime = false) {
  if (!value) return "Date not specified";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", withTime ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" } : { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(d);
}
function formatCreated(value) {
  if (!value) return "Recently published";
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  return "Posted " + prettyDate(normalized, true);
}
function currentMonthLabel() { return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date()); }
const CT_AUTO_MS = 6000;
let ctSig = "", ctIdsSig = "";
let ctRefs = [], ctDotEls = [], ctIndex = 0, ctAutoTimer = null, ctHold = 0, ctScrollTimer;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function getCountdowns() {
  return (appState.countdowns || []).map((c) => ({ id: c.id, title: safeText(c.title), datetime: safeText(c.target), syllabus: safeText(c.note) }));
}
function ctSorted() {
  const now = Date.now();
  const rank = (c) => Number.isNaN(c.t) ? 2 : (c.t > now ? 0 : 1);
  return getCountdowns().map((c, i) => ({ ...c, t: c.datetime ? new Date(c.datetime).getTime() : NaN, i }))
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? b.t - a.t : a.t - b.t) || a.i - b.i);
}
const ctSigOf = (cts) => cts.map((c) => `${c.id}|${c.title}|${c.datetime}|${c.syllabus.length}|${c.t > Date.now() ? 1 : 0}`).join("~");
function openSyllabus(ct) {
  ct = ct || {};
  $("#sylTitle").textContent = ct.title || "Countdown";
  $("#sylDate").textContent = "Date: " + (ct.datetime ? prettyDate(ct.datetime, true) : "Not scheduled");
  $("#sylBody").textContent = ct.syllabus || "No syllabus added yet.";
  showModal("sylModal");
}
function buildCtSlider(n) {
  const track = $("#ctSlider"), dots = $("#ctDots");
  track.innerHTML = ""; dots.innerHTML = ""; ctRefs = []; ctDotEls = [];
  for (let i = 0; i < n; i++) {
    const slide = el("article", "ct-slide");
    slide.setAttribute("role", "group"); slide.setAttribute("aria-roledescription", "slide"); slide.setAttribute("aria-label", `Countdown ${i + 1} of ${n}`);
    const card = el("div", "ct-card");
    const mid = el("div", "ct-mid"), title = el("h2", "ct-title"), row = el("div", "ct-row");
    const status = el("span", "pill"), meta = el("span", "ct-date");
    row.append(status, meta); mid.append(title, row);
    const countdown = el("div", "countdown"), nums = {};
    [["days", "Days"], ["hours", "Hours"], ["minutes", "Minutes"], ["seconds", "Seconds"]].forEach(([key, label]) => {
      const box = el("div", "cd-" + key), num = el("strong", "", "--"); box.append(num, el("span", "", label)); countdown.append(box); nums[key] = num;
    });
    const syl = el("div", "ct-syl"), sylMain = el("div", "ct-syl-main"), sylText = el("p", "ct-syl-text");
    const more = el("button", "ct-syl-more", "See more"); more.type = "button"; more.hidden = true; more.setAttribute("aria-haspopup", "dialog");
    sylMain.append(el("strong", "ct-syl-label", "Syllabus"), sylText); syl.append(sylMain, more);
    const ref = { title, meta, status, nums, card, sylText, more, ct: null };
    more.addEventListener("click", () => openSyllabus(ref.ct));
    card.append(mid, countdown, syl); slide.append(card); track.append(slide);
    ctRefs.push(ref);
    const dot = el("button", "ct-dot"); dot.type = "button"; dot.setAttribute("aria-label", `Show countdown ${i + 1}`);
    dot.addEventListener("click", () => { goToCt(i, true); startCtAuto(); });
    dots.append(dot); ctDotEls.push(dot);
  }
  updateCtDots(); startCtAuto();
}
function updateCtDots() { ctDotEls.forEach((d, i) => { d.classList.toggle("active", i === ctIndex); d.setAttribute("aria-current", i === ctIndex ? "true" : "false"); }); }
function goToCt(i, smooth = true) {
  const track = $("#ctSlider"); ctIndex = i; updateCtDots();
  track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !reduceMotion.matches ? "smooth" : "auto" });
}
function startCtAuto() {
  clearInterval(ctAutoTimer);
  if (reduceMotion.matches || ctRefs.length < 2) return;
  ctAutoTimer = setInterval(() => { if (ctHold === 0 && !document.hidden && ctRefs.length > 1) goToCt((ctIndex + 1) % ctRefs.length); }, CT_AUTO_MS);
}
function initCtSlider() {
  const track = $("#ctSlider"), wrap = $("#ctWrap");
  track.addEventListener("scroll", () => {
    clearTimeout(ctScrollTimer);
    ctScrollTimer = setTimeout(() => { ctIndex = Math.round(track.scrollLeft / track.clientWidth) || 0; updateCtDots(); }, 80);
  }, { passive: true });
  const hold = () => { ctHold++; }, release = () => { ctHold = Math.max(0, ctHold - 1); };
  wrap.addEventListener("mouseenter", hold); wrap.addEventListener("mouseleave", release);
  wrap.addEventListener("focusin", hold); wrap.addEventListener("focusout", release);
  wrap.addEventListener("touchstart", () => { clearInterval(ctAutoTimer); }, { passive: true });
  wrap.addEventListener("touchend", () => { startCtAuto(); }, { passive: true });
  window.addEventListener("resize", () => goToCt(ctIndex, false));
  reduceMotion.addEventListener("change", startCtAuto);
}
function renderCountdown() {
  const cts = ctSorted();
  $("#ctWrap").classList.toggle("hidden", !cts.length);
  const ids = cts.map((c) => c.id).join(",");
  if (ids !== ctIdsSig) { ctIdsSig = ids; ctIndex = Math.min(ctIndex, Math.max(cts.length - 1, 0)); buildCtSlider(cts.length); }
  ctSig = ctSigOf(cts);
  $("#ctDots").classList.toggle("hidden", cts.length < 2);
  cts.forEach((ct, i) => {
    const r = ctRefs[i]; if (!r) return;
    r.title.textContent = ct.title || "Countdown";
    r.meta.textContent = ct.datetime ? prettyDate(ct.datetime, true) : "";
    r.meta.hidden = !ct.datetime;
    r.sylText.textContent = ct.syllabus || "No syllabus added yet.";
    r.ct = ct;
  });
  tickCountdown();
  requestAnimationFrame(fitCtSyl);
}
function fitCtSyl() {
  ctRefs.forEach((r) => { if (r.sylText.offsetParent === null) return; r.more.hidden = !(r.sylText.scrollHeight > r.sylText.clientHeight + 1); });
}
window.addEventListener("resize", fitCtSyl);
function tickCountdown() {
  const cts = ctSorted();
  if (ctSigOf(cts) !== ctSig || cts.length !== ctRefs.length) { renderCountdown(); return; }
  cts.forEach((ct, i) => {
    const r = ctRefs[i]; if (!r) return;
    const setAll = (v) => ["days", "hours", "minutes", "seconds"].forEach(k => r.nums[k].textContent = v);
    const target = ct.datetime ? new Date(ct.datetime).getTime() : NaN;
    if (Number.isNaN(target)) { r.status.textContent = "Schedule TBD"; setAll("--"); return; }
    const diff = target - Date.now();
    r.card.classList.toggle("is-done", diff <= 0);
    if (diff <= 0) { r.status.textContent = "Time reached"; setAll("00"); return; }
    r.status.textContent = "Counting down";
    const units = { days: 86400000, hours: 3600000, minutes: 60000, seconds: 1000 };
    let remaining = diff;
    for (const [key, unit] of Object.entries(units)) { const n = Math.floor(remaining / unit); r.nums[key].textContent = String(n).padStart(2, "0"); remaining -= n * unit; }
  });
}
const expandedIds = new Set();
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
function linkify(text) {
  const frag = document.createDocumentFragment(); let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0]; const t = url.match(/[.,;:!?)\]}।]+$/); if (t) url = url.slice(0, -t[0].length);
    if (!url) continue;
    if (m.index > last) frag.append(text.slice(last, m.index));
    const a = el("a", "notice-link", url); a.href = /^www\./i.test(url) ? "https://" + url : url; a.target = "_blank"; a.rel = "noopener noreferrer";
    frag.append(a); last = m.index + url.length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0"; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
  showToast("Copied to clipboard.");
}
function applyClamp(card) {
  const id = Number(card.dataset.noticeId), body = card.querySelector(".notice-body"), more = card.querySelector(".see-more");
  if (!body || !more || body.offsetParent === null) return;
  const open = expandedIds.has(id); body.classList.toggle("clamp", !open);
  if (open) { more.hidden = false; more.textContent = "See less"; }
  else { more.hidden = !(body.scrollHeight > body.clientHeight + 1); more.textContent = "See more"; }
}
function fitNotices() { $$(".notice-card").forEach(applyClamp); }
function noticeCard(n) {
  const article = el("article", "notice-card" + (n.pinned ? " is-pinned" : "")); article.dataset.noticeId = n.id;
  const meta = el("div", "notice-meta"); meta.append(el("span", "category", n.category), el("span", "pinned", n.pinned ? "Pinned" : ""));
  const body = el("div", "notice-body clamp"); body.append(linkify(safeText(n.body)));
  const more = el("button", "see-more", "See more"); more.type = "button"; more.hidden = true;
  more.addEventListener("click", () => { if (expandedIds.has(n.id)) expandedIds.delete(n.id); else expandedIds.add(n.id); $$(`[data-notice-id="${n.id}"]`).forEach(applyClamp); });
  const footer = el("div", "notice-footer");
  const views = el("span", "nf-views"); views.title = "Views"; views.append(icon("i-eye"), el("span", "nf-views-n", String(n.views || 0)));
  const copy = el("button", "copy-btn"); copy.type = "button"; copy.title = "Copy this update"; copy.setAttribute("aria-label", "Copy this update");
  copy.append(icon("i-copy")); copy.addEventListener("click", () => copyText(`${n.title}\n\n${n.body}`));
  footer.append(el("span", "nf-date", formatCreated(n.created_at).replace("Posted ", "")), views, copy);
  article.append(meta, el("h3", "", n.title), body, more, el("div", "notice-spacer"), footer);
  return article;
}
function pinTile(n) {
  const t = el("article", "pin-tile"); t.tabIndex = 0; t.setAttribute("role", "button"); t.setAttribute("aria-label", "Open pinned notice: " + n.title);
  const av = el("div", "pin-avatar"); av.dataset.cat = n.category; const badge = el("span", "pin-badge"); av.append(icon(CAT_ICON[n.category] || "i-spark")); badge.append(icon("i-pin")); av.append(badge);
  const open = () => { location.hash = "notice-" + n.id; };
  t.addEventListener("click", open); t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  t.append(av, el("small", "pin-cat", n.category), el("h3", "", n.title), el("span", "pin-date", n.relevant_date ? prettyDate(n.relevant_date) : formatCreated(n.created_at).replace("Posted ", "")));
  return t;
}
function renderNotices() {
  const list = $("#noticeList"), filtered = appState.notices.filter(n => appState.filter === "all" || n.category === appState.filter);
  list.innerHTML = ""; $("#emptyState").classList.toggle("hidden", filtered.length > 0); list.classList.toggle("hidden", filtered.length === 0);
  filtered.forEach(n => list.append(noticeCard(n)));
  const pins = appState.notices.filter(n => n.pinned), pl = $("#pinnedList"); pl.innerHTML = "";
  pins.forEach(n => pl.append(pinTile(n))); $("#pinnedEmpty").classList.toggle("hidden", pins.length > 0);
  requestAnimationFrame(fitNotices);
  watchViews();
}
window.addEventListener("resize", fitNotices);

/* ---------- Notice views: a notice counts once per device after it has been on screen for a moment ---------- */
let viewObserver = null; const viewTimers = new Map(), viewSent = new Set(), viewQueue = new Set(); let viewFlushTimer = null;
function watchViews() {
  if (viewObserver) viewObserver.disconnect();
  viewTimers.forEach((t) => clearTimeout(t)); viewTimers.clear();
  if (!("IntersectionObserver" in window)) return;
  viewObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const id = Number(e.target.dataset.noticeId);
      if (e.isIntersecting) {
        const n = appState.notices.find((x) => x.id === id);
        if (!n || n.viewed || viewSent.has(id) || viewTimers.has(id)) return;
        viewTimers.set(id, setTimeout(() => { viewTimers.delete(id); queueView(id); }, 1200));
      } else if (viewTimers.has(id)) { clearTimeout(viewTimers.get(id)); viewTimers.delete(id); }
    });
  }, { threshold: 0.5 });
  $$("#noticeList .notice-card").forEach((c) => viewObserver.observe(c));
}
function queueView(id) {
  if (viewSent.has(id)) return;
  viewSent.add(id); viewQueue.add(id);
  const n = appState.notices.find((x) => x.id === id);
  if (n) { n.viewed = true; n.views = (n.views || 0) + 1; paintViews(id, n.views); }
  clearTimeout(viewFlushTimer); viewFlushTimer = setTimeout(flushViews, 1500);
}
async function flushViews() {
  const ids = [...viewQueue]; viewQueue.clear(); if (!ids.length) return;
  try { await api("/api/views", { method: "POST", body: JSON.stringify({ ids }) }); }
  catch { ids.forEach((id) => viewSent.delete(id)); }
}
function paintViews(id, count) { $$(`[data-notice-id="${id}"] .nf-views-n`).forEach((x) => { x.textContent = String(count); }); }
function syncViews(list) {
  (list || []).forEach((n) => {
    const mine = appState.notices.find((x) => x.id === n.id); if (!mine) return;
    const count = Math.max(n.views || 0, viewSent.has(n.id) ? mine.views || 0 : 0);
    mine.views = count; mine.viewed = n.viewed || viewSent.has(n.id); paintViews(n.id, count);
  });
}
document.addEventListener("visibilitychange", () => { if (document.hidden) flushViews(); });

const CAT_ICON = { "Class": "i-book", "Assignment": "i-feed", "Quiz / CT": "i-clock", "Exam": "i-exam", "Other": "i-spark" };
function icon(id) { const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"), u = document.createElementNS(ns, "use"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true"); u.setAttribute("href", "#" + id); s.append(u); return s; }
function iconBtn(cls, label, id, fn) { const b = el("button", "mini-button ic-only " + cls); b.type = "button"; b.title = label; b.setAttribute("aria-label", label); b.append(icon(id)); b.addEventListener("click", fn); return b; }
function syncChips() { $$("#catChips .chip").forEach(c => c.classList.toggle("active", c.dataset.cat === $("#noticeCategory").value)); }
function buildChips() {
  const box = $("#catChips"); box.innerHTML = "";
  Object.keys(CAT_ICON).forEach(cat => { const b = el("button", "chip"); b.type = "button"; b.dataset.cat = cat; b.append(icon(CAT_ICON[cat]), document.createTextNode(cat)); b.addEventListener("click", () => { $("#noticeCategory").value = cat; syncChips(); }); box.append(b); });
  syncChips();
}
async function togglePin(n) {
  try { await api(`/api/notices/${n.id}`, { method: "PUT", body: JSON.stringify({ title: n.title, category: n.category, relevant_date: n.relevant_date || "", body: n.body, pinned: !n.pinned }) }); showToast(n.pinned ? "Unpinned." : "Pinned to top."); await loadData(); }
  catch (error) { showToast(error.message); }
}
function renderAdminNotices() {
  const list = $("#adminNoticeList"); list.innerHTML = "";
  if (!appState.notices.length) { list.append(el("div", "info-empty", "No notices published yet.")); return; }
  for (const n of appState.notices) {
    const row = el("div", "admin-notice"), ic = el("span", "an-ic"), info = el("div", "an-text"), actions = el("div", "admin-actions");
    ic.append(icon(CAT_ICON[n.category] || "i-spark"));
    info.append(el("strong", "", n.title), el("small", "", `${n.category}${n.pinned ? " · Pinned" : ""} · ${formatCreated(n.created_at)}`));
    actions.append(iconBtn(n.pinned ? "on" : "", n.pinned ? "Unpin" : "Pin to top", "i-pin", () => togglePin(n)), iconBtn("", "Edit", "i-edit", () => startEdit(n)), iconBtn("danger", "Delete", "i-trash", () => deleteNotice(n.id)));
    row.append(ic, info, actions); list.append(row);
  }
}
function voterId() {
  try {
    let v = localStorage.getItem("bupVoter");
    if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) { v = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12); localStorage.setItem("bupVoter", v); }
    return v;
  } catch { return ""; }
}
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(voterId() ? { "X-Voter": voterId() } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("Backend server-এর সাথে সংযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করুন।");
  }

  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    if (response.status === 401) appState.isAdmin = false;
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}
let lastRev = null, dataSig = "", adminSig = "";
async function loadStats() {
  try { const s = await api("/api/stats"); $("#stDevices").textContent = s.devices; $("#stActive").textContent = s.active24h; $("#stWeek").textContent = s.active7d; $("#stPush").textContent = s.alertsOn; } catch {}
}
async function loadData(silent = false) {
  try {
    const data = await api("/api/bootstrap");
    lastRev = data.rev ?? lastRev;
    const sig = JSON.stringify([(data.notices || []).map(({ views, viewed, ...rest }) => rest), data.settings, data.countdowns, data.routine, data.isAdmin]);
    if (sig === dataSig) { syncViews(data.notices); return; }
    dataSig = sig;
    appState.notices = data.notices || []; appState.settings = data.settings || {}; appState.countdowns = data.countdowns || []; appState.routine = data.routine || [];
    appState.isAdmin = Boolean(data.isAdmin);
    renderCountdown(); renderNotices(); consumePending(); pendingNotice = null; renderInfoPanels(); updateProfile(); updateNotifs(); renderWelcome();
    if (appState.isAdmin) {
      renderAdminNotices(); fillCtForm(); loadStats();
      // only refill the forms when the CR's own data changed, so students' activity never wipes what the CR is typing
      const as = JSON.stringify([data.settings, data.countdowns, data.routine, data.notices.map(n => [n.id, n.title, n.pinned])]);
      if (as !== adminSig) { adminSig = as; fillStoreForms(); fillClsForm(); }
    }
  } catch (error) {
    dataSig = "";
    if (silent) return;
    $("#noticeList").innerHTML = "";
    const box = document.createElement("div"); box.className = "loading-card"; box.textContent = "Could not load updates. Please refresh in a moment."; $("#noticeList").append(box);
    showToast(error.message);
  }
}
// Auto refresh: phones check a tiny change counter every few seconds and reload data by themselves when anything changes.
async function checkRev() {
  if (document.hidden) return;
  try { const { rev } = await api("/api/rev"); if (lastRev === null) lastRev = rev; else if (rev !== lastRev) await loadData(true); } catch {}
}
setInterval(checkRev, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadData(true); });
const toLocalInput = (iso) => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(" ", "T");
};
function resetCdForm() { $("#ctForm").reset(); $("#cdEditingId").value = ""; $("#cdCancel").classList.add("hidden"); $("#ctForm button[type=submit]").textContent = "Add countdown"; }
function adminRow(iconId, title, sub, actions) {
  const row = el("div", "admin-notice"), ic = el("span", "an-ic"), info = el("div", "an-text"), box = el("div", "admin-actions");
  ic.append(icon(iconId)); info.append(el("strong", "", title), el("small", "", sub)); actions.forEach(a => box.append(a)); row.append(ic, info, box); return row;
}
function renderAdminCountdowns() {
  const list = $("#adminCdList"); list.innerHTML = "";
  const cds = ctSorted();
  if (!cds.length) { list.append(el("div", "info-empty", "No countdowns yet.")); return; }
  cds.forEach(c => list.append(adminRow("i-clock", c.title, c.datetime ? prettyDate(c.datetime, true) : "Not scheduled", [
    iconBtn("", "Edit", "i-edit", () => { $("#cdEditingId").value = c.id; $("#cdTitle").value = c.title; $("#cdDate").value = toLocalInput(c.datetime); $("#cdNote").value = c.syllabus; $("#cdCancel").classList.remove("hidden"); $("#ctForm button[type=submit]").textContent = "Save changes"; $("#ctFormMessage").textContent = "Editing: " + c.title; $("#ctForm").scrollIntoView({ behavior: "smooth", block: "start" }); }),
    iconBtn("danger", "Delete", "i-trash", async () => { if (!confirm("Delete this countdown?")) return; try { await api(`/api/countdowns/${c.id}`, { method: "DELETE" }); showToast("Countdown deleted."); await loadData(); } catch (e) { showToast(e.message); } })
  ])));
}
function fillCtForm() { renderAdminCountdowns(); }
/* ---------- Home welcome title: set by the CR (stored in the existing settings "syllabus_title" field) ---------- */
const WELCOME_DEFAULT = "Batch 96 Class Portal";
function renderWelcome() {
  const custom = safeText((appState.settings || {}).syllabus_title).trim();
  const h = $("#welcomeTitle"); if (h) h.textContent = custom || WELCOME_DEFAULT;
  const i = $("#welcomeInput"); if (i && document.activeElement !== i) i.value = custom;
}
$("#welcomeForm")?.addEventListener("submit", async event => {
  event.preventDefault(); const btn = $("#welcomeForm button[type=submit]"), msg = $("#welcomeMsg"); btn.disabled = true; setMsg(msg, "");
  try {
    const s = appState.settings || {}, value = $("#welcomeInput").value.trim().slice(0, 60);
    await api("/api/settings", { method: "PUT", body: JSON.stringify({ ct_datetime: s.ct_datetime || "", syllabus_title: value, syllabus_text: s.syllabus_text || "" }) });
    await loadData(); showToast("Welcome title saved."); setMsg(msg, "Saved.");
  } catch (err) { setMsg(msg, err.message || "Could not save. Please try again.", true); }
  finally { btn.disabled = false; }
});
function resetNoticeForm() {
  appState.editingId = null; $("#noticeForm").reset(); syncChips(); $("#editingId").value = ""; $("#cancelEdit").classList.add("hidden"); $("#noticeForm button[type=submit]").textContent = "Publish notice"; $("#noticeFormMessage").textContent = "";
}
function startEdit(n) {
  appState.editingId = n.id; $("#editingId").value = n.id; $("#noticeTitle").value = n.title; $("#noticeCategory").value = n.category; syncChips(); $("#noticeDate").value = n.relevant_date || ""; $("#noticeBody").value = n.body; $("#noticePinned").checked = Boolean(n.pinned); $("#cancelEdit").classList.remove("hidden"); $("#noticeForm button[type=submit]").textContent = "Save changes"; $("#noticeFormMessage").textContent = "Editing: " + n.title; $("#noticeEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function deleteNotice(id) {
  if (!confirm("Delete this notice? This cannot be undone.")) return;
  try { await api(`/api/notices/${id}`, { method: "DELETE" }); showToast("Notice deleted."); await loadData(); }
  catch (error) { showToast(error.message); }
}
function showAdmin() { $("#loginModal").classList.add("hidden"); showModal("adminModal"); renderAdminNotices(); fillCtForm(); fillStoreForms(); fillClsForm(); loadStats(); }
$("#adminOpen").addEventListener("click", () => appState.isAdmin ? showAdmin() : showModal("loginModal"));
$$("[data-close]").forEach(el => el.addEventListener("click", () => closeModal(el.dataset.close)));
$$(".filter").forEach(btn => btn.addEventListener("click", () => { $$(".filter").forEach(b => b.classList.remove("active")); btn.classList.add("active"); appState.filter = btn.dataset.filter; renderNotices(); }));
$("#refreshBtn").addEventListener("click", async () => { await loadData(); showToast("Updates refreshed."); });
$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault(); $("#loginError").textContent = "";
  try { await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("#adminPassword").value }) }); $("#adminPassword").value = ""; appState.isAdmin = true; await loadData(); showAdmin(); showToast("Logged in successfully."); }
  catch (error) { $("#loginError").textContent = error.message; }
});
$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST", body: JSON.stringify({}) }); } catch {}
  appState.isAdmin = false; closeModal("adminModal"); resetNoticeForm(); showToast("Logged out."); await loadData();
});
$$(".admin-tab[data-tab]").forEach(btn => btn.addEventListener("click", () => {
  $$(".admin-tab[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
  $$(".admin-pane").forEach(p => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
}));
$("#noticeForm").addEventListener("submit", async event => {
  event.preventDefault(); const button = $("#noticeForm button[type=submit]"); button.disabled = true;
  const payload = { title: $("#noticeTitle").value, category: $("#noticeCategory").value, relevant_date: $("#noticeDate").value, body: $("#noticeBody").value, pinned: $("#noticePinned").checked };
  try {
    if (appState.editingId) await api(`/api/notices/${appState.editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/notices", { method: "POST", body: JSON.stringify(payload) });
    resetNoticeForm(); await loadData(); $("#noticeFormMessage").textContent = "Saved successfully."; showToast("Notice saved and published.");
  } catch (error) { $("#noticeFormMessage").textContent = error.message; }
  finally { button.disabled = false; }
});
$("#cancelEdit").addEventListener("click", resetNoticeForm);
$("#ctForm").addEventListener("submit", async event => {
  event.preventDefault(); const button = $("#ctForm button[type=submit]"); button.disabled = true;
  const id = $("#cdEditingId").value, payload = { title: $("#cdTitle").value, datetime: $("#cdDate").value, note: $("#cdNote").value };
  try {
    await api(id ? `/api/countdowns/${id}` : "/api/countdowns", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    resetCdForm(); $("#ctFormMessage").textContent = "Saved successfully."; await loadData(); showToast("Countdown saved.");
  } catch (error) { $("#ctFormMessage").textContent = error.message; }
  finally { button.disabled = false; }
});
$("#cdCancel").addEventListener("click", () => { resetCdForm(); $("#ctFormMessage").textContent = ""; });
/* ---------- Upcoming CT, Exam routine and the 4 pills ---------- */
const STORE_LIMIT = 7800;
let exSeq = 0;
function readStore() {
  let p = null;
  try { p = JSON.parse((appState.settings || {}).syllabus_text || ""); } catch {}
  const ok = p && p.v === 2;
  const up = ok && Array.isArray(p.up) ? p.up : [];
  const exRaw = ok ? p.ex : null;
  let exTitle = "", exItems = [];
  if (Array.isArray(exRaw)) { exTitle = safeText((exRaw[0] || {}).t); exItems = exRaw; }
  else if (exRaw && typeof exRaw === "object") { exTitle = safeText(exRaw.t); exItems = Array.isArray(exRaw.i) ? exRaw.i : []; }
  return {
    cts: getCountdowns(),
    up: up.map(r => ({ course: safeText(r.c), ct: safeText(r.n), date: safeText(r.d) })),
    ex: { title: exTitle, items: exItems.map(r => ({ date: safeText(r.d), course: safeText(r.c), time: safeText(r.m), syllabus: safeText(r.s) })) }
  };
}
function packStore(st) {
  return JSON.stringify({
    v: 2, cts: [],
    up: st.up.map(r => ({ c: r.course, n: r.ct, d: r.date })),
    ex: { t: st.ex.title, i: st.ex.items.map(r => ({ d: r.date, c: r.course, m: r.time, s: r.syllabus })) }
  });
}
async function saveStore(patch) {
  const s = appState.settings || {}, cur = readStore();
  const json = packStore({ cts: cur.cts, up: cur.up, ex: cur.ex, ...patch });
  if (json.length > STORE_LIMIT) throw new Error(`Too much saved text (${json.length}/${STORE_LIMIT}). Shorten some entries or CT syllabus text and save again.`);
  await api("/api/settings", { method: "PUT", body: JSON.stringify({ ct_datetime: s.ct_datetime || "", syllabus_title: s.syllabus_title || "", syllabus_text: json }) });
}
function dhakaToday() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function daysLeft(dateStr) { const t = Date.parse(dateStr + "T00:00:00Z"), n = Date.parse(dhakaToday() + "T00:00:00Z"); return Number.isNaN(t) ? null : Math.round((t - n) / 86400000); }
function leftLabel(d) { if (d === null) return "—"; if (d < 0) return "Passed"; if (d === 0) return "Today"; if (d === 1) return "Tomorrow"; return d + " days left"; }
function isPast(d) { return d === null || d < 0; }
function withDays(list) {
  return list.map(r => ({ ...r, d: daysLeft(r.date) })).sort((a, b) => {
    const ap = isPast(a.d), bp = isPast(b.d);
    if (ap !== bp) return ap ? 1 : -1;
    return ap ? (b.d ?? -1e9) - (a.d ?? -1e9) : a.d - b.d;
  });
}
function renderUpcoming() {
  const box = $("#upBody"); box.innerHTML = "";
  const rows = withDays(readStore().up);
  if (!rows.length) { box.append(el("div", "info-empty", "No upcoming CT has been added yet.")); return; }
  const wrap = el("div", "table-wrap"), table = el("table", "info-table"), thead = el("thead"), hr = el("tr");
  ["Course", "CT", "Date", "Remaining"].forEach(h => { const th = el("th", "", h); th.scope = "col"; hr.append(th); });
  thead.append(hr);
  const tbody = el("tbody");
  rows.forEach(r => {
    const tr = el("tr", isPast(r.d) ? "is-past" : "");
    const badge = el("span", "left-badge" + (isPast(r.d) ? " past" : r.d <= 3 ? " soon" : ""), leftLabel(r.d));
    const last = el("td"); last.append(badge);
    tr.append(el("td", "c-course", r.course), el("td", "", r.ct || "—"), el("td", "c-date", prettyDate(r.date)), last);
    tbody.append(tr);
  });
  table.append(thead, tbody); wrap.append(table); box.append(wrap);
}
function renderExams() {
  const box = $("#exBody"); box.innerHTML = "";
  const ex = readStore().ex, rows = withDays(ex.items);
  if (!ex.title && !rows.length) { box.append(el("div", "info-empty", "No exam routine has been added yet.")); return; }
  if (ex.title) box.append(el("h3", "exam-heading", ex.title));
  const field = (label, val, cls) => { const f = el("div", "exam-field" + (cls ? " " + cls : "")); f.append(el("span", "", label), el("div", "v", val)); return f; };
  const list = el("div", "exam-list");
  rows.forEach(r => {
    const card = el("article", "exam-card" + (isPast(r.d) ? " is-past" : ""));
    card.append(el("div", "exam-date", prettyDate(r.date)), field("Course", r.course || "—"), field("Exam time", r.time || "—"), field("Syllabus", r.syllabus || "—", "exam-syllabus"));
    list.append(card);
  });
  box.append(list);
}
function renderInfoPanels() {
  const st = readStore();
  const live = (arr) => arr.filter(r => !isPast(daysLeft(r.date))).length;
  const u = live(st.up), x = live(st.ex.items);
  $("#upCount").textContent = u ? `${u} upcoming` : "Course, CT & date";
  const todayN = dayClasses(dhakaDow()).length;
  $("#exCount").textContent = todayN ? `${todayN} ${todayN === 1 ? "class" : "classes"} today` : (x ? `${x} exam${x === 1 ? "" : "s"} scheduled` : "Class & exam");
  renderUpcoming(); renderExams(); renderClassRoutine(); renderCalendar(); renderWeek();
}
function setMsg(node, text, isError) { node.textContent = text; node.style.color = isError ? "var(--err)" : ""; }

function addUpRow(r = {}) {
  const row = el("div", "up-row");
  const course = el("input", "up-course"); course.maxLength = 60; course.placeholder = "Course name"; course.setAttribute("aria-label", "Course name"); course.value = r.course || "";
  const ct = el("input", "up-ct"); ct.maxLength = 12; ct.placeholder = "CT-1"; ct.setAttribute("aria-label", "CT number"); ct.value = r.ct || "";
  const date = el("input", "up-date"); date.type = "date"; date.setAttribute("aria-label", "CT date"); date.value = r.date || "";
  const rm = el("button", "mini-button danger", "Remove"); rm.type = "button"; rm.addEventListener("click", () => row.remove());
  row.append(course, ct, date, rm); $("#upRows").append(row);
  return row;
}
function addExItem(r = {}, open = true) {
  const id = ++exSeq;
  const d = el("details", "ct-fieldset ex-item"); d.open = open;
  d.innerHTML = `<summary></summary>
    <label for="exDate${id}">Date</label><input id="exDate${id}" class="ex-date" type="date">
    <label for="exCourse${id}">Course name</label><input id="exCourse${id}" class="ex-course" maxlength="60" placeholder="e.g. Discrete Mathematics">
    <label for="exTime${id}">Exam time</label><input id="exTime${id}" class="ex-time" maxlength="40" placeholder="e.g. 10:00 AM – 12:00 PM">
    <label for="exSyl${id}">Syllabus</label><textarea id="exSyl${id}" class="ex-syl" rows="4" maxlength="500" placeholder="Chapters or topics. New lines are preserved."></textarea>
    <div class="ex-actions"><button type="button" class="mini-button danger">Remove this course</button></div>`;
  const q = (c) => d.querySelector(c), sum = q("summary");
  q(".ex-date").value = r.date || ""; q(".ex-course").value = r.course || ""; q(".ex-time").value = r.time || ""; q(".ex-syl").value = r.syllabus || "";
  const upd = () => { const c = q(".ex-course").value.trim(), dt = q(".ex-date").value; sum.textContent = (c || "New course") + (dt ? " — " + prettyDate(dt) : ""); };
  d.addEventListener("input", upd); upd();
  q(".ex-actions button").addEventListener("click", () => d.remove());
  $("#exRows").append(d);
  return d;
}
function fillStoreForms() {
  const st = readStore();
  $("#upRows").innerHTML = ""; (st.up.length ? st.up : [{}]).forEach(r => addUpRow(r));
  $("#exMainTitle").value = st.ex.title;
  $("#exRows").innerHTML = ""; st.ex.items.forEach(r => addExItem(r, false)); if (!st.ex.items.length) addExItem({}, true);
}
/* ---------- Unlucky Calendar: filled automatically from CT, exam and assignment dates ---------- */
let calYear = null, calMonth = 0, calSelected = "";
const CAL_FACE = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M8.2 9.2v1.2M15.8 9.2v1.2"/><path d="M8.5 16.4c1-1.3 2.2-1.9 3.5-1.9s2.5.6 3.5 1.9"/><path d="M17 12.8c.6.9.9 1.4.9 1.9a.9.9 0 0 1-1.8 0c0-.5.3-1 .9-1.9z" fill="currentColor" stroke="none"/></svg>';
const pad2 = (n) => String(n).padStart(2, "0");
function dhakaKey(value) {
  const d = new Date(value); if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function calEvents() {
  const map = {}, seen = new Set();
  const add = (date, type, title, sub) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return;
    const key = [date, type, title, sub].join("|").toLowerCase(); if (seen.has(key)) return; seen.add(key);
    (map[date] = map[date] || []).push({ type, title: title || type, sub: sub || "" });
  };
  const st = readStore();
  st.up.forEach(r => add(r.date, "CT", r.course, r.ct));
  st.cts.forEach((c, i) => {
    if (!c.datetime) return;
    const t = new Date(c.datetime); if (Number.isNaN(t.getTime())) return;
    add(dhakaKey(t), "Countdown", c.title || "Countdown", new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }).format(t));
  });
  st.ex.items.forEach(r => add(r.date, "Exam", r.course, [st.ex.title, r.time].filter(Boolean).join(" · ")));
  const noticeType = { "Assignment": "Assignment", "Quiz / CT": "CT / Quiz", "Exam": "Exam" };
  (appState.notices || []).forEach(n => { const type = noticeType[n.category]; if (type && n.relevant_date) add(String(n.relevant_date).slice(0, 10), type, n.title, ""); });
  return map;
}
/* ---------- This Week: 7-day activity weight graph, filled from the Unlucky Calendar ---------- */
const WEEK_WEIGHT = { "Exam": 5, "CT": 3, "CT / Quiz": 3, "Assignment": 2, "Countdown": 2 };
let weekSel = "", weekToday = "";
function weekDays() {
  const [y, m, d] = dhakaToday().split("-").map(Number), base = Date.UTC(y, m - 1, d), back = (new Date(base).getUTCDay() + 1) % 7; // week runs Saturday to Friday
  return Array.from({ length: 7 }, (_, i) => { const t = new Date(base + (i - back) * 86400000); return { key: t.getUTCFullYear() + "-" + pad2(t.getUTCMonth() + 1) + "-" + pad2(t.getUTCDate()), date: t }; });
}
function renderWeek(animate = true) {
  const wrap = $("#weekChart"); if (!wrap) return;
  const today = dhakaToday(), days = weekDays(), events = calEvents();
  weekToday = today; if (!days.some(x => x.key === weekSel)) weekSel = today;
  const fmt = (t, o) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(t);
  const data = days.map(x => { const list = events[x.key] || []; return { ...x, list, pts: list.reduce((s, e) => s + (WEEK_WEIGHT[e.type] || 1), 0) }; });
  const total = data.reduce((s, x) => s + x.pts, 0), max = Math.max(7, ...data.map(x => x.pts)), avgPct = Math.min(100, (total / 7) / max * 92);
  const count = (...types) => data.reduce((s, x) => s + x.list.filter(e => types.includes(e.type)).length, 0);
  $("#weekRange").textContent = fmt(days[0].date, { day: "numeric", month: "short" }) + " – " + fmt(days[6].date, { day: "numeric", month: "short" });

  const chips = $("#weekChips"); chips.innerHTML = "";
  [["Activities", data.reduce((s, x) => s + x.list.length, 0)], ["Exams", count("Exam")], ["CT / Quiz", count("CT", "CT / Quiz")], ["Assignments", count("Assignment")]].forEach(([label, n]) => {
    const chip = el("span", "wk-chip"); chip.append(el("span", "", label), el("i", "wk-sep"), el("b", n ? "" : "zero", String(n))); chips.append(chip);
  });

  wrap.innerHTML = ""; wrap.style.setProperty("--avg", avgPct.toFixed(1));
  const grid = el("div", "wk-grid"), bars = [];
  data.forEach(x => {
    const on = x.key === weekSel, p = x.pts ? x.pts / max * 92 : 0;
    const col = el("button", "wk-col" + (on ? " is-sel" : "") + (x.key === today ? " is-today" : "")); col.type = "button"; col.setAttribute("aria-pressed", on ? "true" : "false");
    col.setAttribute("aria-label", fmt(x.date, { weekday: "long", day: "numeric", month: "short" }) + ": " + x.list.length + (x.list.length === 1 ? " activity" : " activities") + ", weight " + x.pts);
    const track = el("span", "wk-track"), bar = el("span", "wk-bar" + (x.pts ? "" : " empty"));
    bar.style.setProperty("--p", animate ? 0 : p); bars.push([bar, p]); track.append(bar);
    if (on) track.append(el("span", "wk-dot"));
    const day = el("span", "wk-day"); day.append(el("b", "", fmt(x.date, { weekday: "short" })), el("small", "", fmt(x.date, { day: "numeric" })));
    col.append(track, day); col.addEventListener("click", () => { weekSel = x.key; renderWeek(false); }); grid.append(col);
  });
  const avgLabel = el("span", "wk-avg-label" + (data.findIndex(x => x.key === weekSel) <= 2 ? " right" : ""), "7-day avg.");
  wrap.append(grid, el("div", "wk-avg"), avgLabel);
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach(([b, p]) => b.style.setProperty("--p", p))));

  const sel = data.find(x => x.key === weekSel) || data[0];
  $("#weekTitle").textContent = (sel.key === today ? "Today · " : "") + fmt(sel.date, { weekday: "long", day: "numeric", month: "long" });
  $("#weekSub").textContent = sel.list.length ? sel.list.length + (sel.list.length === 1 ? " activity" : " activities") + " · weight " + sel.pts : "Nothing scheduled. A free day.";
  const ul = $("#weekList"); ul.innerHTML = "";
  sel.list.forEach(e => { const li = el("li", "wk-item"); li.append(el("span", "wk-tag", e.type), el("span", "wk-name", e.title)); ul.append(li); });
}
setInterval(() => { if (weekToday && dhakaToday() !== weekToday) renderWeek(); }, 60000);
function openCalendar() { const t = dhakaToday().split("-"); calYear = +t[0]; calMonth = +t[1] - 1; calSelected = ""; renderCalendar(); }
function shiftCalMonth(delta) { const d = new Date(Date.UTC(calYear, calMonth + delta, 1)); calYear = d.getUTCFullYear(); calMonth = d.getUTCMonth(); calSelected = ""; renderCalendar(); }
function selectCalDay(key) { calSelected = calSelected === key ? "" : key; renderCalendar(); const b = $(`#calBody [data-key="${key}"]`); if (b) b.focus(); }
function renderCalendar() {
  if (calYear === null) { const t = dhakaToday().split("-"); calYear = +t[0]; calMonth = +t[1] - 1; }
  const box = $("#calBody"); box.innerHTML = "";
  const events = calEvents(), today = dhakaToday();
  const nav = el("div", "cal-nav"), btns = el("div", "cal-nav-btns");
  const mk = (label, aria, fn) => { const b = el("button", "mini-button", label); b.type = "button"; b.setAttribute("aria-label", aria); b.addEventListener("click", fn); return b; };
  btns.append(mk("‹", "Previous month", () => shiftCalMonth(-1)), mk("Today", "Go to current month", openCalendar), mk("›", "Next month", () => shiftCalMonth(1)));
  nav.append(el("strong", "", new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(calYear, calMonth, 1)))), btns);
  const grid = el("div", "cal-grid");
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(w => grid.append(el("div", "cal-wd", w)));
  const first = new Date(Date.UTC(calYear, calMonth, 1)).getUTCDay(), days = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();
  for (let i = 0; i < first; i++) { const b = el("div", "cal-day blank"); b.setAttribute("aria-hidden", "true"); grid.append(b); }
  for (let d = 1; d <= days; d++) {
    const key = `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`, list = events[key], isToday = key === today;
    if (list) {
      const b = el("button", "cal-day has-ev" + (isToday ? " today" : "") + (key === calSelected ? " selected" : ""));
      b.type = "button"; b.dataset.key = key; b.setAttribute("aria-pressed", key === calSelected ? "true" : "false");
      b.setAttribute("aria-label", `${prettyDate(key)}, ${list.length} item${list.length === 1 ? "" : "s"}`);
      const emo = el("span", "emo"); emo.innerHTML = CAL_FACE; emo.setAttribute("aria-hidden", "true");
      b.append(el("span", "num", String(d)), emo);
      if (list.length > 1) b.append(el("span", "cnt", String(list.length)));
      b.addEventListener("click", () => selectCalDay(key)); grid.append(b);
    } else {
      const c = el("div", "cal-day" + (isToday ? " today" : "")); c.append(el("span", "num", String(d))); grid.append(c);
    }
  }
  const detail = el("div", "cal-detail"); detail.setAttribute("aria-live", "polite");
  if (calSelected && events[calSelected]) {
    detail.append(el("h3", "", prettyDate(calSelected)));
    events[calSelected].forEach(e => {
      const row = el("div", "cal-item"), txt = el("div"); txt.append(el("div", "t", e.title)); if (e.sub) txt.append(el("div", "s", e.sub));
      row.append(el("span", "cal-type", e.type), txt); detail.append(row);
    });
  } else detail.append(el("div", "cal-hint", "Tap a marked date to see what is on that day."));
  box.append(nav, grid, detail);
}
$$("[data-open]").forEach(btn => btn.addEventListener("click", () => {
  const id = btn.dataset.open;
  if (id === "upModal") renderUpcoming();
  if (id === "exModal") { rtDay = null; setRtTab("class"); renderClassRoutine(); renderExams(); }
  if (id === "calModal") openCalendar();
  showModal(id);
  const close = $("#" + id + " .modal-close"); if (close) close.focus();
}));
$("#soonPill").addEventListener("click", () => showToast("Coming soon."));
$("#upAdd").addEventListener("click", () => addUpRow().querySelector(".up-course").focus());
$("#exAdd").addEventListener("click", () => { const d = addExItem({}, true); d.querySelector(".ex-date").focus(); });
$("#upForm").addEventListener("submit", async event => {
  event.preventDefault(); const btn = $("#upForm button[type=submit]"), msg = $("#upFormMessage"); btn.disabled = true; setMsg(msg, "", false);
  try {
    const up = [];
    $$("#upRows .up-row").forEach((row, i) => {
      const course = row.querySelector(".up-course").value.trim(), ct = row.querySelector(".up-ct").value.trim(), date = row.querySelector(".up-date").value;
      if (!course && !ct && !date) return;
      if (!course || !date) throw new Error(`Row ${i + 1}: course name and date are required.`);
      up.push({ course, ct, date });
    });
    await saveStore({ up });
    await loadData(); setMsg(msg, "Upcoming CT list saved.", false); showToast("Upcoming CT updated.");
  } catch (error) { setMsg(msg, error.message, true); }
  finally { btn.disabled = false; }
});
$("#exForm").addEventListener("submit", async event => {
  event.preventDefault(); const btn = $("#exForm button[type=submit]"), msg = $("#exFormMessage"); btn.disabled = true; setMsg(msg, "", false);
  try {
    const title = $("#exMainTitle").value.trim(), items = [];
    $$("#exRows .ex-item").forEach((d, i) => {
      const v = (c) => d.querySelector(c).value.trim();
      const item = { date: d.querySelector(".ex-date").value, course: v(".ex-course"), time: v(".ex-time"), syllabus: v(".ex-syl") };
      if (!item.date && !item.course && !item.time && !item.syllabus) return;
      if (!item.date || !item.course) throw new Error(`Entry ${i + 1}: date and course name are required.`);
      items.push(item);
    });
    if (items.length && !title) throw new Error("Please write the exam title first.");
    await saveStore({ ex: { title, items } });
    await loadData(); setMsg(msg, "Exam routine saved.", false); showToast("Exam routine updated.");
  } catch (error) { setMsg(msg, error.message, true); }
  finally { btn.disabled = false; }
});

/* ---------- Class routine (Sunday–Saturday) ---------- */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], DAY_SHORT = DAY_NAMES.map(d => d.slice(0, 3));
let rtDay = null, admDay = null;
function dhakaDow() { const [y, m, d] = dhakaToday().split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function weekDayNum(i) { const [y, m, d] = dhakaToday().split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + (i - dhakaDow()))).getUTCDate(); }
function dhakaNowMin() { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":"); return +p[0] * 60 + +p[1]; }
const toMin = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
function fmt12(t) { const m = toMin(t); if (m === null) return ""; const h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; }
const dayClasses = (day) => (appState.routine || []).filter(r => r.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
function dayChips(box, current, onPick, showDots) {
  box.innerHTML = ""; const today = dhakaDow();
  DAY_SHORT.forEach((s, i) => {
    const b = el("button", "day-chip" + (i === current ? " active" : "") + (i === today ? " is-today" : "")); b.type = "button";
    b.dataset.day = i; b.setAttribute("aria-label", DAY_NAMES[i]); b.setAttribute("aria-pressed", i === current ? "true" : "false");
    b.append(el("small", "", s), el("strong", "", String(weekDayNum(i))));
    if (showDots && dayClasses(i).length) b.append(el("i", "day-dot"));
    b.addEventListener("click", () => onPick(i)); box.append(b);
  });
}
function clsCard(c, day, state) {
  const card = el("article", "cls-card" + (state ? " is-" + state : "")); card.dataset.day = day;
  const time = el("div", "cls-time"), main = el("div", "cls-main");
  time.append(el("strong", "", fmt12(c.start_time)), el("span", "", c.end_time ? fmt12(c.end_time) : ""));
  const title = el("h3", "", c.course);
  if (state === "live") title.append(el("span", "cls-now", "Now"));
  else if (state === "next") title.append(el("span", "cls-now cls-next", "Next"));
  main.append(title); const meta = el("div", "cls-meta");
  if (c.room) { const r = el("span", "cls-chip"); r.append(icon("i-pin"), document.createTextNode("Room " + c.room)); meta.append(r); }
  if (c.faculty) { const f = el("span", "cls-chip"); f.append(icon("i-user"), document.createTextNode(c.faculty)); meta.append(f); }
  if (meta.childNodes.length) main.append(meta);
  card.append(time, main); return card;
}
function renderClassRoutine(animate = false) {
  const today = dhakaDow(); if (rtDay === null) rtDay = today;
  const now = dhakaNowMin();
  // Today's routine: always on top, whichever day is picked below
  let tb = $("#todayBox"); if (!tb) { tb = el("div", "cls-today"); tb.id = "todayBox"; $("#clsPane").prepend(tb); }
  tb.innerHTML = "";
  const tl = dayClasses(today), th = el("div", "cls-head"), tt = el("div");
  tt.append(el("strong", "", "Today's routine"), el("small", "", DAY_NAMES[today] + (tl.length ? ` · ${tl.length} ${tl.length === 1 ? "class" : "classes"}` : "")));
  th.append(tt); tb.append(th);
  if (!tl.length) tb.append(el("div", "info-empty", "No class today. Enjoy your day!"));
  else {
    let nextDone = false;
    tl.forEach(c => {
      const st = toMin(c.start_time), en = toMin(c.end_time); let state = "";
      if (st !== null) {
        const end = en === null ? st + 60 : en;
        if (now >= st && now < end) state = "live";
        else if (now >= end) state = "done";
        else if (!nextDone) { state = "next"; nextDone = true; }
      }
      tb.append(clsCard(c, today, state));
    });
  }
  // Pick a day: tap a day to see that day's routine
  dayChips($("#dayChips"), rtDay, (i) => { rtDay = i; renderClassRoutine(true); }, true);
  const box = $("#clsBody"); box.innerHTML = ""; box.classList.toggle("cls-anim", !!animate);
  const list = dayClasses(rtDay);
  const head = el("div", "cls-head"), t = el("div");
  t.append(el("strong", "", DAY_NAMES[rtDay] + (rtDay === today ? " (Today)" : "")), el("small", "", list.length ? `${list.length} ${list.length === 1 ? "class" : "classes"}` : "No classes"));
  head.append(t); box.append(head);
  if (rtDay === today) { box.append(el("div", "info-empty", "Today's classes are shown at the top.")); return; }
  if (!list.length) { box.append(el("div", "info-empty", "No class on " + DAY_NAMES[rtDay] + ".")); return; }
  list.forEach((c, i) => { const card = clsCard(c, rtDay, ""); card.style.setProperty("--i", i); box.append(card); });
}
function setRtTab(name) {
  $$(".rt-tab").forEach(b => { const on = b.dataset.rt === name; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
  $("#clsPane").classList.toggle("hidden", name !== "class"); $("#examPane").classList.toggle("hidden", name !== "exam");
}
$$(".rt-tab").forEach(b => b.addEventListener("click", () => setRtTab(b.dataset.rt)));
setInterval(() => { if (!$("#exModal").classList.contains("hidden")) renderClassRoutine(); }, 60000);

/* CR: set the class routine one day at a time */
function addClsRow(r = {}) {
  const row = el("div", "cls-row");
  const mk = (cls, ph, max, val, type) => { const i = el("input", cls); if (type) i.type = type; if (max) i.maxLength = max; i.placeholder = ph; i.value = val || ""; i.setAttribute("aria-label", ph); return i; };
  const rm = el("button", "mini-button danger", "Remove"); rm.type = "button"; rm.addEventListener("click", () => row.remove());
  const st = el("label", "cls-tl"), en = el("label", "cls-tl");
  st.append(el("span", "", "Start"), mk("cls-start", "Start time", 0, r.start_time, "time")); en.append(el("span", "", "End"), mk("cls-end", "End time", 0, r.end_time, "time"));
  row.append(mk("cls-course", "Course name", 60, r.course), st, en, mk("cls-room", "Room number", 30, r.room), mk("cls-faculty", "Faculty name", 60, r.faculty), rm);
  $("#clsRows").append(row); return row;
}
function renderAdmDay() {
  if (admDay === null) admDay = dhakaDow();
  dayChips($("#admDayChips"), admDay, (i) => { admDay = i; renderAdmDay(); $("#clsFormMessage").textContent = ""; }, true);
  $("#clsRows").innerHTML = ""; const list = dayClasses(admDay); (list.length ? list : [{}]).forEach(addClsRow);
}
function fillClsForm() { renderAdmDay(); }
$("#clsAdd").addEventListener("click", () => { if ($$("#clsRows .cls-row").length >= 12) { showToast("Maximum 12 classes per day."); return; } addClsRow().querySelector(".cls-course").focus(); });
$("#clsForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const btn = $("#clsForm button[type=submit]"), msg = $("#clsFormMessage"); btn.disabled = true; setMsg(msg, "", false);
  try {
    const items = $$("#clsRows .cls-row").map(r => { const v = (c) => r.querySelector(c).value.trim(); return { course: v(".cls-course"), start: v(".cls-start"), end: v(".cls-end"), room: v(".cls-room"), faculty: v(".cls-faculty") }; });
    await api(`/api/routine/${admDay}`, { method: "PUT", body: JSON.stringify({ items }) });
    await loadData(); setMsg(msg, DAY_NAMES[admDay] + " routine saved.", false); showToast("Class routine updated.");
  } catch (error) { setMsg(msg, error.message, true); }
  finally { btn.disabled = false; }
});

/* ---------- Navigation, theme, profile, notifications ---------- */
const VIEWS = ["home", "feed", "materials", "profile"];
function showView(name, push = true) {
  if (!VIEWS.includes(name)) name = "home";
  VIEWS.forEach(v => $("#view-" + v).classList.toggle("hidden", v !== name));
  $$(".nav-btn").forEach(b => { const on = b.dataset.view === name; b.classList.toggle("active", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  document.body.classList.toggle("on-home", name === "home");
  if (push) history.replaceState(null, "", "#" + name);
  window.scrollTo(0, 0);
  if (name === "home") goToCt(ctIndex, false);
  requestAnimationFrame(fitNotices);
}
$$(".nav-btn").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
let pendingNotice = null;
function focusNotice(id) {
  const card = $(`#noticeList [data-notice-id="${id}"]`);
  if (!card) return false;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 2800);
  return true;
}
function consumePending() { if (pendingNotice && appState.notices.length && focusNotice(pendingNotice)) pendingNotice = null; }
function routeHash() {
  const h = location.hash.slice(1), m = /^notice-(\d+)$/.exec(h);
  if (!m) { showView(h, false); return; }
  appState.filter = "all"; $$(".filter").forEach(b => b.classList.toggle("active", b.dataset.filter === "all"));
  showView("feed", false); renderNotices(); pendingNotice = m[1]; consumePending();
  history.replaceState(null, "", "#feed");
}
window.addEventListener("hashchange", routeHash);
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("bupTheme", t); } catch {}
  $("meta[name=theme-color]").content = t === "dark" ? "#0a1a21" : "#e6e1d8";
  $("#themeToggle use").setAttribute("href", t === "dark" ? "#i-sun" : "#i-moon");
  $$("[data-theme-set]").forEach(b => b.classList.toggle("active", b.dataset.themeSet === t));
}
$("#themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
$$("[data-theme-set]").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
$("#userLogin").addEventListener("click", () => showToast("User login is coming soon."));
function updateProfile() {
  $("#adminOpen").textContent = appState.isAdmin ? "Open admin panel" : "Login as Admin";
  $("#profileName").textContent = appState.isAdmin ? "Class representative" : "Guest";
  $("#profileSub").textContent = appState.isAdmin ? "You can publish notices and update CT details." : "You are not signed in.";
}
let notifItems = [], freshIds = new Set(), notifReady = false;
const alerted = new Set();
const noticeTime = (n) => { const v = String(n.created_at || ""), t = Date.parse(v.includes("T") ? v : v.replace(" ", "T") + "Z"); return Number.isNaN(t) ? 0 : t; };
const seenSet = () => { try { const a = JSON.parse(localStorage.getItem("bupSeen")); return Array.isArray(a) ? new Set(a) : null; } catch { return null; } };
const saveSeen = (s) => { try { localStorage.setItem("bupSeen", JSON.stringify([...s])); } catch {} };
function loadExtra() { try { return JSON.parse(localStorage.getItem("bupExtra")) || []; } catch { return []; } }
function scheduleChanges() {
  const st = readStore(), out = [];
  [["ct", "Countdowns updated", st.cts], ["up", "Upcoming CT list updated", st.up], ["ex", "Exam routine updated", st.ex], ["rt", "Class routine updated", appState.routine || []]].forEach(([k, title, val]) => {
    const sig = JSON.stringify(val), key = "bupSig_" + k; let prev = null;
    try { prev = localStorage.getItem(key); } catch {}
    if (prev !== null && prev !== sig) out.push({ id: "s-" + k + "-" + Date.now(), kind: "schedule", category: "Schedule", title, t: Date.now() });
    try { localStorage.setItem(key, sig); } catch {}
  });
  return out;
}
function timeAgo(t) { if (!t) return "Earlier"; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return "Just now"; if (m < 60) return m + " min ago"; if (m < 1440) return Math.round(m / 60) + " h ago"; return Math.round(m / 1440) + " d ago"; }
function popAlert(i) {
  showToast("New from CR: " + i.title);
  if ("Notification" in window && Notification.permission === "granted") { try { new Notification("BUP ICE · " + i.category, { body: i.title, icon: "./icons/icon-192.png" }); } catch {} }
}
function updateNotifs() {
  let extra = loadExtra(); const added = scheduleChanges();
  if (added.length) { extra = [...added, ...extra].slice(0, 15); try { localStorage.setItem("bupExtra", JSON.stringify(extra)); } catch {} }
  const items = [...appState.notices.map(n => ({ id: "n" + n.id, kind: "notice", category: n.category, title: n.title, t: noticeTime(n) })), ...extra].sort((a, b) => b.t - a.t).slice(0, 25);
  let seen = seenSet(); if (!seen) { seen = new Set(items.map(i => i.id)); saveSeen(seen); }
  const fresh = items.filter(i => !seen.has(i.id));
  notifItems = items; freshIds = new Set(fresh.map(i => i.id));
  const b = $("#notifBadge"); b.textContent = fresh.length > 9 ? "9+" : String(fresh.length); b.classList.toggle("hidden", !fresh.length);
  if (!notifReady) fresh.forEach(i => alerted.add(i.id));
  else fresh.filter(i => !alerted.has(i.id)).forEach(i => { alerted.add(i.id); popAlert(i); });
  notifReady = true;
}
function openNotifs() {
  const box = $("#notifBody"); box.innerHTML = "";
  if (!notifItems.length) box.append(el("div", "info-empty", "No notifications yet. New CR updates will appear here."));
  notifItems.forEach(i => {
    const b = el("button", "notif-item" + (freshIds.has(i.id) ? " unread" : "")); b.type = "button";
    const tx = el("div"); tx.append(el("div", "t", i.title), el("div", "s", i.category + " · " + timeAgo(i.t)));
    b.append(el("span", "notif-dot"), tx);
    b.addEventListener("click", () => { closeModal("notifModal"); if (i.kind === "notice") location.hash = "notice-" + i.id.slice(1); else showView("home"); });
    box.append(b);
  });
  saveSeen(new Set([...(seenSet() || []), ...notifItems.map(i => i.id)])); freshIds = new Set(); $("#notifBadge").classList.add("hidden");
  showModal("notifModal");
}
$("#notifOpen").addEventListener("click", openNotifs);
function urlBase64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function refreshPushBtn() {
  const b = $("#alertBtn"); if (!b) return false; let on = false;
  try { if (pushSupported() && Notification.permission === "granted") { const reg = await navigator.serviceWorker.ready; on = !!(await reg.pushManager.getSubscription()); } } catch {}
  b.textContent = on ? "Turn off phone alerts" : "Turn on phone alerts";
  b.classList.toggle("button-primary", !on); b.classList.toggle("button-soft", on);
  return on;
}
const pushOff = () => { try { return localStorage.getItem("bupPushOff") === "1"; } catch { return false; } };
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try { await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }); } catch {}
      await sub.unsubscribe();
    }
    try { localStorage.setItem("bupPushOff", "1"); } catch {}
    await refreshPushBtn(); showToast("Phone alerts are off.");
  } catch (err) { showToast("Could not turn off alerts. Please try again."); }
}
async function enablePush(silent = false) {
  if (!pushSupported()) { if (!silent) showToast("Phone alerts are not supported here. On iPhone, add this site to the Home Screen first."); return false; }
  const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (p !== "granted") { if (!silent) showToast("Alerts are blocked in browser settings."); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api("/api/push/key");
    if (!key) { if (!silent) showToast("Push is not configured yet."); return false; }
    const appKey = urlBase64ToUint8Array(key);
    let sub = await reg.pushManager.getSubscription();
    // If this phone subscribed with an old/different key, drop it and subscribe again with the current key
    if (sub && sub.options && sub.options.applicationServerKey) {
      const cur = new Uint8Array(sub.options.applicationServerKey);
      const same = cur.length === appKey.length && cur.every((v, i) => v === appKey[i]);
      if (!same) { try { await sub.unsubscribe(); } catch {} sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
    try { localStorage.removeItem("bupPushOff"); } catch {}
    await refreshPushBtn(); if (!silent) showToast("Phone alerts are on.");
    return true;
  } catch (err) { if (!silent) showToast("Could not turn on alerts. Please try again."); return false; }
}
$("#alertBtn")?.addEventListener("click", async () => { if (await refreshPushBtn()) disablePush(); else enablePush(); });
$("#pushAllow")?.addEventListener("click", async () => { if (await enablePush()) closeModal("pushModal"); });
const PUSH_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const pushSnoozed = () => { try { return Date.now() - Number(localStorage.getItem("bupPushSnooze") || 0) < PUSH_SNOOZE_MS; } catch { return false; } };
function skipPushPrompt() { try { localStorage.setItem("bupPushSnooze", String(Date.now())); } catch {} closeModal("pushModal"); }
$("#pushSkip")?.addEventListener("click", skipPushPrompt);
document.querySelector("[data-push-skip]")?.addEventListener("click", skipPushPrompt);
async function firstVisitPrompt() {
  if (!pushSupported()) return;
  if (Notification.permission === "granted") {
    if (!pushOff()) enablePush(true);
    return;
  }
  if (Notification.permission !== "default") return;
  if (pushSnoozed()) return;
  setTimeout(() => showModal("pushModal"), 600);
}
setInterval(() => { if (!document.hidden) loadData(true); }, 60000);
setTheme(document.documentElement.dataset.theme || "light");
routeHash();

buildChips();
initCtSlider();
function setWelcome() { const w = $("#welcomeDate"); if (w) w.textContent = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dhaka" }).format(new Date()); }
setWelcome(); setInterval(setWelcome, 60000);
setInterval(() => tickCountdown(), 1000);
loadData(); firstVisitPrompt(); refreshPushBtn();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (e) => { if (!e.data) return; if (e.data.type === "refresh") loadData(true); if (e.data.type === "open" && e.data.hash) location.hash = e.data.hash; });
