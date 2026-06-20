import { useState, useEffect, useCallback } from "react";

// ── Supabase ─────────────────────────────────────────────────────────────────
const SB_URL  = "https://mylqkbpclcrqorjctjxn.supabase.co";
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bHFrYnBjbGNycW9yamN0anhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjcxNzgsImV4cCI6MjA5NTMwMzE3OH0.yeZZHm0BEvrJShe8Wek5rfKAwunJQ8byKF1THbtwYYg";

const ADMIN_EMAILS = [
  "concierge@jubileeexecutivecarservice.com",
  "contact@jubileeexecutivecarservice.com",
  "aarmstrong1234@gmail.com",
];

// Core tables we care about (in sidebar order)
const CORE_TABLES = [
  "customers",
  "appointments",
  "service_requests",
  "employees",
  "profiles",
  "subscriptions",
];

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

// Pull column names by fetching one row and reading keys
async function discoverColumns(table) {
  try {
    const rows = await sb(`${table}?select=*&limit=1`);
    if (rows && rows.length > 0) return Object.keys(rows[0]);
    // If empty table, try HEAD request to get column info from headers
    return [];
  } catch (_) {
    return null; // table doesn't exist or no access
  }
}

async function fetchRows(table, limit = 200) {
  try {
    return await sb(`${table}?select=*&order=created_at.desc&limit=${limit}`) || [];
  } catch (_) {
    try {
      return await sb(`${table}?select=*&limit=${limit}`) || [];
    } catch (_2) {
      return null; // table inaccessible
    }
  }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  base:        "#0A0F1E",
  surface:     "#111827",
  surfaceAlt:  "#1A2236",
  surfaceHover:"#1F2D42",
  border:      "#1E2D45",
  accent:      "#0E7490",
  accentLight: "#22D3EE",
  gold:        "#D4A843",
  text:        "#F0F4FF",
  textMuted:   "#8899BB",
  success:     "#10B981",
  warning:     "#F59E0B",
  danger:      "#EF4444",
  purple:      "#8B5CF6",
};

// ── Tiny icon set ─────────────────────────────────────────────────────────────
const ICONS = {
  dashboard:      "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  customers:      "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  appointments:   "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  service_requests:"M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  employees:      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  profiles:       "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8zM22 21v-2a4 4 0 00-3-3.87",
  subscriptions:  "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  logout:         "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  plus:           "M12 5v14M5 12h14",
  edit:           "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  archive:        "M21 8v13H3V8M1 3h22v5H1zM10 12h4",
  restore:        "M3 12a9 9 0 109-9M3 3v6h6",
  search:         "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x:              "M18 6L6 18M6 6l12 12",
  check:          "M20 6L9 17l-5-5",
  car:            "M5 17H3v-4l3-6h12l3 6v4h-2m-9 0h4m-4 0a2 2 0 100 4 2 2 0 000-4zm4 0a2 2 0 100 4 2 2 0 000-4z",
  refresh:        "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  alert:          "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  eye:            "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  table:          "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",
};

