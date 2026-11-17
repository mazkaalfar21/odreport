"use strict";
/* ==========================================================================
   Organization Development Report
   Situs statis (tanpa build). Data disimpan di localStorage browser.
   ========================================================================== */

/* ---------- Utilitas umum ---------- */
const $ = s => document.querySelector(s);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const pad = n => String(n).padStart(2, "0");
const KEY = "od-report-v1";

/* ---------- Tanggal (zona waktu Asia/Jakarta, minggu Sabtu-Jumat) ---------- */
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const parse = s => new Date(s + "T00:00:00Z");
const iso = d => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
function todayStr() {
  try {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  } catch (e) { /* fallback di bawah */ }
  const n = new Date();
  return n.getFullYear() + "-" + pad(n.getMonth() + 1) + "-" + pad(n.getDate());
}
const fd = d => +d.slice(8) + " " + MONTHS[+d.slice(5, 7) - 1] + " " + d.slice(0, 4);
const fdl = d => DAYS[parse(d).getUTCDay()] + ", " + fd(d);
const fdm = d => +d.slice(8) + " " + MON3[+d.slice(5, 7) - 1];
const ddmm = d => d.slice(8) + "/" + d.slice(5, 7);
const mk = d => d.slice(0, 7);                                   // "2026-11"
const mlab = m => MONTHS[+m.slice(5) - 1] + " " + m.slice(0, 4);
const wkStart = d => addDays(d, -((parse(d).getUTCDay() + 1) % 7)); // Sabtu awal minggu
// Minggu (Sabtu-Jumat) masuk ke bulan hari Rabu-nya, sama dengan file Weekly Report tim
// (mis. 31 Okt - 6 Nov = Week 1 November).
const wkMid = s => addDays(s, 4);
const wkMonth = s => mk(wkMid(s));
const wkNum = s => Math.floor((+wkMid(s).slice(8) - 1) / 7) + 1;
const wkLab = s => "Week " + wkNum(s) + " " + MON3[+wkMid(s).slice(5, 7) - 1];
function wkRng(s) {
  const e = addDays(s, 6);
  return s.slice(5, 7) == e.slice(5, 7)
    ? +s.slice(8) + "–" + +e.slice(8) + " " + MON3[+s.slice(5, 7) - 1]
    : fdm(s) + "–" + fdm(e);
}
function lastMonths(n) {
  let y = +TODAY.slice(0, 4), m = +TODAY.slice(5, 7);
  const out = [];
  for (let i = 0; i < n; i++) { out.push(y + "-" + pad(m)); if (--m == 0) { m = 12; y--; } }
  return out;
}

/* ---------- Konstanta ---------- */
const pages = [
  ["dash", "Dashboard", ""],
  ["daily", "Daily Report", ""],
  ["weekly", "Weekly Report", ""],
  ["monthly", "Monthly Report", ""],
  ["appr", "Approval Dokumen", ""],
  ["arc", "Impor Data", ""],
  ["usr", "User Management", ""],
  ["set", "Pengaturan", ""]
];
const NAV = [["", ["dash"]], ["Laporan", ["daily", "weekly", "monthly"]], ["Dokumen", ["appr"]], ["Sistem", ["arc", "usr", "set"]]];
const guide = () => "";
const ROLES = ["OD Leader", "OD Staff", "Viewer"];
const DEFAULT_USERS = [{ n: "Sekar Ayuning Srikandi", p: "OD Leader", u: "sekar" }, { n: "Rizal Hamdi", p: "OD Staff", u: "rizal" }, { n: "Visitor", p: "Viewer", u: "visitor" }];
let users = DEFAULT_USERS.map(u => ({ ...u })), team = [];
const syncTeam = () => { team = users.filter(u => u.p != "Viewer"); };
syncTeam();
const JN = ["IK", "JD", "SOP", "SE", "MEMO", "Dokumen Lainnya"];
const BU = ["CV CS", "CV CS AUTO EV", "CV TOP", "PT SMI", "PT MSI", "PT CSN", "RISM"];
const DEFAULT_ST = [{ n: "On Progress", t: "open" }, { n: "Cancel", t: "cancel" }, { n: "Release", t: "done" }];
let statuses = DEFAULT_ST.map(x => ({ ...x })), ST = [], owners = {};
const syncSt = () => { ST = statuses.map(s => s.n); };
syncSt();
const sType = n => (statuses.find(s => s.n == n) || { t: "open" }).t;
const stFirst = t => (statuses.find(s => s.t == t) || statuses[0]).n;
const dcol = n => ({ done: "ok", open: "ac", cancel: "mu" }[sType(n)]);

/* Status clean: titik semantik + teks netral, tanpa bubble */
const stTag = (label, tone) => `<span class="st st-${tone}"><i class="st-dot"></i>${esc(label)}</span>`;
const docBadge = n => stTag(n, dcol(n));
const actBadge = r => stTag(r, r === "Done" ? "ok" : r === "Hold" ? "wn" : "ac");
const migSt = (x, l) => { x = String(x || ""); if (l.some(s => s.n == x)) return x; const t = /release|approved|selesai|done|closed|final/i.test(x) ? "done" : /cancel|batal/i.test(x) ? "cancel" : "open"; return (l.find(s => s.t == t) || l[0]).n; };
function cleanStatuses(a) {
  if (!Array.isArray(a)) return null;
  const seen = new Set(), l = a.filter(x => x && typeof x.n == "string" && x.n.trim() && ["open", "done", "cancel"].includes(x.t)).map(x => ({ n: x.n.trim().slice(0, 30), t: x.t })).filter(x => !seen.has(x.n.toLowerCase()) && seen.add(x.n.toLowerCase()));
  return l.some(x => x.t == "open") && l.some(x => x.t == "done") ? l : null;
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
async function pinHash(p) {
  const s = "od-report-pin:" + p;
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  return "f" + hashStr(s);
}
async function ensurePins() {
  defPinHash = await pinHash("1234");
  let changed = false;
  for (const u of users) if (!u.pin) { u.pin = defPinHash; changed = true; }
  const taken = new Set();
  for (const u of users) {
    let s = typeof u.u == "string" ? u.u.trim().toLowerCase() : "";
    if (!unameOk(s) || taken.has(s)) {
      let base = slugUser(u.n);
      if (base.length < 3) base = (base + "usr").slice(0, 20);
      s = base; let i = 2;
      while (taken.has(s)) s = base.slice(0, 17) + i++;
      changed = true;
    }
    if (u.u !== s) { u.u = s; changed = true; }
    taken.add(s);
  }
  if (changed) save();
}
const pinOk = p => /^\d{4,8}$/.test(p);
const unameOk = s => /^[a-z0-9._-]{3,20}$/.test(s);
const slugUser = n => String(n).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
const defOwner = j => { const t = users.find(u => u.p == (j == "JD" || j == "IK" ? "OD Staff" : "OD Leader")) || team[0]; return t ? t.n : ""; };
const picFor = j => { const k = JN.includes(j) ? j : "Dokumen Lainnya", o = owners[k]; return users.some(u => u.n == o && u.p != "Viewer") ? o : defOwner(k); };

/* ---------- State ---------- */
let TODAY = todayStr();
let acts = [], docs = [], arch = [], mst = {}, nid = 1, me = users[1], themeMode = "light", lastBackup = "", storageOk = true;
let authed = false, defPinHash = "";
let cur = "dash", fp = users[1].n, fw = "Semua", fs = "Semua", fm = mk(TODAY), prev = "", dq = "", df = "Semua", ds = "new", fq = "", dlim = 40;
let dashRange = window.innerWidth < 768 ? "7d" : "30d", dashTab = "acts", dashPage = 0;
const setDashRange = r => { dashRange = r; go("dash"); };
const setDashTab = t => { dashTab = t; dashPage = 0; go("dash"); };
const setDashPage = p => { dashPage = p; go("dash"); };

const A = (d, u, n, r, k = "-", s = "-", sv = 1, ke = "-") => ({ id: nid++, d, u, n, r, k, s, sv, ke, dc: "" });

const SEED_DOCS = [{t:"SOP PENGEMBALIAN SERAGAM KERJA TIM TOKO RETAIL [CV CS]",j:"SOP",bu:"CV CS",st:"In Review",o:"Sekar Ayuning Srikandi",sub:"03/11",rcv:"-"},{t:"SOP Prosedur Rekrutmen Karyawan [PT CSN]",j:"SOP",bu:"PT CSN",st:"Submitted",o:"Sekar Ayuning Srikandi",sub:"04/11",rcv:"-"},{t:"SE KETENTUAN TUNJANGAN HAK KARYAWAN [SMI]",j:"SE",bu:"PT SMI",st:"Released",o:"Sekar Ayuning Srikandi",sub:"02/11",rcv:"06/11"},{t:"MEMO INTERNAL KETENTUAN DUKUNGAN KOORDINASI DENGAN KEPOLISIAN [CV TOP]",j:"MEMO",bu:"CV TOP",st:"Released",o:"Sekar Ayuning Srikandi",sub:"02/11",rcv:"05/11"},{t:"SE KETENTUAN PROSES BACKGROUND CHECKING CALON KARYAWAN [CV CS]",j:"SE",bu:"CV CS",st:"In Review",o:"Sekar Ayuning Srikandi",sub:"06/11",rcv:"-"},{t:"IK PROSES FIXED ASSET PADA SISTEM CSA",j:"IK",bu:"CV TOP",st:"Released",o:"Rizal Hamdi",sub:"02/11",rcv:"06/11"},{t:"IK PROSES PENERIMAAN PURCHASE ORDER (PO) ASET PADA SISTEM CSA",j:"IK",bu:"CV TOP",st:"Released",o:"Rizal Hamdi",sub:"03/11",rcv:"07/11"},{t:"IK PROSES INPUT PENERIMAAN BANK PADA SISTEM CSA",j:"IK",bu:"PT MSI",st:"Released",o:"Rizal Hamdi",sub:"04/11",rcv:"08/11"},{t:"IK PROSES INPUT SERVIS ASET PADA SISTEM SHELF",j:"IK",bu:"CV CS",st:"In Review",o:"Rizal Hamdi",sub:"08/11",rcv:"-"},{t:"JD Staf Keuangan",j:"JD",bu:"PT SMI",st:"Draft",o:"Rizal Hamdi",sub:"09/11",rcv:"-"},{t:"COMPANY PROFILE PT MSI",j:"Dokumen Lainnya",bu:"PT MSI",st:"In Review",o:"Sekar Ayuning Srikandi",sub:"09/11",rcv:"-"}];

function seed() {
  const keep = me.n; users = DEFAULT_USERS.map(u => ({ ...u })); syncTeam(); me = users.find(u => u.n == keep) || users[1];
  nid = 1;
  statuses = DEFAULT_ST.map(x => ({ ...x })); syncSt(); owners = {};
  acts = [
    A("2026-11-07", "Rizal Hamdi", "Revisi SOP Rekrutmen", "Done"),
    A("2026-11-07", "Sekar Ayuning Srikandi", "Review IK Pengadaan", "Done"),
    A("2026-11-07", "Rizal Hamdi", "Penyusunan JD Staf Keuangan", "On Progress", "Menunggu input user", "Follow up PIC"),
    A("2026-11-08", "Rizal Hamdi", "Penyusunan SE Jam Kerja", "Done"),
    A("2026-11-09", "Sekar Ayuning Srikandi", "Rapat evaluasi struktur organisasi", "Hold", "Jadwal direksi bergeser", "Reschedule minggu depan"),
    A("2026-11-09", "Rizal Hamdi", "Revisi JD Staf HR", "Done"),
    A("2026-11-09", "Rizal Hamdi", "Sosialisasi SE Jam Kerja", "Done"),
    A("2026-11-09", "Sekar Ayuning Srikandi", "Finalisasi SOP Rekrutmen", "Done"),
    A("2026-11-09", "Rizal Hamdi", "Penyusunan IK Pengadaan", "On Progress", "Data belum lengkap", "Minta data ke unit terkait"),
    A("2026-11-10", "Sekar Ayuning Srikandi", "Review JD Staf Keuangan", "Done"),
    A("2026-11-10", "Rizal Hamdi", "Draft SOP Onboarding", "On Progress", "-", "-", 0),
    A("2026-11-07", "Sekar Ayuning Srikandi", "Review dokumen OD Staff", "Done"),
    A("2026-11-09", "Sekar Ayuning Srikandi", "Review dokumen OD Staff", "Done"),
    A("2026-11-10", "Sekar Ayuning Srikandi", "Review dokumen OD Staff", "Done"),
    A("2026-11-09", "Sekar Ayuning Srikandi", "Update pricelist MINIMO dan RAPA [PT SMI]", "Done", "Menunggu data tim Retail", "Follow up langsung ke PIC", 1, "Proses tetap berjalan")
  ];
  docs = SEED_DOCS.map(d => ({ mo: "2026-11", ...d, st: migSt(d.st, statuses), id: newId() }));
  arch = [
    { p: "Oktober 2026", t: "Weekly & Monthly", l: "https://drive.google.com/ (contoh)" },
    { p: "September 2026", t: "Weekly", l: "https://drive.google.com/ (contoh)" }
  ];
  mst = { "2026-10": "Finalized" };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 4, users, statuses, owners, acts, docs, arch, mst, nid, themeMode, lastBackup }));
    if (authed) localStorage.setItem(KEY + "-me", me.n);
    storageOk = true;
  } catch (e) { storageOk = false; }
  schedSync();
}
function cleanUsers(a) {
  if (!Array.isArray(a)) return null;
  const u = a.filter(x => x && typeof x.n == "string" && x.n.trim() && ROLES.includes(x.p)).map(x => ({ n: x.n.trim().slice(0, 60), p: x.p, u: typeof x.u == "string" ? x.u.trim().toLowerCase().slice(0, 20) : "", pin: typeof x.pin == "string" ? x.pin : "" }));
  if (!u.some(x => x.p == "OD Leader")) return null;
  if (!u.some(x => x.p == "Viewer")) u.push({ n: "Visitor", p: "Viewer", u: "visitor", pin: "" });
  return u;
}
function sanitize(s) {
  const okA = a => a && typeof a.d == "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.d) && typeof a.n == "string" && typeof a.u == "string" && typeof a.r == "string";
  const okD = d => d && typeof d.t == "string" && typeof d.j == "string" && typeof d.o == "string";
  const stl = cleanStatuses(s.statuses) || DEFAULT_ST.map(x => ({ ...x }));
  const a = (s.acts || []).filter(okA).map(x => ({ id: +x.id || 0, d: x.d, u: x.u, n: x.n, r: x.r, k: String(x.k ?? "-"), s: String(x.s ?? "-"), sv: x.sv ? 1 : 0, ke: String(x.ke ?? "-"), imp: x.imp ? 1 : 0, dc: typeof x.dc == "string" ? x.dc : "", g: typeof x.g == "string" ? x.g : "" }));
  const d = (s.docs || []).filter(okD).map(x => ({ id: typeof x.id == "string" && x.id ? x.id : newId(), t: x.t, j: x.j, bu: String(x.bu ?? "-"), st: migSt(x.st, stl), o: x.o, sub: String(x.sub ?? "-"), rcv: String(x.rcv ?? "-"), mo: /^\d{4}-\d{2}$/.test(x.mo) ? x.mo : mk(TODAY), ct: String(x.ct ?? "") }));
  let max = 0;
  a.forEach(x => { max = Math.max(max, x.id); });
  a.forEach(x => { if (!x.id) x.id = ++max; });
  return { users: cleanUsers(s.users), statuses: stl, owners: s.owners && typeof s.owners == "object" ? s.owners : {}, acts: a, docs: d, arch: [], mst: {}, nid: max + 1 };
}
function apply(s) { if (s.users) users = s.users; syncTeam(); statuses = s.statuses; syncSt(); owners = s.owners || {}; acts = s.acts; docs = s.docs; arch = s.arch || []; mst = s.mst || {}; nid = s.nid; }
function load() {
  try {
    const r = localStorage.getItem(KEY);
    if (!r) return false;
    const s = JSON.parse(r);
    if (!s || !Array.isArray(s.acts) || !Array.isArray(s.docs)) return false;
    apply(sanitize(s));
    themeMode = (s.v || 0) < 3 || s.themeMode == "light" ? "light" : "dark"; // v3: tema terang jadi bawaan
    lastBackup = /^\d{4}-\d{2}-\d{2}$/.test(s.lastBackup) ? s.lastBackup : "";
    let n = ""; try { n = localStorage.getItem(KEY + "-me"); } catch (e) { /* abaikan */ }
    me = users.find(u => u.n == n) || users.find(u => u.p == "OD Staff") || users.find(u => u.p == "OD Leader");
    return true;
  } catch (e) { return false; }
}

/* ---------- Helper data ---------- */
const sc = s => ({ Done: "ok", Released: "ok", Approved: "ok", Hold: "wn", Revision: "wn", Draft: "wn" }[s] || "");
const pos = n => (users.find(u => u.n == n) || { p: "-" }).p;
const saved = () => acts.filter(a => a.sv && (canSeeAll() || a.u == me.n));
const ro = () => me.p == "Viewer";
const canSeeAll = () => me.p != "OD Staff";
const vteam = () => canSeeAll() ? team : team.filter(u => u.n == me.n);
const vdocs = () => canSeeAll() ? docs : docs.filter(d => d.o == me.n);
const canDoc = d => me.p == "OD Leader" || d.o == me.n;
const wkK = a => wkStart(a.d);
const mo = a => mk(a.d);
const dmo = d => d.mo || mk(TODAY);
const mS = m => mst[m] || "Ready to Generate";
const months = () => [...new Set([mk(TODAY), ...saved().map(mo), ...vdocs().map(dmo)])].sort().reverse();
const weeks = () => [...new Set([wkStart(TODAY), ...saved().map(wkK)])].sort().reverse();
const dkey = d => dmo(d) + "-" + (/^\d\d\//.test(d.sub) ? d.sub.slice(0, 2) : "00");
const sortDocs = (l, m = "new") => l.map((d, i) => [d, i, dkey(d)]).sort((a, b) => {
  if (m == "open") { const x = (sType(a[0].st) == "done") - (sType(b[0].st) == "done"); if (x) return x; }
  const c = a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[1] - b[1];
  return m == "old" ? c : -c;
}).map(x => x[0]);
const mineD = () => acts.filter(a => a.u == me.n && !a.sv);
const pf = l => l.filter(a => a.u == fp);
const stMap = x => !x || /clos|done|selesai/i.test(x) ? "Done" : /hold/i.test(x) ? "Hold" : "On Progress";
const wg = l => {
  const m = {};
  l.slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id).forEach(a => {
    const k = a.u + "|" + a.n + "|" + wkK(a), x = m[k];
    if (!x) m[k] = { ...a, c: 1 };
    else {
      x.c++; x.r = a.r; x.d = a.d; x.lid = a.id; if (!x.dc && a.dc) x.dc = a.dc;
      if (a.k != "-") { x.k = a.k; x.s = a.s; }
      if (a.ke != "-") x.ke = a.ke;
    }
  });
  return Object.values(m).sort((a, b) => wkK(a) < wkK(b) ? 1 : wkK(a) > wkK(b) ? -1 : a.d < b.d ? 1 : a.d > b.d ? -1 : (b.lid || b.id) - (a.lid || a.id)); // terbaru di atas
};
const stat = l => {
  const t = l.length, d = l.filter(a => a.r == "Done").length;
  return { t, d, p: t ? Math.round(d / t * 100) : 0, o: l.filter(a => a.r == "On Progress").length, h: l.filter(a => a.r == "Hold").length };
};

/* ---------- Toast & modal ---------- */
let toastTimer;
function toast(m) {
  const t = $("#toast");
  t.textContent = m; t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
}
function cm() {
  const el = document.querySelector("#md .modal");
  if (!el) return;
  el.classList.remove("show");
  document.body.classList.remove("modal-open");
  const bd = document.querySelector(".modal-backdrop");
  if (bd) bd.classList.remove("show");
  setTimeout(() => { $("#md").innerHTML = ""; }, 260);
}
function modal(t, body, ok, lb = "Simpan", w = 520) {
  const isDanger = lb === "Hapus";
  $("#md").innerHTML = `
    <div class="modal fade" id="odModal" tabindex="-1" role="dialog" aria-modal="true" style="display:block">
      <div class="modal-dialog ${w > 600 ? "modal-lg" : ""}">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${t}</h5>
            <button type="button" class="close" onclick="cm()" aria-label="Tutup"><span>&times;</span></button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-footer">
            <button class="btn btn-default" type="button" onclick="cm()">Batal</button>
            <button class="btn ${isDanger ? "btn-danger" : "btn-primary"}" type="button" id="mok">${lb}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade"></div>`;
  document.body.classList.add("modal-open");
  const el = $("#odModal"), bd = document.querySelector(".modal-backdrop");
  void el.offsetWidth;
  el.classList.add("show");
  if (bd) bd.classList.add("show");
  $("#mok").onclick = () => {
    const r = ok();
    if (r && typeof r.then == "function") r.then(v => { if (v !== false) cm(); });
    else if (r !== false) cm();
  };
  const i = $("#md input:not([type=checkbox]),#md textarea");
  if (i) i.focus();
}
document.addEventListener("keydown", e => { if (e.key == "Escape") cm(); });

/* ---------- Tema, akun, navigasi ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = themeMode;
  const isDark = themeMode == "dark";
  const th = $("#th");
  if (th) {
    th.innerHTML = `<i class="${isDark ? "fas fa-sun" : "fas fa-moon"}"></i>`;
    th.title = isDark ? "Mode terang" : "Mode gelap";
    th.setAttribute("aria-label", th.title);
  }
}
function toggleTheme() { themeMode = themeMode == "dark" ? "light" : "dark"; applyTheme(); save(); go(cur, true); }
function toggleSb() { document.body.classList.toggle("sidebar-collapse"); }
function acct() {
  const su = $("#su");
  if (!su) return;
  su.innerHTML = `
    <div class="dropup sidebar-user">
      <a href="#" class="sidebar-user-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Menu akun">
        <span class="avatar">${esc(me.n[0])}</span>
        <span class="sidebar-user-text min-w-0">
          <span class="name text-truncate">${esc(me.n)}</span>
          <span class="meta text-truncate">${esc(me.p)}</span>
        </span>
        <i class="fas fa-chevron-up sidebar-user-chev" aria-hidden="true"></i>
      </a>
      <div class="dropdown-menu user-menu sidebar-user-menu">
        <div class="user-menu-header">
          <span class="avatar avatar-lg">${esc(me.n[0])}</span>
          <div class="min-w-0">
            <div class="name text-truncate">${esc(me.n)}</div>
            <div class="meta">${esc(me.p)}</div>
          </div>
        </div>
        <div class="user-menu-body">
          <button type="button" class="dropdown-item text-danger" onclick="logout()"><i class="fas fa-sign-out-alt"></i>Keluar</button>
        </div>
      </div>
    </div>`;
}
function logout() {
  authed = false;
  try { localStorage.removeItem(KEY + "-me"); } catch (e) { /* abaikan */ }
  killCharts();
  showLogin();
}
function showLogin() {
  document.body.classList.add("logged-out");
  const el = $("#login");
  el.innerHTML = `
    <div class="login-card">
      <div class="login-brand">
        <img src="favicon.svg" alt="" class="login-logo">
        <div>
          <div class="login-title">OD Report</div>
          <div class="login-sub">Organization Development</div>
        </div>
      </div>
      <p class="login-lead">Masuk dengan username dan PIN untuk melanjutkan.</p>
      <div class="f">
        <div class="w"><label>Username</label>
          <input id="li-u" class="form-control" type="text" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="mis. sekar" oninput="loginHint()" onkeydown="if(event.key=='Enter'){event.preventDefault();doLogin()}">
        </div>
        <div class="w"><label>PIN</label>
          <input id="li-p" class="form-control" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" placeholder="4–8 angka" onkeydown="if(event.key=='Enter'){event.preventDefault();doLogin()}">
        </div>
      </div>
      <div id="li-err" class="login-err" role="alert"></div>
      <button type="button" class="btn btn-primary btn-block login-btn" onclick="doLogin()"><i class="fas fa-sign-in-alt mr-1"></i>Masuk</button>
      <p id="li-hint" class="login-hint"></p>
    </div>`;
  el.hidden = false;
  loginHint();
  $("#li-u").focus();
}
function loginHint() {
  const un = $("#li-u").value.trim().toLowerCase(), h = $("#li-hint");
  if (!h) return;
  const u = users.find(x => x.u == un);
  h.textContent = u && u.pin == defPinHash ? "PIN awal akun ini 1234. Ubah lewat User Management setelah masuk." : "";
}
async function doLogin() {
  const un = $("#li-u").value.trim().toLowerCase(), p = $("#li-p").value.trim(), err = $("#li-err");
  if (!un) { err.textContent = "Username wajib diisi."; $("#li-u").focus(); return; }
  const u = users.find(x => x.u == un);
  if (!u) { err.textContent = "Username tidak ditemukan."; return; }
  if (!p) { err.textContent = "PIN wajib diisi."; return; }
  const h = await pinHash(p);
  if (h != u.pin) { err.textContent = "PIN salah. Coba lagi."; $("#li-p").value = ""; $("#li-p").focus(); return; }
  me = u; authed = true;
  fp = me.p == "Viewer" ? team[0].n : me.n;
  prev = "";
  try { localStorage.setItem(KEY + "-me", me.n); } catch (e) { /* abaikan */ }
  $("#login").hidden = true;
  document.body.classList.remove("logged-out");
  go("dash");
  toast("Masuk sebagai " + me.n);
}
function go(p, ns) {
  cur = p; TODAY = todayStr();
  if (!ns) save();
  if (!canSeeAll()) fp = me.n;
  else if (team.length && !team.some(u => u.n == fp)) fp = team[0].n;

  // Sidebar nav (grup seperti modul-web)
  const ICONS = { dash: "fas fa-th-large", daily: "fas fa-clipboard-list", weekly: "fas fa-calendar-alt", monthly: "fas fa-chart-line", appr: "far fa-file-alt", arc: "fas fa-file-upload", usr: "fas fa-users", set: "fas fa-cog" };
  const LABELS = {}; pages.forEach(x => LABELS[x[0]] = x[1]);

  $("#nav").innerHTML = `<ul class="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
    ${NAV.map(([head, ids]) => `${head ? `<li class="nav-header">${head}</li>` : ""}${ids.map(id => `
      <li class="nav-item">
        <a href="#" class="nav-link ${id == p ? "active" : ""}" onclick="go('${id}');return false;">
          <i class="${ICONS[id]} nav-icon"></i>
          <p>${LABELS[id] || id}</p>
        </a>
      </li>`).join("")}`).join("")}
  </ul>`;

  // Header
  const pg = pages.find(x => x[0] == p) || ["", ""];
  document.title = pg[1] + " · OD Report";

  const cr = $("#crumb"); if (cr) cr.textContent = pg[1];
  document.body.classList.toggle("ro", ro());
  acct();
  bell();

  // Render content
  const kp = ["nn", "kk", "ss", "ee", "rr", "rd"].map(i => [i, $("#" + i) ? $("#" + i).value : null]);
  const v = $("#v");
  v.className = "";
  try {
    v.innerHTML = (storageOk ? "" : `<div class="content-header"><div class="container-fluid"><div class="alert alert-danger"><i class="fas fa-exclamation-triangle mr-2"></i>Penyimpanan lokal penuh. Lakukan <b>Backup data</b> di Pengaturan.</div></div></div>`)
      + V[p]();
  } catch (err) {
    console.error(err);
    v.innerHTML = `<div class="content"><div class="container-fluid"><div class="card"><div class="card-body"><h5>Terjadi kesalahan</h5><p class="text-muted">Halaman gagal ditampilkan.</p></div></div></div></div>`;
  }
  void v.offsetWidth; v.className = "fade-in";
  kp.forEach(([i, x]) => { const e = $("#" + i); if (e && x != null) e.value = x; });
  if (p == "dash") dashCharts(); else killCharts();
}

/* ---------- Notifikasi (bell) ---------- */
function attention() {
  const s = stat(saved().filter(a => mo(a) == mk(TODAY)));
  const att = [];
  if (!ro() && mineD().length) att.push([mineD().length + " aktivitas belum disimpan", "Buka Daily Report", "daily"]);
  if (!ro() && !acts.some(a => a.u == me.n && a.d == TODAY)) att.push(["Laporan hari ini belum diisi", "Isi sekarang", "daily"]);
  if (s.h) att.push([s.h + " pekerjaan berstatus Hold", "Lihat Weekly Report", "weekly"]);
  const late = vdocs().filter(d => sType(d.st) == "open" && d.sd && d.sd != "-" && d.sd < TODAY);
  if (late.length) att.push([late.length + " dokumen berjalan melewati target penyerahan", "Lihat Approval", "appr"]);
  return att;
}
function bell() {
  const att = attention(), nb = $("#nb"), nm = $("#nm");
  if (nb) { nb.textContent = att.length; nb.style.display = att.length ? "" : "none"; }
  if (!nm) return;
  nm.innerHTML = `<div class="notification-menu-header"><span>Notifikasi</span>${att.length ? `<span class="badge badge-primary">${att.length} baru</span>` : ""}</div>`
    + (att.length
      ? att.map(x => `<button type="button" class="dropdown-item notification-menu-item is-unread" onclick="go('${x[2]}')">
          <span class="notification-menu-title">${esc(x[0])}</span>
          <span class="notification-menu-meta">${esc(x[1])}</span>
        </button>`).join("")
      : `<div class="notification-menu-empty">Tidak ada notifikasi baru.</div>`)
    + `<a href="#" class="notification-menu-footer" onclick="go('dash');return false;">Lihat Dashboard</a>`;
}

/* ---------- Chart dashboard (Chart.js v4) ---------- */
let charts = [];
function killCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) { /* sudah hancur */ } }); charts = []; }
function chartColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  return { bar: g("--primary-600"), barHover: g("--primary-500"), blue: g("--info-600"), ok: g("--success-600"), wn: g("--warning-600"), er: g("--danger-600"), mu: g("--gray-400"), line: g("--gray-100"), tick: g("--gray-500"), surface: g("--surface"), tipBg: g("--gray-950"), tipFg: g("--gray-50") };
}
function mkChart(id, cfg) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  const c = new Chart(el, cfg);
  charts.push(c);
  if (document.hidden) c.update("none");
}
function dashCharts() {
  killCharts();
  if (!window.Chart) return;
  const C = chartColors();
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = C.tick;
  const days = { "90d": 90, "30d": 30, "7d": 7 }[dashRange] || 30;
  const ds = [];
  for (let i = days - 1; i >= 0; i--) ds.push(addDays(TODAY, -i));
  const wl = saved();
  const done = ds.map(d => wl.filter(a => a.d == d && a.r == "Done").length);
  const proc = ds.map(d => wl.filter(a => a.d == d && a.r != "Done").length);
  const rgba = (hex, a) => {
    const h = hex.replace("#", "");
    const n = parseInt(h.length == 3 ? h.split("").map(c => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const el = document.getElementById("chArea");
  const grad = (color, top) => {
    if (!el) return rgba(color, top);
    const g = el.getContext("2d").createLinearGradient(0, 0, 0, 250);
    g.addColorStop(0, rgba(color, top));
    g.addColorStop(1, rgba(color, .03));
    return g;
  };
  mkChart("chArea", {
    type: "line",
    data: {
      labels: ds.map(d => fdm(d)),
      datasets: [
        { label: "Done", data: done, borderColor: C.bar, backgroundColor: grad(C.bar, .45), fill: true, tension: .4, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: C.bar },
        { label: "Proses", data: proc, borderColor: C.mu, backgroundColor: grad(C.mu, .3), fill: true, tension: .4, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: C.mu }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: C.tipBg, titleColor: C.tipFg, bodyColor: C.tipFg, cornerRadius: 8, padding: 12, displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: days == 7 ? 7 : 8, maxRotation: 0 } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: C.line }, border: { display: false } }
      }
    }
  });
}

/* ---------- Komponen tampilan ---------- */