function Icon({ name, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] || ICONS.table} />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: { minHeight:"100vh", background:C.base, color:C.text,
    fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column" },

  topBar: { background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 2rem",
    height:60, display:"flex", alignItems:"center", justifyContent:"space-between",
    position:"sticky", top:0, zIndex:100 },

  logo: { display:"flex", alignItems:"center", gap:10, fontWeight:700, fontSize:17,
    letterSpacing:"0.04em", color:C.text },
  logoGold: { color:C.gold },
  badge: { background:C.accent, color:"#fff", fontSize:10, fontWeight:700,
    padding:"2px 7px", borderRadius:4, letterSpacing:"0.08em" },

  userInfo: { display:"flex", alignItems:"center", gap:10, fontSize:13, color:C.textMuted },
  avatar: { width:32, height:32, borderRadius:"50%",
    background:`linear-gradient(135deg,${C.accent},${C.gold})`,
    display:"flex", alignItems:"center", justifyContent:"center",
    fontWeight:700, fontSize:13, color:"#fff" },

  body: { display:"flex", flex:1 },

  sidebar: { width:230, background:C.surface, borderRight:`1px solid ${C.border}`,
    padding:"1.25rem 0", display:"flex", flexDirection:"column", gap:2, flexShrink:0 },

  sideSection: { padding:"8px 16px 4px", fontSize:10, fontWeight:700,
    color:`${C.textMuted}88`, letterSpacing:"0.1em", textTransform:"uppercase" },

  navItem: (active) => ({
    display:"flex", alignItems:"center", gap:10, padding:"9px 20px",
    cursor:"pointer", fontSize:13, fontWeight: active ? 600 : 400,
    color: active ? C.accentLight : C.textMuted,
    background: active ? `${C.accent}22` : "transparent",
    borderLeft: active ? `3px solid ${C.accentLight}` : "3px solid transparent",
    transition:"all 0.12s", userSelect:"none",
  }),

  main: { flex:1, padding:"2rem", overflowY:"auto", maxHeight:"calc(100vh - 60px)" },

  pageTitle: { fontSize:20, fontWeight:700, color:C.text, marginBottom:"1.5rem",
    display:"flex", alignItems:"center", gap:8, justifyContent:"space-between" },

  metricsGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
    gap:"1.25rem", marginBottom:"2rem" },

  metricCard: (accent) => ({ background:C.surfaceAlt, border:`1px solid ${C.border}`,
    borderTop:`3px solid ${accent}`, borderRadius:10, padding:"1.25rem 1.5rem" }),
  metricLabel: { fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:"0.08em",
    textTransform:"uppercase", marginBottom:8 },
  metricValue: { fontSize:34, fontWeight:800, lineHeight:1, marginBottom:4 },
  metricSub: { fontSize:11, color:C.textMuted },

  tableWrap: { background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" },
  tableBar: { display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"1rem 1.5rem", borderBottom:`1px solid ${C.border}`, gap:12, flexWrap:"wrap" },

  table: { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th: { padding:"9px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.textMuted,
    letterSpacing:"0.07em", textTransform:"uppercase", background:`${C.border}55`,
    borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" },
  td: { padding:"11px 14px", borderBottom:`1px solid ${C.border}22`,
    verticalAlign:"middle", color:C.text, maxWidth:200, overflow:"hidden",
    textOverflow:"ellipsis", whiteSpace:"nowrap" },

  btn: (v="primary", sm=false) => ({
    padding: sm ? "4px 10px" : "7px 14px",
    fontSize: sm ? 11 : 13, fontWeight:600, borderRadius:6, border:"none",
    cursor:"pointer", transition:"all 0.12s", display:"inline-flex", alignItems:"center", gap:5,
    ...(v==="primary"   && { background:C.accent,  color:"#fff" }),
    ...(v==="gold"      && { background:C.gold,    color:"#000" }),
    ...(v==="ghost"     && { background:"transparent", color:C.textMuted, border:`1px solid ${C.border}` }),
    ...(v==="danger"    && { background:`${C.danger}22`,  color:C.danger,   border:`1px solid ${C.danger}44` }),
    ...(v==="success"   && { background:`${C.success}22`, color:C.success,  border:`1px solid ${C.success}44` }),
    ...(v==="purple"    && { background:`${C.purple}22`,  color:C.purple,   border:`1px solid ${C.purple}44` }),
  }),

  pill: (val) => {
    const v = String(val || "").toLowerCase();
    const map = {
      active:["#10B981"], completed:["#10B981"], done:["#10B981"], paid:["#10B981"],
      archived:["#EF4444"], cancelled:["#EF4444"], inactive:["#EF4444"], deleted:["#EF4444"],
      pending:["#F59E0B"], confirmed:["#22D3EE"], "in progress":["#8B5CF6"],
      scheduled:["#22D3EE"], subscribed:["#10B981"], trial:["#F59E0B"],
    };
    const col = map[v]?.[0] || C.textMuted;
    return { display:"inline-block", padding:"2px 9px", borderRadius:12, fontSize:11,
      fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase",
      background:`${col}22`, color:col };
  },

  input: { background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:6,
    padding:"7px 11px", color:C.text, fontSize:13, outline:"none",
    width:"100%", boxSizing:"border-box" },
  label: { fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:"0.06em",
    textTransform:"uppercase", marginBottom:4, display:"block" },

  overlay: { position:"fixed", inset:0, background:"#00000099", zIndex:200,
    display:"flex", alignItems:"center", justifyContent:"center" },
  modal: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
    width:600, maxWidth:"95vw", maxHeight:"92vh", overflowY:"auto",
    padding:"2rem", boxShadow:"0 25px 60px #00000099" },
  modalTitle: { fontSize:17, fontWeight:700, color:C.text, marginBottom:"1.5rem" },

  searchBar: { background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:6,
    padding:"6px 11px 6px 32px", color:C.text, fontSize:13, outline:"none", width:200 },

  empty: { padding:"3rem", textAlign:"center", color:C.textMuted, fontSize:13 },

  schemaTag: { display:"inline-block", background:`${C.accent}22`, color:C.accentLight,
    fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:4,
    letterSpacing:"0.06em", marginLeft:6 },

  loginWrap: { minHeight:"100vh", background:C.base, display:"flex",
    alignItems:"center", justifyContent:"center" },
  loginCard: { background:C.surface, border:`1px solid ${C.border}`,
    borderTop:`3px solid ${C.gold}`, borderRadius:12, padding:"2.5rem", width:380 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Columns that are too noisy / internal to show in the generic table
const HIDDEN_COLS = new Set(["password","password_hash","secret","token","refresh_token","raw_app_meta_data","raw_user_meta_data"]);

function isPrimary(col) { return col.endsWith("_id") || col === "id"; }
function isStatus(col)  { return col === "status" || col === "state" || col === "subscription_status"; }
function isDate(col)    { return col.includes("_at") || col.includes("_date") || col === "date"; }
function isMoney(col)   { return col.includes("amount") || col.includes("price") || col.includes("value") || col.includes("total") || col.includes("revenue"); }
function isBool(col)    { return col.startsWith("is_") || col.startsWith("has_") || col === "active"; }

function fmtCell(col, val) {
  if (val === null || val === undefined || val === "") return "—";
  if (isDate(col)) return String(val).slice(0, 16).replace("T", " ");
  if (isMoney(col) && !isNaN(Number(val))) return `$${Number(val).toFixed(2)}`;
  if (isBool(col)) return val ? "✓" : "✗";
  if (typeof val === "object") return JSON.stringify(val).slice(0, 60);
  return String(val).slice(0, 80);
}

function colLabel(col) {
  return col.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Pick the most human-readable columns for the table preview (max 6)
function pickDisplayCols(cols) {
  const priority = ["full_name","name","title","email","phone","phone_number",
    "status","state","subscription_status","appointment_date","scheduled_date",
    "service_type","service_name","amount","price","total","created_at","role","type"];
  const visible = cols.filter(c => !HIDDEN_COLS.has(c));
  const ordered = [
    ...priority.filter(p => visible.includes(p)),
    ...visible.filter(c => !priority.includes(c) && !isPrimary(c)),
  ];
  return ordered.slice(0, 6);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed", bottom:24, right:24, background:C.success,
      color:"#fff", padding:"10px 20px", borderRadius:8, fontSize:13,
      fontWeight:600, zIndex:999, boxShadow:"0 8px 24px #00000055" }}>
      {msg}
    </div>
  );
}

// ── Generic Row Modal (Create / Edit) ─────────────────────────────────────────
function RowModal({ table, columns, row, pkCol, onClose, onSave }) {
  const editableCols = columns.filter(c => !HIDDEN_COLS.has(c) && c !== pkCol && c !== "created_at" && c !== "updated_at");
  const [form, setForm] = useState(() => {
    const init = {};
    editableCols.forEach(c => { init[c] = row ? (row[c] ?? "") : ""; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true); setErr("");
    try { await onSave(form); onClose(); }
    catch(e) { setErr(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
          <div style={S.modalTitle}>{row ? "Edit" : "New"} {colLabel(table.replace(/_/g," "))}</div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:C.textMuted }} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          {editableCols.map(col => (
            <div key={col} style={{ display:"flex", flexDirection:"column", gap:4,
              gridColumn: (col.includes("address") || col.includes("notes") || col.includes("description")) ? "1 / -1" : undefined }}>
              <label style={S.label}>{colLabel(col)}</label>
              {(col.includes("notes") || col.includes("description") || col.includes("address")) ? (
                <textarea style={{ ...S.input, minHeight:72, resize:"vertical" }}
                  value={form[col] || ""} onChange={e => setForm(f => ({...f, [col]:e.target.value}))} />
              ) : (
                <input style={S.input} type={col.includes("email") ? "email" : col.includes("phone") ? "tel" : "text"}
                  value={form[col] || ""} onChange={e => setForm(f => ({...f, [col]:e.target.value}))} />
              )}
            </div>
          ))}
        </div>

        {err && <div style={{ marginTop:"1rem", fontSize:12, color:C.danger }}>{err}</div>}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:"1.5rem" }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={S.btn("primary")} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generic Table View ────────────────────────────────────────────────────────
function TableView({ table, tableColor = C.accent }) {
  const [schema, setSchema]     = useState(null);   // [] of col names | null=loading | false=error
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal]       = useState(null);   // null | 'create' | 'edit' | 'view'
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered]   = useState(null);
  const [toast, setToast]       = useState("");

  const pkCol = schema ? (schema.find(c => c === `${table.replace(/s$/,"")} _id`) ||
    schema.find(c => c.endsWith("_id")) || schema.find(c => c === "id") || schema?.[0]) : "id";

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const cols = await discoverColumns(table);
    setSchema(cols === null ? false : (cols.length ? cols : []));
    const data = await fetchRows(table);
    setRows(data || []);
    setLoading(false);
  }, [table]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (selected) {
      await sb(`${table}?${pkCol}=eq.${selected[pkCol]}`,
        { method:"PATCH", body:JSON.stringify(form) });
      showToast("Record updated.");
    } else {
      await sb(table, { method:"POST", body:JSON.stringify(form) });
      showToast("Record created.");
    }
    load();
  }

  async function handleArchive(row) {
    await sb(`${table}?${pkCol}=eq.${row[pkCol]}`,
      { method:"PATCH", body:JSON.stringify({ status:"archived" }) });
    showToast("Record archived."); load();
  }

  async function handleRestore(row) {
    await sb(`${table}?${pkCol}=eq.${row[pkCol]}`,
      { method:"PATCH", body:JSON.stringify({ status:"active" }) });
    showToast("Record restored."); load();
  }

  const displayCols = schema ? pickDisplayCols(schema) : [];
  const hasStatus   = schema?.some(isStatus);

  const filtered = rows.filter(r => {
    const archived = String(r.status || r.state || "").toLowerCase() === "archived";
    if (!showArchived && archived) return false;
    if (showArchived && !archived) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return displayCols.some(c => String(r[c] || "").toLowerCase().includes(q));
  });

  return (
    <div>
      <Toast msg={toast} />

      <div style={S.pageTitle}>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name={table} size={20} color={tableColor} />
          {colLabel(table)}
          {schema && schema.length > 0 && (
            <span style={S.schemaTag}>{schema.length} columns discovered</span>
          )}
        </span>
        <button style={S.btn("gold")} onClick={() => { setSelected(null); setModal("create"); }}>
          <Icon name="plus" size={13} /> New {colLabel(table.replace(/s$/,""))}
        </button>
      </div>

      <div style={S.tableWrap}>
        <div style={S.tableBar}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)" }}>
                <Icon name="search" size={13} color={C.textMuted} />
              </span>
              <input style={S.searchBar} placeholder={`Search ${table}…`}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {hasStatus && (
              <button style={S.btn(showArchived ? "danger" : "ghost", true)}
                onClick={() => setShowArchived(v => !v)}>
                {showArchived ? "Archived" : "Active"}
              </button>
            )}
            <button style={S.btn("ghost", true)} onClick={load} title="Refresh">
              <Icon name="refresh" size={13} />
            </button>
          </div>
          <div style={{ fontSize:12, color:C.textMuted }}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</div>
        </div>

        {loading ? (
          <div style={S.empty}>Discovering schema & loading {table}…</div>
        ) : schema === false ? (
          <div style={S.empty}>
            <Icon name="alert" size={20} color={C.warning} /><br /><br />
            Could not access <strong>{table}</strong>. Check your Supabase RLS policies.
          </div>
        ) : schema.length === 0 ? (
          <div style={S.empty}>Table <strong>{table}</strong> is empty — no schema discovered yet.</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            {search ? `No records match "${search}".` : showArchived ? "No archived records." : "No records yet."}
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {displayCols.map(c => <th key={c} style={S.th}>{colLabel(c)}</th>)}
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row[pkCol] || i}
                    style={{ background: hovered === i ? C.surfaceHover : "transparent", transition:"background 0.1s" }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}>
                    {displayCols.map(c => (
                      <td key={c} style={S.td} title={String(row[c] ?? "")}>
                        {isStatus(c) ? (
                          <span style={S.pill(row[c])}>{row[c] || "—"}</span>
                        ) : isMoney(c) && row[c] != null ? (
                          <span style={{ color:C.gold, fontWeight:700 }}>{fmtCell(c, row[c])}</span>
                        ) : isPrimary(c) ? (
                          <span style={{ color:C.textMuted, fontFamily:"monospace", fontSize:11 }}>
                            {String(row[c] || "—").slice(0, 12)}…
                          </span>
                        ) : (
                          fmtCell(c, row[c])
                        )}
                      </td>
                    ))}
                    <td style={S.td}>
                      <div style={{ display:"flex", gap:5 }}>
                        <button style={S.btn("ghost", true)} title="View all fields"
                          onClick={() => { setSelected(row); setModal("view"); }}>
                          <Icon name="eye" size={12} />
                        </button>
                        <button style={S.btn("ghost", true)} title="Edit"
                          onClick={() => { setSelected(row); setModal("edit"); }}>
                          <Icon name="edit" size={12} />
                        </button>
                        {hasStatus && (
                          String(row.status || row.state || "").toLowerCase() === "archived" ? (
                            <button style={S.btn("success", true)} title="Restore" onClick={() => handleRestore(row)}>
                              <Icon name="restore" size={12} />
                            </button>
                          ) : (
                            <button style={S.btn("danger", true)} title="Archive" onClick={() => handleArchive(row)}>
                              <Icon name="archive" size={12} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schema inspector panel */}
      {schema && schema.length > 0 && (
        <div style={{ marginTop:"1.5rem", background:C.surfaceAlt,
          border:`1px solid ${C.border}`, borderRadius:10, padding:"1rem 1.5rem" }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.textMuted,
            letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>
            Discovered Schema — {table}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {schema.map(c => (
              <span key={c} style={{ fontSize:11, padding:"2px 9px", borderRadius:12,
                background: displayCols.includes(c) ? `${tableColor}33` : `${C.border}88`,
                color: displayCols.includes(c) ? tableColor : C.textMuted,
                border:`1px solid ${displayCols.includes(c) ? tableColor+"55" : C.border}`,
                fontFamily:"monospace" }}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ fontSize:11, color:C.textMuted, marginTop:8 }}>
            Highlighted columns are shown in the table above. All columns are available in Edit.
          </div>
        </div>
      )}

      {/* View modal (all fields) */}
      {modal === "view" && selected && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={S.modal}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
              <div style={S.modalTitle}>Record Details</div>
              <button style={{ background:"none", border:"none", cursor:"pointer", color:C.textMuted }}
                onClick={() => setModal(null)}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {schema.filter(c => !HIDDEN_COLS.has(c)).map(c => (
                <div key={c} style={{ display:"flex", gap:12, fontSize:13 }}>
                  <div style={{ width:180, flexShrink:0, color:C.textMuted, fontWeight:600,
                    fontFamily:"monospace", fontSize:11, paddingTop:2 }}>{c}</div>
                  <div style={{ color:C.text, wordBreak:"break-all" }}>
                    {isStatus(c) ? <span style={S.pill(selected[c])}>{selected[c] || "—"}</span>
                      : fmtCell(c, selected[c])}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"1.5rem", gap:10 }}>
              <button style={S.btn("ghost")} onClick={() => setModal(null)}>Close</button>
              <button style={S.btn("primary")} onClick={() => setModal("edit")}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal === "create" || modal === "edit") && schema && (
        <RowModal
          table={table} columns={schema} row={modal === "edit" ? selected : null}
          pkCol={pkCol}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ── Dashboard Overview ────────────────────────────────────────────────────────
function DashboardTab({ data }) {
  const appts   = data.appointments || [];
  const svcReqs = data.service_requests || [];
  const custs   = data.customers || [];
  const subs    = data.subscriptions || [];

  const today   = new Date().toISOString().slice(0, 10);
  const todayA  = appts.filter(a => (a.appointment_date || a.created_at || "").startsWith(today));

  const metrics = [
    { label:"Total Appointments",     value: appts.length,                                         accent:C.accent,   icon:"appointments" },
    { label:"Today's Appointments",   value: todayA.length,                                        accent:C.accentLight, icon:"car" },
    { label:"Completed",              value: appts.filter(a => /complet/i.test(a.status)).length,  accent:C.success,  icon:"check" },
    { label:"Pending / Confirmed",    value: appts.filter(a => /pend|confirm/i.test(a.status)).length, accent:C.warning, icon:"alert" },
    { label:"Service Requests",       value: svcReqs.length,                                       accent:C.purple,   icon:"service_requests" },
    { label:"Total Customers",        value: custs.length,                                         accent:C.gold,     icon:"customers" },
    { label:"Active Subscriptions",   value: subs.filter(s => /active|subscrib/i.test(s.status || s.subscription_status || "")).length, accent:C.success, icon:"subscriptions" },
  ];

  const recentAppts = [...appts].slice(0, 8);
  const recentReqs  = [...svcReqs].slice(0, 5);

  return (
    <div>
      <div style={{ ...S.pageTitle, justifyContent:"flex-start" }}>
        <Icon name="dashboard" size={20} color={C.accentLight} /> Daily Overview
      </div>

      <div style={S.metricsGrid}>
        {metrics.map(m => (
          <div key={m.label} style={S.metricCard(m.accent)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={S.metricLabel}>{m.label}</div>
              <Icon name={m.icon} size={16} color={m.accent} />
            </div>
            <div style={{ ...S.metricValue, color:m.accent }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Appointments */}
      <div style={{ ...S.tableWrap, marginBottom:"1.5rem" }}>
        <div style={S.tableBar}>
          <div style={{ fontSize:14, fontWeight:600 }}>Recent Appointments</div>
          <div style={{ fontSize:12, color:C.textMuted }}>{appts.length} total</div>
        </div>
        {recentAppts.length === 0 ? (
          <div style={S.empty}>No appointment data yet.</div>
        ) : (
          <table style={S.table}>
            <thead><tr>
              {["Customer","Date","Service","Status","Amount"].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recentAppts.map((a,i) => (
                <tr key={i}>
                  <td style={S.td}>{a.full_name || a.customer_name || a.email || "—"}</td>
                  <td style={S.td}>{a.appointment_date || a.scheduled_date || a.created_at?.slice(0,10) || "—"}</td>
                  <td style={S.td}>{a.service_type || a.service_name || a.type || "Quick Wash"}</td>
                  <td style={S.td}><span style={S.pill(a.status)}>{a.status || "—"}</span></td>
                  <td style={S.td}>{a.amount || a.price ? `$${a.amount || a.price}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Service Requests */}
      {recentReqs.length > 0 && (
        <div style={S.tableWrap}>
          <div style={S.tableBar}>
            <div style={{ fontSize:14, fontWeight:600 }}>Recent Service Requests</div>
            <div style={{ fontSize:12, color:C.textMuted }}>{svcReqs.length} total</div>
          </div>
          <table style={S.table}>
            <thead><tr>
              {["Customer","Request","Status","Date"].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recentReqs.map((r,i) => (
                <tr key={i}>
                  <td style={S.td}>{r.full_name || r.customer_name || r.email || "—"}</td>
                  <td style={S.td}>{r.service_type || r.request_type || r.type || r.title || "—"}</td>
                  <td style={S.td}><span style={S.pill(r.status)}>{r.status || "—"}</span></td>
                  <td style={S.td}>{r.created_at?.slice(0,10) || r.request_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [err, setErr]     = useState("");

  function handle() {
    const e = email.trim().toLowerCase();
    if (ADMIN_EMAILS.includes(e)) { onLogin(e); }
    else { setErr("Access denied. This portal is restricted to authorised administrators."); }
  }

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ fontSize:30, fontWeight:800, color:C.gold, letterSpacing:"0.02em" }}>JECS</div>
          <div style={{ fontSize:13, color:C.textMuted, marginTop:4 }}>Quick Wash · Admin Portal</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div>
            <label style={S.label}>Admin Email</label>
            <input style={S.input} type="email" placeholder="your@email.com"
              value={email} onChange={e => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          {err && <div style={{ fontSize:12, color:C.danger, display:"flex", gap:6, alignItems:"center" }}>
            <Icon name="alert" size={13} color={C.danger} /> {err}
          </div>}
          <button style={{ ...S.btn("gold"), padding:"10px", width:"100%", fontSize:14, justifyContent:"center" }}
            onClick={handle}>Sign In</button>
        </div>
        <div style={{ marginTop:"1.5rem", fontSize:11, color:C.textMuted, textAlign:"center", lineHeight:1.6 }}>
          Authorised personnel only.<br />Jubilee Executive Car Service
        </div>
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
const TABLE_COLORS = {
  customers:        C.gold,
  appointments:     C.accentLight,
  service_requests: C.purple,
  employees:        C.success,
  profiles:         C.accent,
  subscriptions:    "#F472B6",
};

export default function App() {
  const [user, setUser]     = useState(null);
  const [tab, setTab]       = useState("dashboard");
  const [dashData, setDashData] = useState({});
  const [dashLoading, setDashLoading] = useState(false);

  // Pre-load dashboard data for metrics
  useEffect(() => {
    if (!user) return;
    setDashLoading(true);
    Promise.all(
      CORE_TABLES.map(t => fetchRows(t, 200).then(r => [t, r || []]).catch(() => [t, []]))
    ).then(entries => {
      setDashData(Object.fromEntries(entries));
      setDashLoading(false);
    });
  }, [user]);

  if (!user) return <Login onLogin={setUser} />;

  const initials = user.split("@")[0].slice(0, 2).toUpperCase();

  const nav = [
    { id:"dashboard",        label:"Dashboard",         icon:"dashboard" },
    { id:"divider" },
    { id:"customers",        label:"Customers",         icon:"customers" },
    { id:"appointments",     label:"Appointments",      icon:"appointments" },
    { id:"service_requests", label:"Service Requests",  icon:"service_requests" },
    { id:"employees",        label:"Employees",         icon:"employees" },
    { id:"profiles",         label:"Profiles",          icon:"profiles" },
    { id:"subscriptions",    label:"Subscriptions",     icon:"subscriptions" },
  ];

  return (
    <div style={S.root}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.logo}>
          <span style={S.logoGold}>JECS</span>&nbsp;Quick Wash
          <span style={S.badge}>ADMIN</span>
        </div>
        <div style={S.userInfo}>
          <span style={{ fontSize:12 }}>{user}</span>
          <div style={S.avatar}>{initials}</div>
          <button style={{ ...S.btn("ghost", true), display:"flex", alignItems:"center", gap:6 }}
            onClick={() => setUser(null)}>
            <Icon name="logout" size={13} /> Sign out
          </button>
        </div>
      </div>

      <div style={S.body}>
        {/* Sidebar */}
        <nav style={S.sidebar}>
          <div style={S.sideSection}>Overview</div>
          {nav.map((n, i) => {
            if (n.id === "divider") return (
              <div key={i} style={{ height:1, background:C.border, margin:"8px 16px" }} />
            );
            if (n.id === "divider-label") return (
              <div key={i} style={S.sideSection}>{n.label}</div>
            );
            const isTable = CORE_TABLES.includes(n.id);
            if (isTable && n.id === CORE_TABLES[0]) {
              // Insert label before first table
            }
            return (
              <div key={n.id} style={S.navItem(tab === n.id)} onClick={() => setTab(n.id)}>
                <Icon name={n.icon} size={15}
                  color={tab === n.id ? C.accentLight : TABLE_COLORS[n.id] || C.textMuted} />
                {n.label}
              </div>
            );
          })}
          <div style={{ flex:1 }} />
          <div style={{ padding:"10px 20px", fontSize:10, color:`${C.textMuted}66`, lineHeight:1.7 }}>
            Jubilee Executive<br />Car Service
          </div>
        </nav>

        {/* Main */}
        <main style={S.main}>
          {tab === "dashboard" && (
            dashLoading
              ? <div style={S.empty}>Loading dashboard data…</div>
              : <DashboardTab data={dashData} />
          )}
          {CORE_TABLES.map(t => tab === t && (
            <TableView key={t} table={t} tableColor={TABLE_COLORS[t]} />
          ))}
        </main>
      </div>
    </div>
  );
}