// Wrapper layout: seluruh halaman dibungkus satu card penuh
function pageWrap(title, subtitle, actionsHtml, bodyHtml) {
  return `
    <section class="content">
      <div class="container-fluid">
        <div class="page-card">
          <div class="page-card-header">
            <div class="page-header">
              <div class="page-header-text">
                <p class="page-eyebrow">OD Report</p>
                <h1 class="page-title">${title}</h1>
                ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
              </div>
              ${actionsHtml ? `<div class="page-actions">${actionsHtml}</div>` : ""}
            </div>
          </div>
          <div class="page-card-body">
            ${bodyHtml}
          </div>
        </div>
      </div>
    </section>`;
}

const tabs = v => `<div class="tabs">${team.map((u, i) => [u, i]).filter(([u]) => canSeeAll() || u.n == me.n).map(([u, i]) => `<button type="button" class="${u.n == v ? "on" : ""}" onclick="setFp(${i})">${esc(u.n)} <span class="text-muted" style="font-weight:400">&middot; ${u.p}</span></button>`).join("")}</div>`;
const setFp = i => { if (team[i] && (canSeeAll() || team[i].n == me.n)) { fp = team[i].n; go(cur); } };
const openU = i => { if (team[i] && (canSeeAll() || team[i].n == me.n)) { fp = team[i].n; go("weekly"); } };
const dTitle = id => { const d = id && docs.find(x => x.id == id); return d ? d.t : ""; };
const docOpts = sel => { const l = sortDocs(vdocs().filter(d => sType(d.st) == "open")).slice(0, 80), x = docs.find(d => d.id == sel); if (x && !l.includes(x)) l.unshift(x); return l.map(d => `<option value="${esc(d.id)}" ${d.id == sel ? "selected" : ""}>${esc(d.j)} · ${esc(d.t.slice(0, 70))}</option>`).join(""); };

/* ---------- Halaman ---------- */
const V = {
  dash() {
    const wl = saved(), sAll = stat(wl);
    const m0 = mk(TODAY), s = stat(wl.filter(a => mo(a) == m0));
    const att = attention();
    const vt = vteam(), vd = vdocs();
    const doneToday = vt.filter(u => acts.some(a => a.u == u.n && a.d == TODAY && a.sv)).length;
    const dp = vd.filter(d => sType(d.st) == "open").length;
    const doneDocs = vd.filter(d => sType(d.st) == "done").length;
    const NC = !window.Chart;

    // Tren minggu ini vs minggu lalu untuk badge kartu section
    const ws = wkStart(TODAY), lw = addDays(ws, -7);
    const tw = wl.filter(a => wkK(a) == ws).length, lastw = wl.filter(a => wkK(a) == lw).length;
    const trend = lastw ? Math.round((tw - lastw) / lastw * 100) : (tw ? 100 : 0);

    const secCard = (page, label, value, badge, up, f1, f2) => `
      <div class="col-xl-3 col-sm-6 mb-3">
        <a href="#" class="card sec-card" onclick="go('${page}');return false;">
          <div class="sec-head">
            <div class="min-w-0">
              <p class="sec-label">${label}</p>
              <p class="sec-value">${value}</p>
            </div>
            <span class="badge sec-badge ${up ? "up" : "down"}"><i class="fas fa-arrow-${up ? "up" : "down"}"></i>${badge}</span>
          </div>
          <div class="sec-foot">
            <div class="sec-foot-main">${f1}<i class="fas fa-arrow-${up ? "up" : "down"}"></i></div>
            <div class="sec-foot-sub">${f2}</div>
          </div>
        </a>
      </div>`;

    const attHtml = att.length ? `
      <div class="alert alert-warning mb-3">
        <div class="d-flex align-items-center mb-1">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <strong>Perlu Perhatian</strong>
        </div>
        ${att.map(x => `<div class="d-flex justify-content-between align-items-center py-1 att-row">
          <span>${esc(x[0])}</span>
          <a href="#" class="btn btn-xs btn-default ml-2" onclick="go('${x[2]}');return false;">Buka</a>
        </div>`).join("")}
      </div>` : "";

    // Chart area interaktif (90/30/7 hari)
    const days = { "90d": 90, "30d": 30, "7d": 7 }[dashRange] || 30;
    const rStart = addDays(TODAY, -(days - 1));
    const areaTotal = wl.filter(a => a.d >= rStart && a.d <= TODAY).length;
    const rangeBtn = (r, lb) => `<button type="button" class="btn ${dashRange == r ? "active" : ""}" onclick="setDashRange('${r}')">${lb}</button>`;
    const areaCard = `
      <div class="card">
        <div class="card-header dash-area-head">
          <div class="min-w-0">
            <h3 class="card-title">Aktivitas Tersimpan</h3>
            <p class="card-subtitle">${fd(rStart)} &ndash; ${fd(TODAY)} &middot; ${areaTotal} aktivitas</p>
          </div>
          <div class="d-flex align-items-center ml-auto">
            <div class="btn-group filter-tabs range-toggle" role="group" aria-label="Rentang waktu">
              ${rangeBtn("90d", "90 hari")}${rangeBtn("30d", "30 hari")}${rangeBtn("7d", "7 hari")}
            </div>
            <select class="form-control custom-select range-select" onchange="setDashRange(this.value)" aria-label="Rentang waktu">
              <option value="90d" ${dashRange == "90d" ? "selected" : ""}>90 hari terakhir</option>
              <option value="30d" ${dashRange == "30d" ? "selected" : ""}>30 hari terakhir</option>
              <option value="7d" ${dashRange == "7d" ? "selected" : ""}>7 hari terakhir</option>
            </select>
          </div>
        </div>
        <div class="card-body">
          ${NC ? `<div class="empty-state" style="padding:1.5rem 1rem"><span class="empty-state-icon"><i class="fas fa-chart-area"></i></span><p class="empty-state-text">Grafik tidak tersedia.</p></div>`
             : `<div class="dash-area"><canvas id="chArea"></canvas></div>`}
          <div class="dash-area-legend">
            <span><i style="background:var(--primary-600)"></i>Done</span>
            <span><i style="background:var(--gray-400)"></i>On Progress / Hold</span>
          </div>
        </div>
      </div>`;

    // Data table bertab + pagination (10 baris/halaman)
    const PER = 10;
    // Leader/Viewer melihat aktivitas semua orang: kelompokkan per orang (urutan tim), lalu terbaru di atas
    const grpActs = canSeeAll() && new Set(wl.map(a => a.u)).size > 1;
    const uIdx = n => { const i = team.findIndex(u => u.n == n); return i < 0 ? team.length : i; };
    const actsSorted = wl.slice().sort((a, b) =>
      (grpActs && a.u != b.u ? (uIdx(a.u) - uIdx(b.u) || String(a.u).localeCompare(String(b.u))) : 0)
      || (a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id));
    const actCnt = {};
    wl.forEach(a => { actCnt[a.u] = (actCnt[a.u] || 0) + 1; });
    const docsSorted = sortDocs(vd);
    const rows = dashTab == "acts" ? actsSorted : docsSorted;
    const np = Math.max(1, Math.ceil(rows.length / PER));
    if (dashPage >= np) dashPage = np - 1;
    if (dashPage < 0) dashPage = 0;
    const slice = rows.slice(dashPage * PER, dashPage * PER + PER);
    const canEdit = a => !ro() && (a.u == me.n || lead());

    const actStBadge = r => {
      const m = { Done: ["ok", "check-circle"], Hold: ["wn", "pause-circle"] }[r] || ["ac", "circle-notch"];
      return `<span class="badge dash-badge b-${m[0]}"><i class="fas fa-${m[1]}"></i>${esc(r)}</span>`;
    };
    const docStBadge = n => {
      const m = { done: ["ok", "check-circle"], cancel: ["mu", "times-circle"] }[sType(n)] || ["ac", "circle-notch"];
      return `<span class="badge dash-badge b-${m[0]}"><i class="fas fa-${m[1]}"></i>${esc(n)}</span>`;
    };

    const tableBody = dashTab == "acts"
      ? (slice.length ? slice.map((a, i) => `${grpActs && (i == 0 || slice[i - 1].u != a.u) ? `<tr class="dash-grp"><td colspan="5"><i class="fas fa-user"></i>${esc(a.u)}<span class="dash-grp-sub">${esc(pos(a.u))} &middot; ${actCnt[a.u]} aktivitas</span></td></tr>` : ""}<tr>
          <td class="text-muted" style="white-space:nowrap">${fdm(a.d)}</td>
          <td><span class="d-inline-block text-truncate" style="max-width:280px">${esc(a.n)}</span>${a.dc ? `<span class="cell-sub"><i class="far fa-file-alt"></i> ${esc(dTitle(a.dc).slice(0, 60))}</span>` : ""}</td>
          <td class="text-muted">${esc(a.u)}</td>
          <td>${actStBadge(a.r)}</td>
          <td class="text-right">${canEdit(a) ? `<button type="button" class="btn btn-xs btn-default edit" onclick="ed(${a.id})" aria-label="Edit aktivitas"><i class="fas fa-pen"></i></button>` : ""}</td>
        </tr>`).join("") : `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada aktivitas tersimpan.</td></tr>`)
      : (slice.length ? slice.map(d => `<tr>
          <td><span class="d-inline-block text-truncate" style="max-width:280px">${esc(d.t)}</span><span class="cell-sub">${esc(d.bu)}</span></td>
          <td><span class="badge dash-badge b-mu">${esc(d.j)}</span></td>
          <td class="text-muted">${esc(d.o)}</td>
          <td>${docStBadge(d.st)}</td>
          <td class="text-right"><button type="button" class="btn btn-xs btn-default" onclick="go('appr')" aria-label="Buka Approval Dokumen"><i class="fas fa-arrow-right"></i></button></td>
        </tr>`).join("") : `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada dokumen.</td></tr>`);

    const thead = dashTab == "acts"
      ? `<tr><th style="width:90px">Tanggal</th><th>Aktivitas</th><th style="width:160px">Oleh</th><th style="width:140px">Status</th><th style="width:48px"></th></tr>`
      : `<tr><th>Dokumen</th><th style="width:110px">Jenis</th><th style="width:160px">PIC</th><th style="width:140px">Status</th><th style="width:48px"></th></tr>`;

    const from = rows.length ? dashPage * PER + 1 : 0, to = Math.min(rows.length, dashPage * PER + PER);
    const tableCard = `
      <div class="card">
        <div class="card-header dash-table-head">
          <div class="dash-tabs" role="tablist">
            <button type="button" class="${dashTab == "acts" ? "on" : ""}" onclick="setDashTab('acts')">Aktivitas<span class="dash-tab-count">${actsSorted.length}</span></button>
            <button type="button" class="${dashTab == "docs" ? "on" : ""}" onclick="setDashTab('docs')">Dokumen<span class="dash-tab-count">${docsSorted.length}</span></button>
          </div>
          ${ro() ? "" : `<button type="button" class="btn btn-default btn-sm ml-auto" onclick="go('daily')"><i class="fas fa-plus"></i>Tambah Laporan</button>`}
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table dash-table mb-0"><thead>${thead}</thead><tbody>${tableBody}</tbody></table>
          </div>
        </div>
        <div class="card-footer dash-pager">
          <span class="text-muted small">Menampilkan ${from}&ndash;${to} dari ${rows.length}</span>
          <div class="btn-group">
            <button type="button" class="btn btn-default btn-sm" ${dashPage == 0 ? "disabled" : ""} onclick="setDashPage(${dashPage - 1})" aria-label="Halaman sebelumnya"><i class="fas fa-chevron-left"></i></button>
            <button type="button" class="btn btn-default btn-sm" ${dashPage >= np - 1 ? "disabled" : ""} onclick="setDashPage(${dashPage + 1})" aria-label="Halaman berikutnya"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>`;

    const belum = vt.length - doneToday;
    const body = `
      ${attHtml}
      <div class="row">
        ${secCard("weekly", "Total Aktivitas", sAll.t, (trend > 0 ? "+" : "") + trend + "%", trend >= 0, trend >= 0 ? "Tren naik minggu ini" : "Tren turun minggu ini", "Aktivitas tersimpan sepanjang waktu")}
        ${secCard("monthly", "Penyelesaian Bulan", s.p + "%", s.d + " done", s.p >= 50, s.d + " dari " + s.t + " aktivitas selesai", mlab(m0))}
        ${secCard("appr", "Dokumen Berjalan", dp, doneDocs + " release", doneDocs > 0, doneDocs + " dari " + vd.length + " dokumen selesai", "Approval dokumen tim")}
        ${secCard("daily", "Laporan Hari Ini", doneToday + " / " + vt.length, belum ? belum + " belum" : "lengkap", !belum, doneToday + " anggota sudah input", fdl(TODAY))}
      </div>
      ${areaCard}
      ${tableCard}`;

    return pageWrap("Dashboard", "Ringkasan aktivitas tim, progres penyelesaian, dan status dokumen Organization Development.",
      `<span class="text-muted small mr-2 d-none d-md-inline">${fdl(TODAY)}</span>` + (ro() ? "" : `<a href="#" class="btn btn-primary" onclick="go('daily');return false;"><i class="fas fa-plus"></i>Tambah Laporan</a>`),
      body);
  },

  daily() {
    const mine = mineD(), tod = acts.filter(a => a.d == TODAY && (canSeeAll() || a.u == me.n));
    const old = pf(saved().filter(a => a.d < TODAY && !a.imp)), ds2 = [...new Set(old.map(a => a.d))].sort().reverse();
    const hasSaved = acts.some(a => a.u == me.n && a.d == TODAY && a.sv && !a.imp);

    const body = `<div class="row">
      <div class="col-lg-8">
        <div class="card edit">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-plus-circle mr-2 text-muted"></i>Input Laporan</h3>
          </div>
          <div class="card-body">
            <div class="add-row">
              <input id="nn" class="form-control add-row-input" maxlength="200" placeholder="Nama pekerjaan…" onkeydown="if(event.key=='Enter'){event.preventDefault();addA()}">
              <select id="rr" class="form-control custom-select add-row-select" aria-label="Hasil">
                <option>Done</option><option>On Progress</option><option>Hold</option>
              </select>
              <button type="button" class="btn btn-primary add-row-btn" onclick="addA()"><i class="fas fa-plus"></i></button>
            </div>
            <details class="more mt-2">
              <summary>+ Detail tambahan</summary>
              <div class="f mt-2">
                <div class="w"><label>Dokumen terkait</label><select id="rd" class="form-control custom-select"><option value="">Tidak ada</option>${docOpts("")}</select></div>
                <div><label>Kendala</label><input id="kk" class="form-control" maxlength="300" placeholder="Opsional"></div>
                <div><label>Solusi</label><input id="ss" class="form-control" maxlength="300" placeholder="Opsional"></div>
                <div class="w"><label>Keterangan</label><input id="ee" class="form-control" maxlength="300" placeholder="Opsional"></div>
              </div>
            </details>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Aktivitas Hari Ini</h3>
            <span class="badge badge-secondary ml-2">${mine.length}</span>
            <div class="card-tools ml-auto edit d-flex gap-1">
              ${mine.length ? `<button type="button" class="btn btn-primary btn-sm" onclick="gen()"><i class="fas fa-file-alt mr-1"></i>Generate</button>` : ""}
              ${!mine.length && hasSaved ? `<button type="button" class="btn btn-default btn-sm" onclick="reopen()">Buka Kembali</button>` : ""}
            </div>
          </div>
          <div class="card-body p-0">
            ${mine.length ? `<table class="table table-hover mb-0">
              <tbody>
                ${mine.map((a, i) => `<tr>
                  <td class="text-center text-muted" style="width:40px">${i + 1}</td>
                  <td>
                    <span class="font-weight-500">${esc(a.n)}</span>
                    ${actBadge(a.r).replace('<span class="st', '<span class="st ml-1')}
                    ${a.dc && dTitle(a.dc) ? `<span class="badge badge-secondary ml-1">${esc(dTitle(a.dc).slice(0,40))}</span>` : ""}
                    ${a.k != "-" ? `<div class="cell-sub"><b>Kendala:</b> ${esc(a.k)} &middot; <b>Solusi:</b> ${esc(a.s)}</div>` : ""}
                  </td>
                  <td class="text-right edit" style="white-space:nowrap">
                    <button type="button" class="btn btn-xs btn-default" onclick="mv(${a.id},-1)"><i class="fas fa-arrow-up"></i></button>
                    <button type="button" class="btn btn-xs btn-default" onclick="mv(${a.id},1)"><i class="fas fa-arrow-down"></i></button>
                    <button type="button" class="btn btn-xs btn-default" onclick="ed(${a.id})">Edit</button>
                    <button type="button" class="btn btn-xs btn-danger" onclick="del(${a.id})">Hapus</button>
                  </td>
                </tr>`).join("")}
              </tbody>
            </table>` : `<div class="empty-state"><span class="empty-state-icon"><i class="fas fa-clipboard"></i></span><p class="empty-state-title">Belum ada aktivitas</p><p class="empty-state-text">Tambah pekerjaan hari ini di form di atas.</p></div>`}
          </div>
        </div>

        ${prev ? `<div class="card">
          <div class="card-header">
            <h3 class="card-title">Preview Laporan</h3>
            <div class="card-tools ml-auto d-flex gap-1">
              <button type="button" class="btn btn-sm btn-default" onclick="cp()"><i class="fas fa-copy mr-1"></i>Salin</button>
              <button type="button" class="btn btn-sm btn-default" onclick="printPrev()"><i class="fas fa-print mr-1"></i>Cetak</button>
              <button type="button" class="btn btn-sm btn-primary" onclick="saveRep()"><i class="fas fa-save mr-1"></i>Simpan Laporan</button>
            </div>
          </div>
          <div class="card-body"><pre id="pv">${esc(prev)}</pre></div>
        </div>` : ""}
      </div>

      <div class="col-lg-4">
        <div class="card">
          <div class="card-header"><h3 class="card-title">${canSeeAll() ? "Status Tim Hari Ini" : "Status Saya Hari Ini"}</h3></div>
          <div class="card-body p-0">
            ${vteam().map(u => {
              const x = tod.filter(a => a.u == u.n);
              const cl = x.length && x.every(a => a.sv) ? "ok" : x.length ? "wn" : "mu";
              const lb = x.length ? (x.every(a => a.sv) ? "Tersimpan" : "Draft") : "Belum input";
              return `<div class="px-3 py-2 border-bottom">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <span class="font-weight-600">${esc(u.n)}</span>
                    <small class="text-muted ml-1">${esc(u.p)}</small>
                  </div>
                  <span class="st st-${cl}"><i class="st-dot"></i>${lb}</span>
                </div>
                ${x.map(a => `<div class="cell-sub mt-1">&bull; ${esc(a.n)} <span class="text-muted">(${esc(a.r)})</span></div>`).join("")}
              </div>`;
            }).join("")}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Riwayat</h3></div>
          <div class="card-body">
            ${tabs(fp)}
            <div class="mt-3">
              ${ds2.length ? ds2.map(d => `
                <details class="hist-details">
                  <summary class="font-weight-500">${fd(d)} <span class="text-muted">&middot; ${old.filter(a => a.d == d).length} item</span></summary>
                  <div class="hist-body">
                    ${old.filter(a => a.d == d).map(a => `<div class="d-flex align-items-center justify-content-between py-1">
                      <div>
                        <span>${esc(a.n)}</span>
                        ${actBadge(a.r).replace('<span class="st', '<span class="st ml-1')}
                      </div>
                      ${(lead() || a.u == me.n) && !ro() ? `<div class="edit d-flex gap-1 ml-2">
                        <button type="button" class="btn btn-xs btn-default" onclick="ed(${a.id})">Edit</button>
                        <button type="button" class="btn btn-xs btn-danger" onclick="del(${a.id})">Hapus</button>
                      </div>` : ""}
                    </div>`).join("")}
                  </div>
                </details>`).join("") : '<p class="text-muted small">Belum ada riwayat.</p>'}
            </div>
          </div>
        </div>
      </div>
    </div>`;

    return pageWrap("Daily Report", fdl(TODAY), "", body);
  },

  weekly() {
    const wl = weeks();
    if (fw != "Semua" && !wl.includes(fw)) fw = "Semua";
    const wk = [["Semua", "Semua minggu"], ...wl.map(k => [k, wkLab(k) + " (" + wkRng(k) + ")"])];
    const base = saved().filter(a => fw == "Semua" || wkK(a) == fw), q = fq.toLowerCase();
    const l = pf(base.filter(a => (fs == "Semua" || a.r == fs) && (!q || a.n.toLowerCase().includes(q))));
    const rows = wg(l), byW = {};
    rows.forEach(a => (byW[wkK(a)] = byW[wkK(a)] || []).push(a));

    const secs = Object.keys(byW).sort().reverse().map((k, ix) => {
      const it = byW[k], s = stat(it);
      const trows = it.map((a, i) => {
        const extra = [
          a.c > 1 ? `<span class="badge badge-secondary">${a.c}×</span>` : "",
          dTitle(a.dc) ? `<span class="badge badge-secondary">${esc(dTitle(a.dc).slice(0,40))}</span>` : "",
        ].filter(Boolean).join(" ");
        const notes = [
          a.k != "-" ? `<div class="wk-note"><span class="wk-note-label">Kendala</span>${esc(a.k)}</div>` : "",
          a.s != "-" ? `<div class="wk-note"><span class="wk-note-label">Solusi</span>${esc(a.s)}</div>` : "",
          a.ke != "-" ? `<div class="wk-note"><span class="wk-note-label">Ket.</span>${esc(a.ke)}</div>` : "",
        ].filter(Boolean).join("");
        return `<tr>
          <td class="text-center text-muted" style="width:48px">${i + 1}</td>
          <td>
            <span class="font-weight-500">${esc(a.n)}</span>
            ${extra ? `<div class="mt-1 d-flex flex-wrap gap-1">${extra}</div>` : ""}
            ${notes}
          </td>
          <td class="text-right" style="white-space:nowrap">
            ${actBadge(a.r)}
          </td>
        </tr>`;
      }).join("");

      return `<div class="wsec-wrap${ix < 2 ? " open" : ""}">
        <div class="wsec-head" onclick="this.parentElement.classList.toggle('open')">
          <div class="wsec-title">
            <span class="wsec-week">${wkLab(k)}</span>
            <span class="text-muted small">${wkRng(k)}</span>
          </div>
          <span class="badge badge-secondary ml-auto">${s.d}/${s.t} selesai</span>
        </div>
        <div class="wsec-tbl">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead><tr><th style="width:48px" class="text-center">#</th><th>Pekerjaan</th><th class="text-right" style="width:120px">Status</th></tr></thead>
              <tbody>${trows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    }).join("");

    const body = `
      <div class="card">
        <div class="card-header filter-toolbar">
          <div class="d-flex flex-wrap gap-2 align-items-center w-100">
            <select class="form-control custom-select" style="width:auto" onchange="fw=this.value;go('weekly')">
              ${wk.map(x => `<option value="${x[0]}" ${x[0]==fw?"selected":""}>${x[1]}</option>`).join("")}
            </select>
            <select class="form-control custom-select" style="width:auto" onchange="fs=this.value;go('weekly')">
              ${["Semua","Done","On Progress","Hold"].map(x => `<option ${x==fs?"selected":""}>${x}</option>`).join("")}
            </select>
            <input class="form-control" style="width:200px" value="${esc(fq)}" placeholder="Cari pekerjaan…" onchange="fq=this.value;go('weekly')">
            <div class="ml-auto d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-default btn-sm" onclick="expOne()"><i class="fas fa-file-excel mr-1"></i>Export</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="expG('Weekly')">Export Gabungan</button>
            </div>
          </div>
          <div class="w-100">${tabs(fp)}</div>
        </div>
      </div>
      ${secs || `<div class="card"><div class="card-body"><div class="empty-state"><span class="empty-state-icon"><i class="fas fa-calendar"></i></span><p class="empty-state-title">Belum ada data</p></div></div></div>`}`;

    return pageWrap("Weekly Report", "", `<button type="button" class="btn btn-primary" onclick="expG('Weekly')"><i class="fas fa-download mr-1"></i>Export Gabungan</button>`, body);
  },

  monthly() {
    const ml = months();
    if (!ml.includes(fm)) fm = mk(TODAY);
    const l = saved().filter(a => mo(a) == fm && a.u == fp), x = stat(l);
    const rows = sortDocs(vdocs().filter(d => d.o == fp && dmo(d) == fm));
    const dn = rows.filter(d => sType(d.st) == "done").length, dc = rows.filter(d => sType(d.st) == "cancel").length;
    const js = [...new Set([...JN, ...rows.map(d => d.j)])].map(j => [j, rows.filter(d => d.j == j)]).filter(g => g[1].length);

    const kpi = (lb, v, sb) => `<div class="col-6 col-xl-3 mb-3">
      <div class="stat-tile h-100">
        <div class="min-w-0">
          <p class="stat-tile-label">${lb}</p>
          <p class="stat-tile-value">${v}</p>
          <p class="stat-tile-hint">${sb}</p>
        </div>
      </div>
    </div>`;

    const body = `
      <div class="card">
        <div class="card-header filter-toolbar">
          <div class="d-flex flex-wrap gap-2 align-items-center w-100">
            <select class="form-control custom-select" style="width:auto;min-width:220px" aria-label="Pilih bulan" onchange="fm=this.value;go('monthly')">
              ${ml.map(m => `<option value="${m}" ${m==fm?"selected":""}>${mlab(m)}</option>`).join("")}
            </select>
            <div class="ml-auto d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-default btn-sm" onclick="pvw('Word')">Word</button>
              <button type="button" class="btn btn-default btn-sm" onclick="pvw('PDF')">PDF</button>
              <button type="button" class="btn btn-default btn-sm" onclick="pvw('Excel')">Excel</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="expG('Monthly')">Export Gabungan</button>
            </div>
          </div>
          <div class="w-100">${tabs(fp)}</div>
        </div>
      </div>
      <div class="row">
        ${kpi("Aktivitas", x.t, x.d+" selesai &middot; "+x.o+" proses")}
        ${kpi("Penyelesaian", x.p+"%", x.d+" dari "+x.t+" selesai")}
        ${kpi("Dokumen", rows.length, (rows.length-dn-dc)+" proses &middot; "+dc+" batal")}
        ${kpi("Dokumen Selesai", dn, "release bulan ini")}
      </div>
      ${js.length ? js.map(([j, a]) => `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${esc(j)}</h3>
            <span class="badge badge-secondary ml-2">${a.length}</span>
          </div>
          <div class="card-body p-0 table-responsive">
            <table class="table table-hover mb-0">
              <tbody>${a.map(d => `<tr>
                <td>
                  <span class="font-weight-500">${esc(d.t)}</span>
                  <div class="cell-sub">${esc(d.bu)}${d.sub!="-"?" &middot; "+esc(d.sub):""}</div>
                </td>
                <td class="text-right" style="white-space:nowrap">
                  ${docBadge(d.st)}
                </td>
              </tr>`).join("")}</tbody>
            </table>
          </div>
        </div>`).join("") : `<div class="card"><div class="card-body"><p class="text-muted">Belum ada dokumen untuk bulan ini.</p></div></div>`}`;

    return pageWrap("Monthly Report", mlab(fm), `<button type="button" class="btn btn-primary" onclick="expG('Monthly')"><i class="fas fa-download mr-1"></i>Export Gabungan</button>`, body);
  },

  appr() {
    if (df != "Semua" && !ST.includes(df)) df = "Semua";
    const q = dq.toLowerCase(), all = vdocs().filter(d => d.t.toLowerCase().includes(q));
    const l = sortDocs(all.filter(d => df == "Semua" || d.st == df), ds), shown = l.slice(0, dlim);

    let tableRows = "", lastM = "";
    shown.forEach(d => {
      const ix = docs.indexOf(d), can = canDoc(d) && !ro(), m = dmo(d);
      const rc = acts.filter(a => a.dc == d.id && a.sv).length;
      if (ds != "open" && m != lastM) {
        lastM = m;
        tableRows += `<tr><td colspan="5" style="background:var(--gray-50);font-size:.75rem;font-weight:600;color:var(--gray-500);padding:.5rem 1.25rem">${mlab(m)}</td></tr>`;
      }
      const pic = me.p == "OD Leader"
        ? `<select class="form-control form-control-sm custom-select" style="min-width:120px" onchange="setOwner(${ix},this.value)">${team.map(t=>`<option ${t.n==d.o?"selected":""}>${esc(t.n)}</option>`).join("")}</select>`
        : `<span>${esc(d.o)}</span>`;
      const status = can
        ? `<select class="form-control form-control-sm custom-select" style="min-width:110px" onchange="setSt(${ix},this.value)">${ST.map(x=>`<option ${x==d.st?"selected":""}>${esc(x)}</option>`).join("")}</select>`
        : docBadge(d.st);
      const actions = can ? `<button type="button" class="btn btn-xs btn-default" onclick="editD(${ix})">Edit</button> <button type="button" class="btn btn-xs btn-danger" onclick="delD(${ix})">Hapus</button>` : "";
      tableRows += `<tr>
        <td>
          <span class="font-weight-500">${esc(d.t)}</span>
          ${d.ct ? `<div class="cell-sub">${esc(d.ct)}</div>` : ""}
          ${rc ? `<div class="mt-1"><button type="button" class="btn btn-xs btn-default" onclick="docActs(${ix})"><i class="fas fa-history mr-1"></i>${rc} aktivitas</button></div>` : ""}
        </td>
        <td style="white-space:nowrap">
          <span class="badge badge-secondary">${esc(d.j)}</span>
          <div class="cell-sub">${esc(d.bu)}</div>
        </td>
        <td>${pic}</td>
        <td style="white-space:nowrap">
          <div>${esc(d.sub)}</div>
          <div class="cell-sub">${esc(d.rcv)}</div>
        </td>
        <td class="text-right" style="white-space:nowrap">${status} ${actions}</td>
      </tr>`;
    });

    const chips = [["Semua", -1, all.length], ...ST.map((s, i) => [s, i, all.filter(d => d.st == s).length])].map(c =>
      `<button type="button" class="chipf ${c[0] == df ? "on" : ""}" onclick="setDf(${c[1]})">${esc(c[0])} <span class="chip-count">${c[2]}</span></button>`
    ).join("");

    const body = `
      <div class="card">
        <div class="card-header filter-toolbar">
          <div class="d-flex flex-wrap gap-2 align-items-center w-100">
            <input class="form-control" style="width:260px" placeholder="Cari judul dokumen…" value="${esc(dq)}" onchange="setD('q',this.value)">
            <select class="form-control custom-select" style="width:auto" onchange="setD('s',this.value)">
              ${[["new","Terbaru"],["old","Terlama"],["open","Belum selesai dulu"]].map(x=>`<option value="${x[0]}" ${x[0]==ds?"selected":""}>${x[1]}</option>`).join("")}
            </select>
            <div class="ml-auto d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-default btn-sm" onclick="expAna('Excel')"><i class="fas fa-file-excel mr-1"></i>Excel</button>
              <button type="button" class="btn btn-default btn-sm" onclick="expAna('PDF')">PDF</button>
              <button type="button" class="btn btn-primary btn-sm edit" onclick="addD()"><i class="fas fa-plus mr-1"></i>Tambah Dokumen</button>
            </div>
          </div>
          <div class="w-100 chips">${chips}</div>
        </div>
        ${shown.length ? `<div class="card-body p-0 table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr>
              <th>Judul Dokumen</th>
              <th>Jenis &middot; Unit</th>
              <th>PIC</th>
              <th>Serah &middot; Terima</th>
              <th class="text-right" style="width:160px">Status</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>` : `<div class="card-body"><div class="empty-state"><span class="empty-state-icon"><i class="fas fa-file-alt"></i></span><p class="empty-state-title">Tidak ada dokumen</p></div></div>`}
        ${l.length > dlim ? `<div class="card-footer text-center"><button type="button" class="btn btn-default btn-sm" onclick="dlim+=40;go('appr')">Tampilkan 40 lagi (${l.length-dlim} tersisa)</button></div>` : ""}
      </div>`;

    return pageWrap("Approval Dokumen", vdocs().length + " dokumen tercatat",
      `<button type="button" class="btn btn-primary edit" onclick="addD()"><i class="fas fa-plus mr-1"></i>Tambah Dokumen</button>`,
      body);
  },

  arc() {
    const body = `<div class="card">
      <div class="card-header"><h3 class="card-title">Impor File Excel (.xlsx)</h3></div>
      <div class="card-body">
        <p class="text-muted">Pilih file <code>.xlsx</code> dari ekspor Weekly Report atau Approval untuk diimpor ke aplikasi.</p>
        <button type="button" class="btn btn-primary edit" onclick="document.getElementById('xf').click()">
          <i class="fas fa-upload mr-1"></i>Pilih Berkas .xlsx
        </button>
        <input type="file" id="xf" accept=".xlsx,.xls" onchange="readXlsx(this)" style="display:none">
      </div>
    </div>`;
    return pageWrap("Impor Data", "Import dari file Excel Weekly atau Approval", "", body);
  },

  usr() {
    const hak = { "OD Leader": "Kelola dokumen & pengguna", "OD Staff": "Input pekerjaan & kelola dokumen sendiri", "Viewer": "Hanya melihat" };
    const body = `<div class="card">
      <div class="card-body p-0 table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr>
            <th style="width:40px" class="text-center">No</th>
            <th>Nama</th>
            <th>Username</th>
            <th>Role</th>
            <th>PIN</th>
            <th>Hak Akses</th>
            <th class="text-right" style="width:120px">Aksi</th>
          </tr></thead>
          <tbody>
            ${users.map((u, i) => `<tr>
              <td class="text-center text-muted">${i+1}</td>
              <td>
                <span class="font-weight-600">${esc(u.n)}</span>
                ${u === me ? ' <span class="badge badge-secondary ml-1">Anda</span>' : ""}
              </td>
              <td class="text-muted uname">${esc(u.u)}</td>
              <td><span class="badge badge-secondary">${u.p}</span></td>
              <td>${u.pin == defPinHash ? '<span class="badge badge-warning">Default</span>' : '<span class="badge badge-secondary">Disetel</span>'}</td>
              <td class="text-muted" style="font-size:.875rem">${hak[u.p]}</td>
              <td class="text-right" style="white-space:nowrap">
                ${lead() ? `<button type="button" class="btn btn-xs btn-default" onclick="editU(${i})">Edit</button> <button type="button" class="btn btn-xs btn-danger ml-1" onclick="delU(${i})">Hapus</button>` : ""}
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
    return pageWrap("User Management", users.length + " pengguna terdaftar",
      lead() ? `<button type="button" class="btn btn-primary" onclick="addU()"><i class="fas fa-plus mr-1"></i>Tambah Pengguna</button>` : "",
      body);
  },

  set() {
    const body = `
      <div class="row">
        <div class="col-lg-6">
          <div class="card">
            <div class="card-header"><h3 class="card-title">Tampilan</h3></div>
            <div class="card-body">
              <button type="button" class="btn btn-default" onclick="toggleTheme()"><i class="fas fa-adjust mr-1"></i>Ganti Mode Gelap / Terang</button>
            </div>
          </div>
          ${lead() ? `
          <div class="card">
            <div class="card-header"><h3 class="card-title">Status Dokumen</h3></div>
            <div class="card-body">
              ${statuses.map((s,i) => `<div class="d-flex align-items-center gap-2 mb-2">
                <input class="form-control" style="max-width:200px" value="${esc(s.n)}" maxlength="30" onchange="stName(${i},this.value)">
                <select class="form-control custom-select" style="max-width:150px" onchange="stKind(${i},this.value)">
                  ${[["open","Berjalan"],["done","Selesai"],["cancel","Batal"]].map(k=>`<option value="${k[0]}" ${k[0]==s.t?"selected":""}>${k[1]}</option>`).join("")}
                </select>
                <small class="text-muted">${docs.filter(d=>d.st==s.n).length} dok.</small>
                <button type="button" class="btn btn-xs btn-danger" onclick="stDel(${i})">Hapus</button>
              </div>`).join("")}
              <button type="button" class="btn btn-default btn-sm mt-1" onclick="stAdd()"><i class="fas fa-plus mr-1"></i>Tambah Status</button>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">PIC Bawaan Dokumen</h3></div>
            <div class="card-body">
              <div class="f">
                ${JN.map((j,i) => `<div>
                  <label>${j}</label>
                  <select class="form-control custom-select" onchange="setPicDef(${i},this.value)">
                    ${team.map(t=>`<option ${t.n==picFor(j)?"selected":""}>${esc(t.n)}</option>`).join("")}
                  </select>
                </div>`).join("")}
              </div>
            </div>
          </div>` : ""}
        </div>
        <div class="col-lg-6">
          <div class="card edit">
            <div class="card-header"><h3 class="card-title">Penyimpanan Data</h3></div>
            <div class="card-body">
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-primary" onclick="backup()"><i class="fas fa-download mr-1"></i>Backup (.json)</button>
                <button type="button" class="btn btn-default" onclick="document.getElementById('rf').click()"><i class="fas fa-upload mr-1"></i>Pulihkan Backup</button>
                <input type="file" id="rf" accept="application/json,.json" onchange="restore(this)" style="display:none">
                <button type="button" class="btn btn-default" onclick="go('arc')"><i class="fas fa-file-excel mr-1"></i>Impor Excel</button>
              </div>
            </div>
          </div>
          ${ro() ? "" : syncCard()}
          <div class="card edit danger-zone">
            <div class="card-header"><h3 class="card-title text-danger"><i class="fas fa-exclamation-triangle mr-2"></i>Tindakan Lanjutan</h3></div>
            <div class="card-body">
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-default" onclick="resetDemo()">Kembalikan Data Contoh</button>
                <button type="button" class="btn btn-danger" onclick="clearAll()">Kosongkan Semua Data</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    return pageWrap("Pengaturan", "", "", body);
  }
};


/* ---------- Daily: aksi ---------- */
function addA() {
  if (ro()) return;
  const n = $("#nn").value.trim();
  if (!n) return toast("Nama pekerjaan wajib diisi");
  const a = A(TODAY, me.n, n, $("#rr").value, $("#kk").value.trim() || "-", $("#ss").value.trim() || "-", 0, $("#ee").value.trim() || "-");
  a.dc = $("#rd") ? $("#rd").value : "";
  a.g = newId();          // SYNC ID: hanya pekerjaan dari Daily Report yang dikirim ke Google Sheets
  acts.unshift(a);
  ["nn", "kk", "ss", "ee"].forEach(i => $("#" + i).value = "");
  prev = ""; go("daily"); toast("Aktivitas ditambahkan");
}
function mv(id, d) {
  const m = mineD(), i = m.findIndex(a => a.id == id), j = i + d;
  if (i < 0 || j < 0 || j >= m.length) return;
  const x = acts.indexOf(m[i]), y = acts.indexOf(m[j]);
  [acts[x], acts[y]] = [acts[y], acts[x]];
  prev = ""; go("daily");
}
function gen() {
  if (lead()) return genLead();
  prev = "DAILY REPORT · " + fdl(TODAY) + "\n" + me.n + "\n\n" + mineD().map((a, i) => `${i + 1}. ${a.n}\n   *Hasil* : ${a.r}\n   *Kendala* : ${a.k}\n   *Solusi* : ${a.s}`).join("\n\n");
  go("daily");
}
// OD Leader: format Afternoon Briefing gabungan tim. Bagian Leader diberi nama tebal,
// bagian anggota lain (pekerjaan hari ini) menyusul tanpa nama. Nama pekerjaan otomatis KAPITAL.
function genLead() {
  const item = (a, i) => `${i + 1}. ${a.n.toUpperCase()}\n   *Hasil* : ${a.r}\n   *Kendala* : ${a.k}\n   *Solusi* : ${a.s}`;
  const list = l => l.map(item).join("\n\n");
  const others = team.filter(u => u.n != me.n)
    .map(u => acts.filter(a => a.u == u.n && a.d == TODAY))
    .filter(l => l.length);
  prev = "Terlampir Bu Arleni\n*Afternoon Briefing BusDev*\n(" + fdl(TODAY) + ")\n\n"
    + "*" + me.n.split(" ")[0] + "*\n" + list(mineD())
    + others.map(l => "\n\n" + list(l)).join("");
  go("daily");
}
function cp() {
  const t = $("#pv") ? $("#pv").textContent : "";
  const fb = () => toast("Salin manual dari preview");
  try { navigator.clipboard.writeText(t).then(() => toast("Laporan disalin"), fb); } catch (e) { fb(); }
}
function printPrev() { printDoc("Daily Report", `<h1>Daily Report</h1><pre>${esc(prev)}</pre>`); }
function saveRep() { mineD().forEach(a => a.sv = 1); prev = ""; go("daily"); toast("Tersimpan · otomatis masuk Weekly & Monthly"); }
function del(id) {
  const o = acts.find(x => x.id == id);
  if (!o || ro() || (o.u != me.n && !lead())) return;
  modal("Hapus aktivitas?", '<p class="text-muted">Aktivitas ini akan dihapus permanen.</p>', () => { syncQueueDel(o); acts = acts.filter(a => a.id != id); prev = ""; go("daily"); toast("Aktivitas dihapus"); }, "Hapus");
}
function ed(id) {
  const a = acts.find(x => x.id == id);
  if (!a || ro() || (a.u != me.n && !lead())) return;
  modal("Edit aktivitas", `<div class="f">
    <div class="w"><label>Nama pekerjaan</label><input id="en" class="form-control" maxlength="200" value="${esc(a.n)}"></div>
    <div><label>Hasil</label><select id="er" class="form-control custom-select">${["Done","On Progress","Hold"].map(x=>`<option ${x==a.r?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="w"><label>Dokumen terkait</label><select id="ed2" class="form-control custom-select"><option value="">Tidak ada</option>${docOpts(a.dc)}</select></div>
    <div><label>Kendala</label><input id="ek" class="form-control" maxlength="300" value="${esc(a.k)}"></div>
    <div><label>Solusi</label><input id="es" class="form-control" maxlength="300" value="${esc(a.s)}"></div>
    <div class="w"><label>Keterangan</label><input id="ee2" class="form-control" maxlength="300" value="${esc(a.ke)}"></div>
  </div>`, () => {
    const n = $("#en").value.trim();
    if (!n) { toast("Nama pekerjaan wajib diisi"); return false; }
    a.n = n; a.r = $("#er").value; a.dc = $("#ed2").value; a.k = $("#ek").value.trim() || "-"; a.s = $("#es").value.trim() || "-"; a.ke = $("#ee2").value.trim() || "-";
    prev = ""; go("daily"); toast("Aktivitas diperbarui");
  });
}

/* ---------- Dokumen ---------- */
function addD() {
  modal("Tambah dokumen", `<div class="f">
    <div class="w"><label>Judul dokumen</label><input id="dt1" class="form-control" maxlength="250"></div>
    <div><label>Jenis</label><select id="dj" class="form-control custom-select" onchange="document.getElementById('dp').value=picFor(this.value)">${JN.map(x=>`<option>${x}</option>`).join("")}</select></div>
    <div><label>Badan usaha</label><input id="db" class="form-control" maxlength="60" list="bul" placeholder="mis. CV CS"><datalist id="bul">${BU.map(x=>`<option value="${x}">`).join("")}</datalist></div>
    <div><label>PIC</label><select id="dp" class="form-control custom-select">${vteam().map(t=>`<option ${t.n==picFor(JN[0])?"selected":""}>${esc(t.n)}</option>`).join("")}</select></div>
    <div><label>Status</label><select id="ds2" class="form-control custom-select">${ST.map(x=>`<option ${x==stFirst("open")?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
  </div>`, () => {
    const t = $("#dt1").value.trim();
    if (!t) { toast("Judul wajib diisi"); return false; }
    docs.push({ id: newId(), t, j: $("#dj").value, bu: $("#db").value.trim() || "-", st: $("#ds2").value || stFirst("open"), o: canSeeAll() ? ($("#dp").value || picFor($("#dj").value)) : me.n, sub: ddmm(TODAY), rcv: "-", mo: mk(TODAY), ct: "" });
    go("appr"); toast("Dokumen ditambahkan");
  });
}
function setSt(i, v) {
  const d = docs[i];
  if (!d || ro() || !canDoc(d) || !ST.includes(v)) return;
  d.st = v;
  if (sType(v) == "done" && d.rcv == "-") d.rcv = ddmm(TODAY);
  go("appr"); toast("Status diubah");
}
function setDf(i) { df = i < 0 ? "Semua" : (ST[i] || "Semua"); dlim = 40; go("appr"); }
function docActs(ix) {
  const d = docs[ix];
  if (!d) return;
  const l = saved().filter(a => a.dc == d.id).sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id);
  modal("Aktivitas terkait", `<p class="text-muted">${esc(d.t)}</p>${l.map(a => `<div class="border-bottom py-1" style="font-size:.875rem">${fd(a.d)} · <b>${esc(a.n)}</b> · ${esc(a.u)} ${stTag(a.r, a.r=="Done"?"ok":a.r=="Hold"?"wn":"ac")}</div>`).join("") || '<p class="text-muted">Belum ada.</p>'}`, () => true, "Tutup");
}
function stName(i, v) {
  v = v.trim().slice(0, 30); const s = statuses[i];
  if (!s || !lead()) return;
  if (!v || statuses.some((x, j) => j != i && x.n.toLowerCase() == v.toLowerCase())) { toast("Nama status kosong atau sudah dipakai"); return go("set"); }
  docs.forEach(d => { if (d.st == s.n) d.st = v; });
  s.n = v; syncSt(); go("set"); toast("Status diubah");
}
function stKind(i, t) {
  const s = statuses[i];
  if (!s || !lead()) return;
  const old = s.t; s.t = t;
  if (!statuses.some(x => x.t == "open") || !statuses.some(x => x.t == "done")) { s.t = old; toast("Minimal harus ada satu status Berjalan dan satu Selesai"); }
  go("set");
}
function stDel(i) {
  const s = statuses[i];
  if (!s || !lead()) return;
  if (docs.some(d => d.st == s.n)) return toast("Masih ada dokumen berstatus ini. Ubah dulu statusnya");
  const rest = statuses.filter((_, j) => j != i);
  if (!rest.some(x => x.t == "open") || !rest.some(x => x.t == "done")) return toast("Minimal harus ada satu status Berjalan dan satu Selesai");
  statuses.splice(i, 1); syncSt(); go("set"); toast("Status dihapus");
}
function stAdd() {
  if (!lead()) return;
  modal("Tambah status", `<div class="f">
    <div class="w"><label>Nama status</label><input id="sn" class="form-control" maxlength="30"></div>
    <div class="w"><label>Jenis</label><select id="sk" class="form-control custom-select"><option value="open">Berjalan</option><option value="done">Selesai</option><option value="cancel">Batal</option></select></div>
  </div>`, () => {
    const n = $("#sn").value.trim();
    if (!n || statuses.some(x => x.n.toLowerCase() == n.toLowerCase())) { toast("Nama kosong atau sudah dipakai"); return false; }
    statuses.push({ n, t: $("#sk").value }); syncSt(); go("set"); toast("Status ditambahkan");
  });
}
function setPicDef(i, v) { if (!lead() || !team.some(u => u.n == v)) return; owners[JN[i]] = v; go("set"); toast("PIC bawaan diubah"); }
function setOwner(i, v) {
  if (me.p != "OD Leader" || !docs[i] || !team.some(u => u.n == v)) return;
  docs[i].o = v; go("appr"); toast("PIC diubah");
}
function delD(i) {
  const d = docs[i];
  if (!d || ro() || !canDoc(d)) return;
  modal("Hapus dokumen?", `<p class="text-muted">${esc(d.t)}</p>`, () => { acts.forEach(a => { if (a.dc == d.id) a.dc = ""; }); docs.splice(i, 1); go("appr"); toast("Dokumen dihapus"); }, "Hapus");
}

/* ---------- Pengguna, laporan, dokumen: aksi tambahan ---------- */
const lead = () => me.p == "OD Leader";
const userForm = u => `<div class="f">
  <div class="w"><label>Nama lengkap</label><input id="un" class="form-control" maxlength="60" value="${esc(u ? u.n : "")}"></div>
  <div class="w"><label>Username</label><input id="uu" class="form-control" maxlength="20" autocapitalize="none" spellcheck="false" placeholder="3–20 karakter: huruf kecil, angka, . _ -" value="${esc(u ? u.u : "")}"></div>
  <div class="w"><label>Role</label><select id="ur" class="form-control custom-select">${ROLES.map(r=>`<option ${u&&u.p==r?"selected":""}>${r}</option>`).join("")}</select></div>
  <div class="w"><label>${u ? "PIN baru (kosongkan jika tidak diubah)" : "PIN (4–8 angka)"}</label><input id="up" class="form-control" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" placeholder="${u ? "Tidak diubah" : "mis. 1234"}"></div>
</div>`;
function nameOk(n, self) {
  if (!n) { toast("Nama wajib diisi"); return false; }
  if (users.some(u => u !== self && u.n.toLowerCase() == n.toLowerCase())) { toast("Nama sudah dipakai"); return false; }
  return true;
}
function userOk(un, self) {
  if (!unameOk(un)) { toast("Username harus 3–20 karakter: huruf kecil, angka, titik, garis, atau underscore"); return false; }
  if (users.some(u => u !== self && u.u == un)) { toast("Username sudah dipakai"); return false; }
  return true;
}
const hasData = n => acts.some(a => a.u == n) || docs.some(d => d.o == n);
function addU() {
  if (!lead()) return;
  modal("Tambah pengguna", userForm(), async () => {
    const n = $("#un").value.trim().replace(/\s+/g, " "), un = $("#uu").value.trim().toLowerCase(), p = $("#up").value.trim();
    if (!nameOk(n)) return false;
    if (!userOk(un)) return false;
    if (!pinOk(p)) { toast("PIN wajib diisi, 4–8 angka"); return false; }
    users.push({ n, u: un, p: $("#ur").value, pin: await pinHash(p) }); syncTeam(); go("usr"); toast("Pengguna ditambahkan");
  });
}
function editU(i) {
  const u = users[i];
  if (!u || !lead()) return;
  modal("Edit pengguna", userForm(u), async () => {
    const n = $("#un").value.trim().replace(/\s+/g, " "), un = $("#uu").value.trim().toLowerCase(), r = $("#ur").value, old = u.n, p = $("#up").value.trim();
    if (!nameOk(n, u)) return false;
    if (!userOk(un, u)) return false;
    if (p && !pinOk(p)) { toast("PIN harus 4–8 angka"); return false; }
    if (u.p == "OD Leader" && r != "OD Leader" && users.filter(x => x.p == "OD Leader").length < 2) { toast("Minimal harus ada satu OD Leader"); return false; }
    if (r == "Viewer" && hasData(old)) { toast("Pengguna ini punya data, tidak bisa dijadikan Viewer"); return false; }
    acts.forEach(a => { if (a.u == old) a.u = n; }); docs.forEach(d => { if (d.o == old) d.o = n; });
    if (fp == old) fp = n;
    if (p) u.pin = await pinHash(p);
    u.n = n; u.u = un; u.p = r; syncTeam(); go("usr"); toast("Pengguna diperbarui");
  });
}
function delU(i) {
  const u = users[i];
  if (!u || !lead()) return;
  if (u === me) return toast("Akun yang sedang dipakai tidak bisa dihapus");
  if (u.p == "OD Leader" && users.filter(x => x.p == "OD Leader").length < 2) return toast("Minimal harus ada satu OD Leader");
  if (hasData(u.n)) return toast("Pengguna masih punya data. Ganti PIC dokumen atau hapus datanya dulu");
  modal("Hapus pengguna?", `<p class="text-muted">${esc(u.n)}</p>`, () => { users.splice(i, 1); syncTeam(); go("usr"); toast("Pengguna dihapus"); }, "Hapus");
}
function reopen() {
  const l = acts.filter(a => a.u == me.n && a.d == TODAY && a.sv && !a.imp);
  if (ro() || !l.length) return;
  l.forEach(a => a.sv = 0); prev = ""; go("daily"); toast("Laporan dibuka kembali. Edit lalu simpan lagi");
}
function editD(i) {
  const d = docs[i];
  if (!d || ro() || !canDoc(d)) return;
  modal("Edit dokumen", `<div class="f">
    <div class="w"><label>Judul dokumen</label><input id="dt1" class="form-control" maxlength="250" value="${esc(d.t)}"></div>
    <div><label>Jenis</label><select id="dj" class="form-control custom-select">${[...new Set([...JN,d.j])].map(x=>`<option ${x==d.j?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
    <div><label>Badan usaha</label><input id="db" class="form-control" maxlength="60" list="bul" value="${esc(d.bu)}"><datalist id="bul">${BU.map(x=>`<option value="${x}">`).join("")}</datalist></div>
    <div class="w"><label>Catatan</label><input id="dc" class="form-control" maxlength="300" value="${esc(d.ct||"")}"></div>
  </div>`, () => {
    const t = $("#dt1").value.trim();
    if (!t) { toast("Judul wajib diisi"); return false; }
    d.t = t; d.j = $("#dj").value; d.bu = $("#db").value.trim() || "-"; d.ct = $("#dc").value.trim();
    go("appr"); toast("Dokumen diperbarui");
  });
}

function setD(k, v) { if (k == "q") dq = v; if (k == "f") df = v; if (k == "s") ds = v; dlim = 40; go("appr"); }

/* ---------- Monthly ---------- */
/* ---------- Ekspor (Excel/CSV, Word, PDF/cetak) ---------- */
function dl(name, mime, txt, bom) {
  const b = new Blob([(bom ? "\ufeff" : "") + txt], { type: mime + ";charset=utf-8" });
  const u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}
const csvCell = v => {
  v = String(v ?? "");
  if (/^[=+@\t\r]|^-(?!$)/.test(v)) v = "'" + v;           // cegah formula injection
  return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
const PCSS = "body{font:13px/1.5 Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px}h2{font-size:14px;margin:22px 0 6px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top;font-size:12px}th{background:#eee}pre{white-space:pre-wrap;font:13px/1.6 monospace}";
function repHtml(title, secs) {
  return `<h1>${esc(title)}</h1><p>Dicetak: ${fd(TODAY)}</p>` + secs.map(s => `<h2>${esc(s.h)}</h2>${s.rows.length ? `<table><tr>${s.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr>${s.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>` : "<p>Tidak ada data.</p>"}`).join("");
}
function printDoc(title, body) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PCSS}</style></head><body>${body}</body></html>`); d.close();
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); toast("Pilih \"Simpan sebagai PDF\" pada dialog cetak"); }
    catch (e) { toast("Gagal membuka dialog cetak"); }
    setTimeout(() => f.remove(), 60000);
  }, 300);
}
function outTable(fmt, title, secs, file) {
  if (fmt == "PDF") return printDoc(title, repHtml(title, secs));
  if (fmt == "Word") return dl(file + ".doc", "application/msword", `<html><head><meta charset="utf-8"><style>${PCSS}</style></head><body>${repHtml(title, secs)}</body></html>`);
  const lines = ["sep=;", csvCell(title), ""];
  secs.forEach(s => { lines.push(csvCell(s.h)); lines.push(s.head.map(csvCell).join(";")); s.rows.forEach(r => lines.push(r.map(csvCell).join(";"))); lines.push(""); });
  dl(file + ".csv", "text/csv", lines.join("\r\n"), true);
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function weeklySec(u, w, st) {
  const l = saved().filter(a => a.u == u && (w == "Semua" || wkK(a) == w) && (!st || st == "Semua" || a.r == st));
  return { h: pos(u) + " · " + u, head: ["No", "Week", "Detail pekerjaan", "Status", "Kendala", "Solusi", "Keterangan", "Dokumen terkait"], rows: wg(l).map((a, i) => [i + 1, wkLab(wkK(a)) + " (" + wkRng(wkK(a)) + ")", a.n + (a.c > 1 ? " ×" + a.c : ""), a.r, a.k, a.s, a.ke, dTitle(a.dc)]) };
}
function monthlySecs(u, m) {
  const x = stat(saved().filter(a => a.u == u && mo(a) == m)), d = sortDocs(docs.filter(a => a.o == u && dmo(a) == m));
  const dn = d.filter(a => sType(a.st) == "done").length, dc = d.filter(a => sType(a.st) == "cancel").length;
  return [
    { h: pos(u) + " · " + u + " · Ringkasan", head: ["Total aktivitas", "Done", "On Progress", "Hold", "Dokumen", "Selesai", "Berjalan", "Batal"], rows: [[x.t, x.d, x.o, x.h, d.length, dn, d.length - dn - dc, dc]] },
    { h: pos(u) + " · " + u + " · Achievement dokumen", head: ["No", "Achievement", "Jenis", "Badan usaha", "Status", "Catatan"], rows: d.map((a, i) => [i + 1, a.t, a.j, a.bu, a.st, a.ct || ""]) }
  ];
}
/* ---------- Export Weekly (.xlsx) mengikuti template "Weekly Report" ----------
   Satu sheet per bulan ("NOV 1-2 (2026)"), satu blok per minggu: baris judul "Posisi | Week N (07 - 13 November 2026)"
   lalu daftar pekerjaan (KAPITAL) dengan kolom Posisi di-merge per jabatan. Antar minggu dipisah satu baris kosong.
   Minggu (Sabtu-Jumat) masuk ke bulan hari Rabu-nya, sama seperti file Weekly Report yang dipakai tim. */
function loadExcelJS() {
  return new Promise((res, rej) => {
    if (window.ExcelJS) return res();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("exceljs"));
    document.head.appendChild(s);
  });
}
const POS_FULL = { "OD Leader": "Organization Development Leader", "OD Staff": "Organization Development Staff" };
function xwLab(s) {
  const e = addDays(s, 6), M = d => MONTHS[+d.slice(5, 7) - 1];
  const a = s.slice(5, 7) == e.slice(5, 7) ? s.slice(8) : s.slice(8) + " " + M(s) + (s.slice(0, 4) != e.slice(0, 4) ? " " + s.slice(0, 4) : "");
  return "Week " + wkNum(s) + " (" + a + " - " + e.slice(8) + " " + M(e) + " " + e.slice(0, 4) + ")";
}
async function expWeeklyXlsx(mem, per, st, suffix) {
  const l = saved().filter(a => mem.includes(a.u) && (per == "Semua" || wkK(a) == per) && (!st || st == "Semua" || a.r == st));
  if (!l.length) return toast("Tidak ada data untuk periode ini");
  try { await loadExcelJS(); } catch (e) { return toast("Modul Excel gagal dimuat. Pastikan internet aktif"); }
  const order = [...team.map(u => u.n).filter(n => mem.includes(n)), ...mem.filter(n => !team.some(u => u.n == n))];
  const byM = {};
  [...new Set(l.map(wkK))].sort().forEach(w => (byM[wkMonth(w)] = byM[wkMonth(w)] || []).push(w));
  const wb = new ExcelJS.Workbook();
  const thin = { style: "thin" }, bd = { top: thin, left: thin, bottom: thin, right: thin };
  const font = { name: "Calibri", size: 10 };
  Object.keys(byM).sort().forEach(m => {
    const wks = byM[m];
    const ws = wb.addWorksheet(MON3[+m.slice(5) - 1].toUpperCase() + " 1-" + Math.max(...wks.map(wkNum)) + " (" + m.slice(0, 4) + ")");
    ws.getColumn(1).width = 33.57;
    ws.getColumn(2).width = 188.86;
    let r = 1;
    wks.forEach((w, i) => {
      if (i) r++;                                                  // baris kosong antar minggu
      ["Posisi", xwLab(w)].forEach((v, j) => {
        const c = ws.getCell(r, j + 1);
        c.value = v; c.font = { ...font, bold: true }; c.border = bd;
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4B084" } };
        c.alignment = { horizontal: "center" };
      });
      r++;
      const groups = [];
      order.forEach(n => {
        const p = POS_FULL[pos(n)] || pos(n), items = wg(l.filter(a => a.u == n && wkK(a) == w)).reverse().map(a => a.n.toUpperCase()); // kronologis seperti template
        if (!items.length) return;
        const g = groups.find(x => x.p == p);
        g ? g.items.push(...items) : groups.push({ p, items });
      });
      groups.forEach(g => {
        const r0 = r;
        g.items.forEach(t => {
          const b = ws.getCell(r, 2);
          b.value = t; b.font = font; b.border = bd; b.alignment = { vertical: "middle" };
          ws.getCell(r, 1).border = bd;
          r++;
        });
        if (r - 1 > r0) ws.mergeCells(r0, 1, r - 1, 1);
        const a = ws.getCell(r0, 1);
        a.value = g.p; a.font = font; a.border = bd;
        a.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  const name = "Weekly Report " + (per == "Semua" ? "Semua Minggu" : xwLab(per)) + (suffix ? " - " + suffix : "") + ".xlsx";
  const u = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const x = document.createElement("a");
  x.href = u; x.download = name; document.body.appendChild(x); x.click(); x.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
  toast("File Excel (.xlsx) diunduh");
}
function expOne() { expWeeklyXlsx([fp], fw, fs, fp); }
function expG(k) {
  const opts = k == "Weekly" ? [["Semua", "Semua minggu"], ...weeks().map(w => [w, wkLab(w) + " (" + wkRng(w) + ")"])] : months().map(m => [m, mlab(m)]);
  modal("Export laporan gabungan · " + k, `<div class="f">
    <div class="w"><label>Anggota yang disertakan</label><div class="d-flex flex-wrap gap-2">${vteam().map(u => `<label class="d-flex align-items-center gap-1 mb-0 font-weight-500"><input type="checkbox" class="xg mr-1" value="${esc(u.n)}" checked> ${esc(u.n)} &middot; ${u.p}</label>`).join("")}</div></div>
    <div><label>Periode</label><select id="xp" class="form-control custom-select">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join("")}</select></div>
    <div><label>Format</label><select id="xf" class="form-control custom-select"><option value="Excel">${k == "Weekly" ? "Excel (.xlsx)" : "Excel (.csv)"}</option><option value="PDF">PDF (cetak)</option><option value="Word">Word (.doc)</option></select></div>
  </div><p class="text-muted mt-2">Nomor mulai ulang per posisi. Data mengikuti periode yang dipilih.</p>`,
  () => {
    const mem = [...document.querySelectorAll(".xg:checked")].map(x => x.value);
    if (!mem.length) { toast("Pilih minimal satu anggota"); return false; }
    const per = $("#xp").value, fmt = $("#xf").value, lab = (opts.find(o => o[0] == per) || [0, per])[1];
    if (k == "Weekly" && fmt == "Excel") { expWeeklyXlsx(mem, per, "Semua"); return; }
    const secs = k == "Weekly" ? mem.map(u => weeklySec(u, per, "Semua")) : mem.flatMap(u => monthlySecs(u, per));
    outTable(fmt, k + " Report · " + lab, secs, k.toLowerCase() + "-report-" + slug(String(per)));
    toast("Laporan gabungan (" + mem.length + " anggota) diproses");
  }, "Unduh");
}
function pvw(f) {
  const u = fp, x = stat(saved().filter(a => a.u == u && mo(a) == fm)), d = vdocs().filter(a => a.o == u && dmo(a) == fm);
  modal("Preview " + f, `<pre>${esc(`LAPORAN BULANAN · ${mlab(fm).toUpperCase()}\n${pos(u)} · ${u}\n\nTotal aktivitas : ${x.t}\nDone / Proses / Hold : ${x.d} / ${x.o} / ${x.h}\nDokumen dibuat : ${d.length}\nDokumen Release : ${d.filter(a => sType(a.st) == "done").length}\nDokumen Proses Approval : ${d.filter(a => sType(a.st) != "done").length}`)}</pre>`,
    () => { outTable(f, "Monthly Report · " + mlab(fm), monthlySecs(u, fm), "monthly-" + slug(u) + "-" + fm); toast(f + " diproses"); }, "Unduh");
}
function expAna(fmt) {
  const secs = [
    { h: "Progres tim", head: ["Nama", "Posisi", "Total", "Done", "On Progress", "Hold", "% Selesai"], rows: vteam().map(u => { const s = stat(saved().filter(a => a.u == u.n)); return [u.n, u.p, s.t, s.d, s.o, s.h, s.p + "%"]; }) },
    { h: "Dokumen", head: ["No", "Judul", "Jenis", "Badan usaha", "Status", "PIC", "Penyerahan", "Diterima", "Catatan"], rows: vdocs().map((d, i) => [i + 1, d.t, d.j, d.bu, d.st, d.o, d.sub, d.rcv]) }
  ];
  outTable(fmt, "Approval Dokumen", secs, "approval-dokumen-" + TODAY);
  if (fmt == "Excel") toast("File Excel (.csv) diunduh");
}

/* ---------- Impor dari Excel / Google Sheets ---------- */
// Sabtu awal "Week n" bulan m: Week 1 = minggu yang Rabu-nya Rabu pertama bulan itu.
const wkOfMonth = (m, n) => { let d = m + "-01"; while (parse(d).getUTCDay() != 3) d = addDays(d, 1); return addDays(d, 7 * (n - 1) - 4); };
function parseDate(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/), y, mm, d;
  if (m) { d = +m[1]; mm = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else { m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (!m) return null; y = +m[1]; mm = +m[2]; d = +m[3]; }
  const r = y + "-" + pad(mm) + "-" + pad(d);
  return iso(parse(r)) == r ? r : null;
}
const stDoc = x => migSt(x, statuses);
function wmRows(rw, per) {
  const g = {}; let wn = null, bad = 0;
  const err = "Kolom pertama harus berisi nomor Week (1, 2, 3, ...). Pastikan kolom WEEK ikut disalin, tanpa kolom Posisi.";
  for (const c of rw) {
    if (c[0]) { const m = c[0].match(/^(?:week\s*)?(\d{1,2})$/i); if (!m) return { err, groups: [], bad: 0 }; wn = +m[1]; }
    if (wn == null) return { err, groups: [], bad: 0 };
    if (!c[1]) { bad++; continue; }
    const s = wkOfMonth(per, wn);
    if (wkMonth(s) != per) { bad++; continue; }
    (g[s] = g[s] || []).push(c);
  }
  return { err: "", groups: Object.keys(g).sort().map(s => ({ s, c: g[s].length, rows: g[s] })), bad };
}
function dRows(rw, u) {
  const items = []; let bad = 0;
  rw.forEach(c => {
    const d = parseDate(c[0]), t = c[1];
    if (!t || !d) { bad++; return; }
    const jm = t.match(/(?:^|[^A-Za-z])(SOP|JD|IK|SE|MEMO)(?![A-Za-z])/), bm = t.match(/\[([^\]]+)\]/g), ct = c[3] && !/^catatan$/i.test(c[3]) ? c[3] : "";
    items.push({ t, j: jm ? jm[1] : "Dokumen Lainnya", bu: bm ? bm[bm.length - 1].slice(1, -1).trim() : "-", st: stDoc(c[2] || ""), o: u, sub: ddmm(d), rcv: "-", mo: mk(d), ct });
  });
  return { items: items.map(it => ({ ...it, o: it.o || picFor(it.j), id: newId() })), bad };
}
function aRows(rw, u) {
  const items = []; let bad = 0;
  rw.forEach(c => {
    if (/^\d{1,4}$/.test(c[0])) c = c.slice(1);
    const t = c[0];
    if (!t) { bad++; return; }
    const sd = parseDate(c[5]), rd = parseDate(c[6]);
    const ct = [c[4], c[7]].filter(x => x && !/^catatan$/i.test(x)).join(" · ");
    items.push({ t, j: (c[1] || "").toUpperCase() || "Dokumen Lainnya", bu: c[2] || "-", st: stDoc(c[3] || ""), o: u, sub: sd ? ddmm(sd) : "-", rcv: rd ? ddmm(rd) : "-", mo: sd ? mk(sd) : mk(TODAY), ct });
  });
  return { items: items.map(it => ({ ...it, o: it.o || picFor(it.j), id: newId() })), bad };
}
/* ---------- Impor file Excel (.xlsx): semua tab sekaligus ---------- */
let XL = null;
function loadXlsx() {
  return new Promise((res, rej) => {
    if (window.XLSX) return res();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("xlsx"));
    document.head.appendChild(s);
  });
}
function cellStr(x) {
  if (x instanceof Date) { const d = new Date(x.getTime() + 12 * 36e5); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  return String(x ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
}
function gridOf(ws) {
  const rg = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const g = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }).map(r => r.map(cellStr));
  (ws["!merges"] || []).forEach(m => {
    const v = (g[m.s.r - rg.s.r] || [])[m.s.c - rg.s.c];
    if (v == null || v === "") return;
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) { const row = g[r - rg.s.r]; if (row && (row[c - rg.s.c] === "" || row[c - rg.s.c] == null)) row[c - rg.s.c] = v; }
  });
  return g;
}
const MON_KEY = [["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["mei", 5], ["may", 5], ["jun", 6], ["jul", 7], ["agu", 8], ["agt", 8], ["ags", 8], ["aug", 8], ["sep", 9], ["okt", 10], ["oct", 10], ["nov", 11], ["des", 12], ["dec", 12]];
function monthFromTab(n) {
  const s = String(n).toLowerCase().trim(), m = MON_KEY.find(x => s.startsWith(x[0])), y = s.match(/(?:'|'|\s|-)?(\d{4}|\d{2})\s*$/);
  if (!m || !y) return null;
  let yy = +y[1]; if (yy < 100) yy += 2000;
  return yy + "-" + pad(m[1]);
}
function hdr(g, spec) {
  for (let i = 0; i < Math.min(g.length, 15); i++) {
    const r = g[i].map(c => String(c).trim().toLowerCase()), cols = {}; let ok = true;
    for (const k in spec) { cols[k] = r.findIndex(c => spec[k][0].test(c)); if (cols[k] < 0 && spec[k][1]) { ok = false; break; } }
    if (ok) return { row: i, cols };
  }
  return null;
}
const HW = { pos: [/^posisi/, 0], week: [/^week/, 1], det: [/detail pekerjaan/, 1], st: [/^status/, 1], k: [/^kendala/, 0], s: [/^solusi/, 0], ke: [/^keterangan/, 0] };
const HA = { j: [/^judul$/, 1], jn: [/^jenis$/, 1], bu: [/badan usaha/, 1], st: [/^status/, 0], pic: [/^pic/, 0], sd: [/penyerahan/, 0], rd: [/diterima/, 0], ke: [/^keterangan/, 0] };
const HD = { d: [/^tanggal$/, 1], t: [/^dokumen$/, 1], st: [/^status/, 0], ct: [/^catatan/, 0] };
function analyze(sheets) {
  const out = { weekly: [], docs: [], skipped: [] };
  sheets.forEach(([name, g]) => {
    const cell = (r, i) => i >= 0 ? String(r[i] ?? "").trim() : "";
    let h = hdr(g, HW);
    if (h) {
      const month = monthFromTab(name);
      if (!month) return out.skipped.push(name + " (nama tab tanpa bulan/tahun)");
      const c = h.cols, groups = {}; let pp = "", ww = "";
      for (let i = h.row + 1; i < g.length; i++) {
        const r = g[i], p = cell(r, c.pos), w = cell(r, c.week);
        if (p) pp = p; if (w) ww = w;
        const det = cell(r, c.det);
        if (!det) continue;
        (groups[pp] = groups[pp] || []).push([ww, det, cell(r, c.st), cell(r, c.k), cell(r, c.s), cell(r, c.ke)]);
      }
      if (Object.keys(groups).length) out.weekly.push({ name, month, groups });
      return;
    }
    h = hdr(g, HA);
    if (h) {
      const c = h.cols, rows = [];
      for (let i = h.row + 1; i < g.length; i++) { const r = g[i]; if (cell(r, c.j)) rows.push([cell(r, c.j), cell(r, c.jn), cell(r, c.bu), cell(r, c.st), cell(r, c.pic), cell(r, c.sd), cell(r, c.rd), cell(r, c.ke)]); }
      if (rows.length) out.docs.push({ name, kind: "A", rows });
      return;
    }
    h = hdr(g, HD);
    if (h) {
      const c = h.cols, rows = [];
      for (let i = h.row + 1; i < g.length; i++) { const r = g[i]; if (cell(r, c.t)) rows.push([cell(r, c.d), cell(r, c.t), cell(r, c.st), cell(r, c.ct)]); }
      if (rows.length) out.docs.push({ name, kind: "D", rows });
      return;
    }
    out.skipped.push(name);
  });
  return out;
}
async function readXlsx(inp) {
  const f = inp.files[0]; inp.value = "";
  if (!f) return;
  if (ro()) return toast("Akun Viewer tidak dapat mengimpor");
  toast("Membaca file…");
  try {
    await loadXlsx();
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
    XL = analyze(wb.SheetNames.map(n => [n, gridOf(wb.Sheets[n])]));
    showXl(f.name);
  } catch (e) { console.error(e); toast("File tidak dapat dibaca. Pastikan formatnya .xlsx dan internet aktif"); }
}
function showXl(name) {
  const X = XL;
  if (!X.weekly.length && !X.docs.length) return modal("Data tidak dikenali", `<p class="text-muted">Tidak ada tab Weekly atau Approval yang cocok di file ${esc(name)}.${X.skipped.length ? " Dilewati: " + esc(X.skipped.join(", ")) : ""}</p>`, () => true, "Tutup");
  const poss = [...new Set(X.weekly.flatMap(w => Object.keys(w.groups)))];
  const guess = p => { const t = users.find(u => u.p == (/leader|supervisor|manager|head/i.test(p) ? "OD Leader" : /staff|staf/i.test(p) ? "OD Staff" : "")); return t ? t.n : ""; };
  const opt = sel => `<option value="">Lewati</option>` + team.map(u => `<option value="${esc(u.n)}" ${u.n == sel ? "selected" : ""}>${esc(u.n)} · ${u.p}</option>`).join("");
  const minM = lastMonths(12)[11];
  const body = `<p class="text-muted">File: ${esc(name)}</p><div style="max-height:58vh;overflow:auto">
${X.weekly.length ? `<h6 class="font-weight-bold">Weekly Report</h6><p class="text-muted" style="font-size:.8rem">Posisi di sheet â†’ pengguna aplikasi</p>
${poss.map((p, i) => `<div class="d-flex align-items-center gap-2 mb-2"><span class="flex-grow-1">${esc(p||"(tanpa posisi)")}</span><select id="xp${i}" class="form-control form-control-sm custom-select" style="width:200px">${opt(guess(p))}</select></div>`).join("")}
<div class="card mt-2"><div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th></th><th>Tab</th><th>Bulan</th><th>Baris</th></tr></thead><tbody>${X.weekly.map((w,i)=>`<tr><td style="width:36px"><input type="checkbox" id="xw${i}" ${w.month>=minM?"checked":""}></td><td>${esc(w.name)}</td><td>${mlab(w.month)}<div class="cell-sub">Week 1 = ${wkRng(wkOfMonth(w.month,1))}</div></td><td style="white-space:nowrap">${Object.values(w.groups).reduce((a,r)=>a+r.length,0)}</td></tr>`).join("")}</tbody></table></div></div>
<p class="text-muted mt-1" style="font-size:.8rem">Tab lebih lama dari 12 bulan tidak dicentang secara bawaan.</p>` : ""}
${X.docs.length ? `<h6 class="font-weight-bold mt-3">Dokumen</h6>${X.docs.map((d,i)=>`<div class="d-flex align-items-center gap-2 mb-2"><input type="checkbox" id="xc${i}" checked><span class="flex-grow-1">${esc(d.name)} · ${d.kind=="A"?"Approval":"Monitoring"} · ${d.rows.length} baris</span><select id="xd${i}" class="form-control form-control-sm custom-select" style="width:160px"><option value="">Otomatis</option>${team.map(u=>`<option>${esc(u.n)}</option>`).join("")}</select></div>`).join("")}<p class="text-muted" style="font-size:.8rem">PIC otomatis sesuai jenis. Bisa dipilih manual.</p>` : ""}
${X.skipped.length ? `<p class="text-muted mt-2" style="font-size:.8rem">Dilewati: ${esc(X.skipped.join(", "))}</p>` : ""}</div>`;
  modal("Hasil pembacaan file", body, () => {
    const map = poss.map((p, i) => $("#xp" + i).value);
    let na = 0, nd = 0, dupW = 0, dupD = 0, badW = 0;
    X.weekly.forEach((w, i) => {
      if (!$("#xw" + i).checked) return;
      Object.entries(w.groups).forEach(([p, rows]) => {
        const u = map[poss.indexOf(p)];
        if (!u) return;
        const r = wmRows(rows, w.month);
        if (r.err) { badW += rows.length; return; }
        badW += r.bad;
        r.groups.forEach(g => {
          if (acts.some(x => x.imp && x.u == u && wkStart(x.d) == g.s)) { dupW += g.c; return; }
          g.rows.forEach(c => { const a = A(g.s, u, c[1], stMap(c[2]), c[3] || "-", c[4] || "-", 1, c[5] || "-"); a.imp = 1; acts.push(a); na++; });
        });
      });
    });
    X.docs.forEach((d, i) => {
      if (!$("#xc" + i).checked) return;
      const u = $("#xd" + i).value;
      (d.kind == "A" ? aRows : dRows)(d.rows, u).items.forEach(it => {
        if (docs.some(x => x.t == it.t && x.bu == it.bu && x.o == it.o && dmo(x) == it.mo)) { dupD++; return; }
        docs.push(it); nd++;
      });
    });
    fw = "Semua"; go("dash");
    const msg = `<p><b>${na}</b> aktivitas dan <b>${nd}</b> dokumen berhasil diimpor.</p><p class="text-muted">Dilewati karena sudah pernah diimpor: ${dupW} aktivitas, ${dupD} dokumen.${badW?" Baris tidak terbaca: "+badW+".":""}</p>`;
    setTimeout(() => modal("Impor selesai", msg, () => true, "Tutup"), 0);
  }, "Impor yang dicentang", 720);
}

/* ---------- Pengaturan data ---------- */
function backup() {
  dl("od-report-backup-" + TODAY + ".json", "application/json", JSON.stringify({ v: 4, exported: TODAY, users, statuses, owners, acts, docs, arch, mst }, null, 1));
  lastBackup = TODAY; go(cur); toast("Backup diunduh");
}
function restore(inp) {
  const f = inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let s;
    try { s = JSON.parse(r.result); if (!s || !Array.isArray(s.acts) || !Array.isArray(s.docs)) throw 0; }
    catch (e) { return toast("File backup tidak valid"); }
    const clean = sanitize(s);
    modal("Pulihkan data?", `<p class="text-muted">Data saat ini akan diganti: ${clean.acts.length} aktivitas dan ${clean.docs.length} dokumen dari file backup.</p>`, async () => {
      apply(clean);
      await ensurePins();
      if (!users.some(u => u.n == me.n)) { logout(); return; }
      go("set"); toast("Data dipulihkan");
    }, "Pulihkan");
  };
  r.onerror = () => toast("File tidak dapat dibaca");
  r.readAsText(f);
  inp.value = "";
}
function resetDemo() { modal("Kembalikan data contoh?", '<p class="text-muted">Semua data saat ini akan diganti dengan data contoh. PIN semua akun kembali ke 1234.</p>', async () => { seed(); await ensurePins(); go("set"); toast("Data contoh dikembalikan"); }, "Hapus"); }
function clearAll() { modal("Kosongkan semua data?", '<p class="text-muted">Seluruh aktivitas, dokumen, dan arsip akan dihapus permanen dari browser ini. Buat backup dulu bila perlu.</p>', () => { acts = []; docs = []; arch = []; mst = {}; nid = 1; prev = ""; go("set"); toast("Semua data dikosongkan"); }, "Hapus"); }

/* ---------- Sinkron ke Google Sheets (satu arah: website -> spreadsheet Weekly Report) ----------
   Setiap perangkat mengirim pekerjaan Daily Report milik user yang sedang login (yang sudah "Simpan Laporan")
   ke Apps Script (apps-script.gs). Script menulis / memperbarui baris berdasarkan SYNC ID di tab bulan
   (Nov'26, ...) pada blok Posisi + Week yang sesuai. Hanya perubahan sejak sinkron terakhir yang dikirim,
   dan aktivitas yang dihapus dikirim sebagai daftar hapus. Data contoh & hasil impor tidak pernah dikirim. */
// Diisi sekali setelah apps-script.gs di-deploy, supaya semua user langsung tersambung tanpa setting.
// Catatan: nilai di sini bisa dilihat siapa pun yang membuka source situs.
const SYNC_FROM = "2026-11-17";   // tanggal fitur sinkron mulai dipakai
const SYNC_DEFAULT = {
  url: "https://script.google.com/macros/s/AKfycbzCVaw5xf-G-YvT3Z0nOAUdhucCC9H0iG5TKJUoQy3X5FRJ7NOxCs9WUWjM8i1AvpA/exec",
  token: "memek",    // sama dengan TOKEN di apps-script.gs
  wl: "https://docs.google.com/spreadsheets/d/1gFQgBuIYo_ebic-fP5tLGJgB7pOjW3of2PbwvIIOmwA/edit"
};
const SKEY = KEY + "-sync";
const idOf = u => (String(u || "").match(/\/d\/([\w-]+)/) || [])[1] || "";
const errText = e => e == "TOKEN" ? "Kode rahasia tidak sama dengan TOKEN di apps-script.gs (atau script belum di-deploy ulang setelah diubah)" : "Gagal: " + e;
let syncCfg = { wl: "", url: "", token: "", auto: true, last: "", ok: null, msg: "", sent: {}, delq: [], log: [] };
try { Object.assign(syncCfg, JSON.parse(localStorage.getItem(SKEY) || "{}")); } catch (e) { /* abaikan */ }
["url", "token", "wl"].forEach(k => { if (!syncCfg[k]) syncCfg[k] = SYNC_DEFAULT[k]; });
if (!syncCfg.sent || typeof syncCfg.sent != "object" || Array.isArray(syncCfg.sent)) syncCfg.sent = {};
if (!Array.isArray(syncCfg.delq)) syncCfg.delq = [];
let syncT = 0, syncBusy = false, syncAgain = false, syncTries = 0, syncLastTry = 0;
const syncStore = () => { try { localStorage.setItem(SKEY, JSON.stringify(syncCfg)); } catch (e) { /* abaikan */ } };
syncStore();
const hashStr = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return x + ":" + s.length; };
const TABM = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "AGS", "Sept", "Okt", "Nov", "Des"];
const SYNC_ST = { Done: "Closed", "On Progress": "On Progress", Hold: "Open" };   // sesuai tab Kamus
const syncReady = () => !!(syncCfg.url && syncCfg.token && idOf(syncCfg.wl));
function syncEntry(a) {
  const w = wkK(a), wm = wkMonth(w);
  return { key: a.g, u: a.u, pos: (POS_FULL[pos(a.u)] || pos(a.u)).toUpperCase(), tab: TABM[+wm.slice(5, 7) - 1] + "'" + wm.slice(2, 4), wk: wkNum(w), n: a.n, r: SYNC_ST[a.r] || a.r, k: a.k, s: a.s, ke: a.ke };
}
// Pekerjaan milik user ini yang perlu dikirim: punya SYNC ID, sudah disimpan, dan berubah sejak terakhir terkonfirmasi.
function syncPending() {
  if (!authed || !me || ro()) return { entries: [], del: [], hashes: {} };
  const E = acts.filter(a => a.g && a.sv && !a.imp && a.u == me.n).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id);
  const entries = [], hashes = {};
  E.forEach(a => { const en = syncEntry(a), h = hashStr(JSON.stringify(en)); hashes[a.g] = h; if (syncCfg.sent[a.g] != h) entries.push(en); });
  return { entries, del: syncCfg.delq.slice(), hashes };
}
function syncQueueDel(a) {
  if (!a || !a.g || !syncCfg.sent[a.g]) return;
  delete syncCfg.sent[a.g];
  if (!syncCfg.delq.includes(a.g)) syncCfg.delq.push(a.g);
  syncStore();
}
function syncMsg(m, ok) {
  syncCfg.msg = m; syncCfg.ok = ok;
  if (ok) syncCfg.last = new Date().toLocaleString("id-ID");
  syncCfg.log = [[new Date().toLocaleTimeString("id-ID"), ok === true ? "ok" : ok === false ? "x" : "…", m], ...(syncCfg.log || [])].slice(0, 8);
  syncStore();
  if (cur == "set") go("set", true);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jsonp(params) {
  return new Promise((res, rej) => {
    const cb = "odcb" + Date.now().toString(36) + Math.floor(Math.random() * 1e6), s = document.createElement("script");
    const done = () => { clearTimeout(t); delete window[cb]; s.remove(); };
    const t = setTimeout(() => { done(); rej(new Error("timeout")); }, 15000);
    window[cb] = d => { done(); res(d); };
    s.onerror = () => { done(); rej(new Error("load")); };
    s.src = syncCfg.url + "?" + new URLSearchParams({ ...params, callback: cb }).toString();
    document.head.appendChild(s);
  });
}
function formPost(url, obj) {
  // Formulir tersembunyi (text/plain): tidak kena aturan CORS, membawa sesi Google bila diperlukan.
  // Isi dibentuk agar tetap JSON valid: nama + "=" + nilai  ->  {...,"pad":"="}
  const fid = "odf" + Date.now().toString(36) + Math.floor(Math.random() * 1e5);
  const ifr = document.createElement("iframe"), f = document.createElement("form"), i = document.createElement("input");
  ifr.name = fid; ifr.style.display = "none"; ifr.setAttribute("aria-hidden", "true");
  f.method = "POST"; f.action = url; f.target = fid; f.enctype = "text/plain"; f.acceptCharset = "UTF-8"; f.style.display = "none";
  const s = JSON.stringify(obj);
  i.type = "hidden"; i.name = s.slice(0, -1) + ',"pad":"'; i.value = '"}';
  f.appendChild(i); document.body.appendChild(ifr); document.body.appendChild(f);
  f.submit();
  setTimeout(() => { f.remove(); ifr.remove(); }, 120000);
}
async function anonCheck() {
  try { const r = await fetch(syncCfg.url + "?ping=1", { credentials: "omit" }), j = await r.json(); return !!(j && j.ok); } catch (e) { return false; }
}
async function confirmSync(stamp, tries = 10) {
  for (let i = 0; i < tries; i++) {
    await sleep(i ? 4000 : 2500);
    try { const st = await jsonp({ action: "status", token: syncCfg.token, stamp }); if (st && (st.stamp == stamp || st.error == "TOKEN")) return st; } catch (e) { /* coba lagi */ }
  }
  return null;
}
async function syncNow(manual) {
  const c = syncCfg;
  if (!authed || ro()) return;
  if (!c.url || !c.token) { if (manual) toast("Alamat Web App dan kode rahasia belum diatur"); return; }
  if (!idOf(c.wl)) { if (manual) toast("Link spreadsheet Weekly Report belum diatur"); return; }
  if (syncBusy) { syncAgain = true; return; }
  const p = syncPending();
  if (!p.entries.length && !p.del.length) { if (manual) { syncMsg("Semua pekerjaan sudah tersinkron", true); toast(c.msg); } return; }
  syncBusy = true; syncLastTry = Date.now();
  try {
    const stamp = newId();
    formPost(c.url, { token: c.token, stamp, weeklyId: idOf(c.wl), entries: p.entries, del: p.del });
    const j = await confirmSync(stamp);
    if (j && j.ok === false) syncMsg(errText(j.error), false);
    else if (j && j.ok) {
      const fail = Array.isArray(j.fail) ? j.fail : [];
      p.entries.forEach(en => { if (!fail.includes(en.key)) c.sent[en.key] = p.hashes[en.key]; });
      c.delq = c.delq.filter(k => !p.del.includes(k) || fail.includes(k));
      const bad = String(j.log || "").split("\n").filter(Boolean);
      syncTries = 0;
      syncMsg("Sinkron berhasil (" + j.a + " pekerjaan ditulis, " + j.d + " dihapus)" + (bad.length ? ". Perhatian: " + bad.slice(0, 2).join(" | ") : ""), !fail.length);
    }
    else if (await anonCheck()) syncMsg("Data terkirim tetapi belum terkonfirmasi setelah 40 detik. Cek spreadsheet atau menu Eksekusi di editor Apps Script", null);
    else syncMsg("Web App tidak bisa diakses tanpa login Google. Deploy ulang dengan Akses = Siapa saja lalu pilih Versi baru", false);
  } catch (e) { syncMsg("Gagal mengirim: " + (e && e.message ? e.message : e), false); }
  finally { syncBusy = false; }
  if (syncCfg.ok === false && syncTries < 3 && !/Kode rahasia|Akses|Link spreadsheet/.test(syncCfg.msg)) { syncTries++; setTimeout(() => syncNow(false), 30000); }
  if (manual) toast(syncCfg.msg);
  if (syncAgain) { syncAgain = false; schedSync(); }
}
function schedSync() {
  if (!syncReady() || !syncCfg.auto || !authed || !me || ro()) return;
  clearTimeout(syncT);
  syncT = setTimeout(() => {
    if (syncCfg.ok === false && Date.now() - syncLastTry < 60000) return;   // jangan membanjiri saat sedang bermasalah
    const p = syncPending();
    if (p.entries.length || p.del.length) syncNow(false);
  }, 3000);
}
function syncSaveCfg() {
  if (!lead()) return;
  const u = $("#sy-url").value.trim();
  if (u && !/^https:\/\/script\.google\.com\/(a\/macros\/[\w.-]+\/|macros\/)s\/[\w-]+\/exec$/.test(u)) return toast("Alamat harus dari script.google.com dan berakhiran /exec");
  const w = $("#sy-wl").value.trim();
  if (w && !idOf(w)) return toast("Link spreadsheet tidak valid. Salin dari kolom alamat browser");
  syncCfg.wl = w; syncCfg.url = u; syncCfg.token = $("#sy-tk").value.trim(); syncCfg.auto = $("#sy-auto").value == "1"; syncTries = 0; syncStore();
  toast("Pengaturan disimpan"); syncNow(true);
}
async function syncTest() {
  const c = syncCfg;
  if (!c.url || !c.token) return toast("Isi alamat Web App dan kode rahasia dulu");
  if (!idOf(c.wl)) return toast("Isi link spreadsheet dulu");
  toast("Menguji koneksi (bisa 20 detik)…");
  try {
    const j = await jsonp({ action: "ping", token: c.token, w: idOf(c.wl) });
    if (!j.ok) syncMsg(errText(j.error), false);
    else {
      const stamp = newId();
      formPost(c.url, { token: c.token, stamp, weeklyId: "" });   // uji jalur kirim tanpa menulis apa pun
      if (await confirmSync(stamp, 8)) syncMsg("Tes berhasil. Baca dan kirim data OK. Spreadsheet: " + (j.weekly || "-"), true);
      else syncMsg("Bisa membaca Web App, tetapi pengiriman data gagal. Hampir pasti Akses belum 'Siapa saja': Deploy -> Kelola deployment -> pensil -> Akses: Siapa saja -> Versi baru -> Deploy", false);
    }
  } catch (e) { syncMsg("Tidak ada balasan dari Web App. Pastikan script sudah di-deploy ulang (Versi baru) dan Akses = Siapa saja. Buka alamat /exec di tab baru untuk memeriksa", false); }
  toast(syncCfg.msg);
}
function syncCard() {
  const c = syncCfg, ed = lead();
  const st = !syncReady() ? ["Belum diatur", "mu"] : c.ok === true ? ["Tersambung", "ok"] : c.ok === false ? ["Bermasalah", "er"] : [c.msg ? "Belum terkonfirmasi" : "Menunggu", "wn"];
  const p = syncPending(), pend = p.entries.length + p.del.length;
  return `<div class="card"><div class="card-header"><h3 class="card-title">Sinkron ke Google Sheets <span class="st st-${st[1]} ml-2"><i class="st-dot"></i>${st[0]}</span></h3></div><div class="card-body">
<p class="text-muted">Pekerjaan Daily Report yang sudah <b>Simpan Laporan</b> otomatis masuk ke spreadsheet Weekly Report, di tab bulan dan blok Posisi + Week yang sesuai.${pend ? ` <b>${pend} perubahan menunggu dikirim.</b>` : ""}</p>
${ed ? `<div class="f">
  <div class="w"><label>Link spreadsheet Weekly Report</label><input id="sy-wl" class="form-control" value="${esc(c.wl)}" placeholder="https://docs.google.com/spreadsheets/d/.../edit"></div>
  <div class="w"><label>Alamat Web App (berakhiran /exec)</label><input id="sy-url" class="form-control" value="${esc(c.url)}" placeholder="https://script.google.com/macros/s/.../exec"></div>
  <div><label>Kode rahasia</label><input id="sy-tk" class="form-control" type="password" value="${esc(c.token)}" autocomplete="off"></div>
  <div><label>Pengiriman</label><select id="sy-auto" class="form-control custom-select"><option value="1" ${c.auto?"selected":""}>Otomatis</option><option value="0" ${c.auto?"":"selected"}>Manual</option></select></div>
</div>` : ""}
<div class="d-flex flex-wrap gap-2 mt-3">
  ${ed ? `<button type="button" class="btn btn-primary" onclick="syncSaveCfg()">Simpan &amp; Sinkronkan</button>
  <button type="button" class="btn btn-default" onclick="syncTest()">Tes Koneksi</button>` : ""}
  <button type="button" class="btn ${ed ? "btn-default" : "btn-primary"}" onclick="syncNow(true)">Sinkronkan Sekarang</button>
</div>
<p class="text-muted mt-2" style="font-size:.8rem">${c.msg?esc(c.msg)+". ":""}${c.last?"Terakhir berhasil: "+esc(c.last):""}</p>
<details class="more"><summary>Riwayat sinkron (${(c.log||[]).length})</summary>${(c.log||[]).map(l=>`<div class="text-muted" style="font-size:.8rem">${esc(l[0])} · ${l[1]=="ok"?"Berhasil":l[1]=="x"?"Gagal":"Proses"} · ${esc(l[2])}</div>`).join("")||'<div class="text-muted">Belum ada riwayat.</div>'}</details>
${ed ? `<details class="more"><summary>Petunjuk konfigurasi</summary><ol class="text-muted" style="font-size:.8rem"><li>Buka spreadsheet Weekly Report → <b>Ekstensi → Apps Script</b>.</li><li>Tempel seluruh isi file <b>apps-script.gs</b>, ganti <b>TOKEN</b>, lalu simpan.</li><li><b>Deploy → Deployment baru → Aplikasi web</b>, Jalankan sebagai: Saya, Akses: Siapa saja.</li><li>Salin URL <b>/exec</b> dan kode rahasia ke kolom di atas, lalu klik Tes Koneksi. Agar semua user langsung tersambung, isi juga <b>SYNC_DEFAULT</b> di assets/app.js.</li></ol></details>` : ""}
</div></div>`;
}

/* ---------- Mulai ---------- */
(async function init() {
  if (!load()) seed();
  syncTeam();
  await ensurePins();
  TODAY = todayStr();
  acts.forEach(a => { if (!a.sv && a.d < TODAY) a.sv = 1; });  // draft hari lampau otomatis tersimpan
  // Pekerjaan yang diinput sebelum fitur sinkron aktif (versi lama, belum punya SYNC ID) ikut dikirim.
  // Data contoh (7-10 Nov) dan hasil impor tidak disentuh.
  acts.forEach(a => { if (!a.g && !a.imp && a.d >= SYNC_FROM) a.g = newId(); });
  fm = mk(TODAY);
  applyTheme();
  if (window.jQuery) jQuery(document).on("shown.bs.tab", () => charts.forEach(c => c.resize()));
  window.addEventListener("storage", e => {
    if (!authed) return;
    if (e.key == KEY + "-me" && !e.newValue) return logout();
    if (e.key == KEY) {
      const keep = me.n;
      if (load()) {
        me = users.find(u => u.n == keep) || me;
        if (!users.some(u => u.n == me.n)) return logout();
        go(cur, true);
      }
    }
  });
  let sess = ""; try { sess = localStorage.getItem(KEY + "-me") || ""; } catch (e) { /* abaikan */ }
  const su = users.find(u => u.n == sess);
  if (su) {
    me = su; authed = true;
    fp = me.p == "Viewer" ? team[0].n : me.n;
    document.body.classList.remove("logged-out");
    $("#login").hidden = true;
    go("dash");
  } else {
    showLogin();
  }
})();
