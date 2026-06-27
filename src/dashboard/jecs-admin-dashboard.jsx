import { useState, useEffect, useCallback } from "react";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SB_URL = "https://mylqkbpclcrqorjctjxn.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bHFrYnBjbGNycW9yamN0anhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjcxNzgsImV4cCI6MjA5NTMwMzE3OH0.yeZZHm0BEvrJShe8Wek5rfKAwunJQ8byKF1THbtwYYg";

const ADMIN_EMAILS = [
  "concierge@jubileeexecutivecarservice.com",
  "contact@jubileeexecutivecarservice.com",
  "aarmstrong1234@gmail.com",
];

// Appointment status pipeline
const STATUS_PIPELINE = [
  "Requested",
  "Confirmed",
  "En Route",
  "In Progress",
  "Quality Check",
  "Completed",
];
const STATUS_CANCELLED   = "Cancelled";
const STATUS_RESCHEDULED = "Rescheduled";

async function sbFetch(path, opts = {}) {
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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// Advance appointment status + sync service_requests + trigger payment on Completed
async function advanceStatus(appt) {
  const currentIdx = STATUS_PIPELINE.indexOf(appt.appointment_status);
  if (currentIdx === -1 || currentIdx === STATUS_PIPELINE.length - 1) return null;
  const nextStatus = STATUS_PIPELINE[currentIdx + 1];

  // 1. Update appointments
  await sbFetch(`appointments?appointment_id=eq.${appt.appointment_id}`, {
    method: "PATCH",
    body: JSON.stringify({ appointment_status: nextStatus }),
  });

  // 2. Sync service_requests if linked
  if (appt.service_request_id) {
    await sbFetch(`service_requests?request_id=eq.${appt.service_request_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  // 3. On Completed — set payment to Pending if payment record exists
  if (nextStatus === "Completed") {
    const payments = await sbFetch(
      `payments?appointment_id=eq.${appt.appointment_id}&select=payment_id`
    );
    if (payments && payments.length > 0) {
      await sbFetch(`payments?appointment_id=eq.${appt.appointment_id}`, {
        method: "PATCH",
        body: JSON.stringify({ payment_status: "Pending" }),
      });
    }
  }

  return nextStatus;
}

async function setStatus(appt, status) {
  await sbFetch(`appointments?appointment_id=eq.${appt.appointment_id}`, {
    method: "PATCH",
    body: JSON.stringify({ appointment_status: status }),
  });
  if (appt.service_request_id) {
    await sbFetch(`service_requests?request_id=eq.${appt.service_request_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  base:        "#080D1A",
  surface:     "#0F1623",
  surfaceAlt:  "#151E2E",
  surfaceHover:"#1A2540",
  border:      "#1C2A3E",
  accent:      "#0284C7",
  accentLight: "#38BDF8",
  gold:        "#D4A843",
  goldLight:   "#FCD34D",
  text:        "#EFF6FF",
  textMuted:   "#7A90B0",
  success:     "#10B981",
  warning:     "#F59E0B",
  danger:      "#EF4444",
  purple:      "#8B5CF6",
};

// Status → color mapping
const STATUS_COLOR = {
  "Requested":     "#7A90B0",
  "Confirmed":     "#0284C7",
  "En Route":      "#8B5CF6",
  "In Progress":   "#F59E0B",
  "Quality Check": "#D4A843",
  "Completed":     "#10B981",
  "Cancelled":     "#EF4444",
  "Rescheduled":   "#6B7280",
};

function statusColor(s) { return STATUS_COLOR[s] || C.textMuted; }

// ── Icons ─────────────────────────────────────────────────────────────────────
const PATHS = {
  dashboard:    "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  appointments: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  customers:    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  washpro:      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  services:     "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  subscriptions:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  plus:         "M12 5v14M5 12h14",
  edit:         "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  x:            "M18 6L6 18M6 6l12 12",
  check:        "M20 6L9 17l-5-5",
  refresh:      "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  alert:        "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  arrow:        "M5 12h14M12 5l7 7-7 7",
  car:          "M5 17H3v-4l3-6h12l3 6v4h-2m-9 0h4m-4 0a2 2 0 100 4 2 2 0 000-4zm4 0a2 2 0 100 4 2 2 0 000-4z",
  search:       "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  clock:        "M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l3 3",
  pin:          "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0zM12 10a2 2 0 110-4 2 2 0 010 4z",
};

function Icon({ name, size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] || PATHS.alert} />
    </svg>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const pill = (status) => {
  const col = statusColor(status);
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: 12,
    fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
    background: `${col}22`, color: col, border: `1px solid ${col}44`,
  };
};

const btn = (variant = "primary", sm = false) => ({
  padding: sm ? "4px 10px" : "8px 16px",
  fontSize: sm ? 11 : 13, fontWeight: 600, borderRadius: 6,
  border: "none", cursor: "pointer", transition: "opacity 0.15s",
  display: "inline-flex", alignItems: "center", gap: 5,
  ...(variant === "primary"  && { background: C.accent,  color: "#fff" }),
  ...(variant === "gold"     && { background: C.gold,    color: "#000" }),
  ...(variant === "success"  && { background: C.success, color: "#fff" }),
  ...(variant === "ghost"    && { background: "transparent", color: C.textMuted, border: `1px solid ${C.border}` }),
  ...(variant === "danger"   && { background: `${C.danger}22`, color: C.danger, border: `1px solid ${C.danger}44` }),
  ...(variant === "pipeline" && { background: C.accentLight, color: "#000", fontWeight: 700 }),
});

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      background: C.success, color: "#fff", padding: "10px 20px",
      borderRadius: 8, fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 24px #00000066",
    }}>{msg}</div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [err, setErr]     = useState("");

  function handle() {
    const e = email.trim().toLowerCase();
    if (ADMIN_EMAILS.includes(e)) onLogin(e);
    else setErr("Access denied. Authorised administrators only.");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: 12, padding: "2.5rem", width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: "0.02em" }}>JECS</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Quick Wash · Admin Portal</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Admin Email</label>
            <input
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }}
              type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handle()}
            />
          </div>
          {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
          <button style={{ ...btn("gold"), padding: "10px", width: "100%", justifyContent: "center", fontSize: 14 }} onClick={handle}>
            Sign In
          </button>
        </div>
        <div style={{ marginTop: "1.5rem", fontSize: 11, color: C.textMuted, textAlign: "center", lineHeight: 1.6 }}>
          Authorised personnel only · Jubilee Executive Car Service
        </div>
      </div>
    </div>
  );
}

// ── Status Pipeline Bar ───────────────────────────────────────────────────────
function PipelineBar({ counts, activeFilter, onFilter }) {
  const total = STATUS_PIPELINE.reduce((s, k) => s + (counts[k] || 0), 0);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
      {STATUS_PIPELINE.map((status, i) => {
        const col   = statusColor(status);
        const count = counts[status] || 0;
        const active = activeFilter === status;
        return (
          <div key={status} onClick={() => onFilter(active ? null : status)}
            style={{
              flex: 1, minWidth: 100, background: active ? `${col}33` : C.surfaceAlt,
              border: `1px solid ${active ? col : C.border}`,
              borderTop: `3px solid ${col}`,
              borderRadius: 8, padding: "10px 14px", cursor: "pointer",
              transition: "all 0.15s",
            }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: col, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              {i + 1}. {status}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: active ? col : C.text, lineHeight: 1 }}>{count}</div>
            {total > 0 && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{Math.round((count / total) * 100)}%</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Appointment Row ───────────────────────────────────────────────────────────
function ApptRow({ appt, onAdvance, onSetStatus, onEdit, compact }) {
  const [advancing, setAdvancing] = useState(false);
  const [hovered, setHovered]     = useState(false);
  const currentIdx = STATUS_PIPELINE.indexOf(appt.appointment_status);
  const canAdvance = currentIdx >= 0 && currentIdx < STATUS_PIPELINE.length - 1;
  const nextStatus = canAdvance ? STATUS_PIPELINE[currentIdx + 1] : null;

  async function handleAdvance() {
    setAdvancing(true);
    await onAdvance(appt);
    setAdvancing(false);
  }

  const time = appt.scheduled_start
    ? new Date(appt.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  const td = { padding: "12px 14px", borderBottom: `1px solid ${C.border}22`, verticalAlign: "middle", color: C.text, fontSize: 13 };

  return (
    <tr style={{ background: hovered ? C.surfaceHover : "transparent", transition: "background 0.1s" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{appt.customer_name || "—"}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{appt.customer_address || ""}</div>
      </td>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.accentLight }}>
          <Icon name="clock" size={12} color={C.accentLight} /> {time}
        </div>
      </td>
      {!compact && <td style={td}>{appt.vehicle_summary || "—"}</td>}
      <td style={td}><span style={pill(appt.appointment_status)}>{appt.appointment_status || "—"}</span></td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {canAdvance && (
            <button style={btn("pipeline", true)} onClick={handleAdvance} disabled={advancing} title={`Advance to ${nextStatus}`}>
              {advancing ? "…" : <>→ {nextStatus}</>}
            </button>
          )}
          <div style={{ position: "relative" }}>
            <select
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
              value={appt.appointment_status || ""}
              onChange={e => onSetStatus(appt, e.target.value)}
            >
              {STATUS_PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
              <option value={STATUS_CANCELLED}>Cancelled</option>
              <option value={STATUS_RESCHEDULED}>Rescheduled</option>
            </select>
          </div>
          {onEdit && (
            <button style={btn("ghost", true)} onClick={() => onEdit(appt)} title="Edit">
              <Icon name="edit" size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Appointments Tab ──────────────────────────────────────────────────────────
function AppointmentsTab() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState(null);
  const [search, setSearch]       = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [toast, setToast]         = useState("");
  const [editAppt, setEditAppt]   = useState(null);
  const [fetchErr, setFetchErr]   = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr("");
    try {
      // Attempt 1: joined query (customers + vehicles in one request)
      let appts = null;
      try {
        appts = await sbFetch(
          "appointments?select=*,customers(full_name,formatted_address),vehicles(make,model,year,color)&order=scheduled_start.asc&limit=500"
        );
      } catch (joinErr) {
        console.warn("[JECS] Joined fetch failed, trying plain fetch:", joinErr.message);
      }

      // Attempt 2: plain appointments fetch if join failed
      if (!appts) {
        appts = await sbFetch(
          "appointments?select=*&order=scheduled_start.asc&limit=500"
        ) || [];
      }

      // Enrich with customer + vehicle data
      const enriched = await Promise.all((appts || []).map(async (a) => {
        // If join already populated these, use them
        let custName    = a.customers?.full_name         || null;
        let custAddr    = a.customers?.formatted_address || null;
        let vehicleSum  = null;

        if (a.vehicles) {
          vehicleSum = [a.vehicles.year, a.vehicles.color, a.vehicles.make, a.vehicles.model]
            .filter(Boolean).join(" ");
        }

        // Fallback: fetch customer separately if join didn't work
        if (!custName && a.customer_id) {
          try {
            const custs = await sbFetch(
              `customers?customer_id=eq.${a.customer_id}&select=full_name,formatted_address&limit=1`
            );
            if (custs && custs[0]) {
              custName = custs[0].full_name;
              custAddr = custs[0].formatted_address;
            }
          } catch (_) {}
        }

        // Fallback: fetch vehicle separately via service_request → vehicle_id
        if (!vehicleSum && a.service_request_id) {
          try {
            const srs = await sbFetch(
              `service_requests?request_id=eq.${a.service_request_id}&select=vehicle_id&limit=1`
            );
            const vid = srs?.[0]?.vehicle_id;
            if (vid) {
              const vehs = await sbFetch(
                `vehicles?vehicle_id=eq.${vid}&select=make,model,year,color&limit=1`
              );
              if (vehs && vehs[0]) {
                const v = vehs[0];
                vehicleSum = [v.year, v.color, v.make, v.model].filter(Boolean).join(" ");
              }
            }
          } catch (_) {}
        }

        return {
          ...a,
          customer_name:    custName || "—",
          customer_address: custAddr || "",
          vehicle_summary:  vehicleSum || "—",
        };
      }));

      setRows(enriched);
    } catch (e) {
      console.error("[JECS] Appointments load failed:", e);
      setFetchErr(e.message || "Failed to load appointments.");
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance(appt) {
    try {
      const next = await advanceStatus(appt);
      if (next) showToast(`Moved to ${next}`);
      load();
    } catch (e) { showToast("Error: " + e.message); }
  }

  async function handleSetStatus(appt, status) {
    try {
      await setStatus(appt, status);
      showToast(`Status set to ${status}`);
      load();
    } catch (e) { showToast("Error: " + e.message); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = rows.filter(r => (r.scheduled_start || "").startsWith(today));

  // Pipeline counts across ALL appointments (not just today)
  // so the bar always reflects the true business state
  const counts = {};
  STATUS_PIPELINE.forEach(s => { counts[s] = rows.filter(r => r.appointment_status === s).length; });

  // Active display rows: apply today filter, status filter, and search
  const filtered = rows.filter(r => {
    if (todayOnly && !(r.scheduled_start || "").startsWith(today)) return false;
    if (filter && r.appointment_status !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.customer_name || "").toLowerCase().includes(q) ||
      (r.vehicle_summary || "").toLowerCase().includes(q) ||
      (r.customer_address || "").toLowerCase().includes(q);
  });

  const th = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", background: `${C.border}55`, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  return (
    <div>
      <Toast msg={toast} />

      {/* Page title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="appointments" size={20} color={C.accentLight} /> Appointments
          <span style={{ fontSize: 12, background: `${C.accent}22`, color: C.accentLight, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
            {rows.length} total · {todayRows.length} today
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(todayOnly ? "primary" : "ghost", false)} onClick={() => setTodayOnly(v => !v)}>
            <Icon name="clock" size={13} /> {todayOnly ? "Today Only" : "All Dates"}
          </button>
        </div>
      </div>

      {/* Pipeline bar — ALL appointments counts */}
      <PipelineBar counts={counts} activeFilter={filter} onFilter={setFilter} />

      {/* Table */}
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}>
                <Icon name="search" size={13} color={C.textMuted} />
              </span>
              <input
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 11px 6px 30px", color: C.text, fontSize: 13, outline: "none", width: 200 }}
                placeholder="Search appointments…" value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {filter && (
              <button style={btn("ghost", true)} onClick={() => setFilter(null)}>
                ✕ Clear filter
              </button>
            )}
            <button style={btn("ghost", true)} onClick={load} title="Refresh">
              <Icon name="refresh" size={13} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{filtered.length} appointment{filtered.length !== 1 ? "s" : ""}</div>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading appointments…</div>
        ) : fetchErr ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.danger, fontSize: 13 }}>
            <Icon name="alert" size={18} color={C.danger} /><br /><br />
            Could not load appointments.<br />
            <span style={{ fontSize: 11, color: C.textMuted }}>{fetchErr}</span><br /><br />
            <button style={btn("ghost", true)} onClick={load}><Icon name="refresh" size={12} /> Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            {filter ? `No appointments with status "${filter}".` : todayOnly ? "No appointments scheduled for today." : "No appointments found."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Customer", "Time", "Vehicle", "Status", "Actions"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <ApptRow key={a.appointment_id} appt={a}
                    onAdvance={handleAdvance}
                    onSetStatus={handleSetStatus}
                    onEdit={setEditAppt}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          onClose={() => setEditAppt(null)}
          onSave={async (form) => {
            await sbFetch(`appointments?appointment_id=eq.${editAppt.appointment_id}`, {
              method: "PATCH", body: JSON.stringify(form),
            });
            showToast("Appointment updated.");
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Appointment Edit Modal ────────────────────────────────────────────────────
function AppointmentModal({ appt, onClose, onSave }) {
  const [form, setForm] = useState({
    scheduled_start:    appt?.scheduled_start || "",
    scheduled_end:      appt?.scheduled_end   || "",
    appointment_status: appt?.appointment_status || "Requested",
    preferred_time_window: appt?.preferred_time_window || "",
    customer_notes:     appt?.customer_notes   || "",
    weather_score:      appt?.weather_score    || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const inp = { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 11px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 };

  async function save() {
    setSaving(true); setErr("");
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 540, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", padding: "2rem", boxShadow: "0 25px 60px #00000099" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Edit Appointment</div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {[
            { key: "scheduled_start", label: "Scheduled Start", type: "datetime-local" },
            { key: "scheduled_end",   label: "Scheduled End",   type: "datetime-local" },
            { key: "preferred_time_window", label: "Preferred Time Window" },
            { key: "weather_score",   label: "Weather Score" },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input style={inp} type={f.type || "text"} value={form[f.key] || ""}
                onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.appointment_status}
              onChange={e => setForm(v => ({ ...v, appointment_status: e.target.value }))}>
              {STATUS_PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
              <option value={STATUS_CANCELLED}>Cancelled</option>
              <option value={STATUS_RESCHEDULED}>Rescheduled</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Customer Notes</label>
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={form.customer_notes || ""}
              onChange={e => setForm(v => ({ ...v, customer_notes: e.target.value }))} />
          </div>
        </div>
        {err && <div style={{ marginTop: "1rem", fontSize: 12, color: C.danger }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "1.5rem" }}>
          <button style={btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={btn("primary")} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ onNavigate }) {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [appts, subs, payments] = await Promise.all([
          sbFetch("appointments?select=appointment_id,appointment_status,scheduled_start&limit=500") || [],
          sbFetch("subscriptions?select=subscription_id,active&limit=500") || [],
          sbFetch("payments?select=payment_id,payment_status,amount&limit=500") || [],
        ]);
        setData({ appts: appts || [], subs: subs || [], payments: payments || [], today });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading…</div>;

  const { appts = [], subs = [], payments = [], today = "" } = data;

  const todayAppts   = appts.filter(a => (a.scheduled_start || "").startsWith(today));
  const completed    = appts.filter(a => a.appointment_status === "Completed");
  const inFlight     = appts.filter(a => ["Confirmed","En Route","In Progress","Quality Check"].includes(a.appointment_status));
  const requested    = appts.filter(a => a.appointment_status === "Requested");
  const activeSubs   = subs.filter(s => s.active === true);
  const pendingPay   = payments.filter(p => p.payment_status === "Pending");
  const revenue      = payments.filter(p => p.payment_status === "Paid").reduce((s, p) => s + Number(p.amount || 0), 0);

  const metrics = [
    { label: "Today's Appointments", value: todayAppts.length,  accent: C.accentLight, icon: "clock",    action: () => onNavigate("appointments") },
    { label: "Requested (Need Confirmation)", value: requested.length,  accent: C.warning,    icon: "alert",    action: () => onNavigate("appointments") },
    { label: "In Progress Today",    value: inFlight.length,    accent: C.purple,     icon: "car",      action: () => onNavigate("appointments") },
    { label: "Completed All-Time",   value: completed.length,   accent: C.success,    icon: "check",    action: () => onNavigate("appointments") },
    { label: "Active Subscriptions", value: activeSubs.length,  accent: C.gold,       icon: "subscriptions", action: () => onNavigate("subscriptions") },
    { label: "Payments Pending",     value: pendingPay.length,  accent: C.danger,     icon: "alert",    action: null },
    { label: "Revenue (Paid)",       value: `$${revenue.toFixed(2)}`, accent: C.success, icon: "check", action: null },
  ];

  // Pipeline counts for today
  const todayCounts = {};
  STATUS_PIPELINE.forEach(s => { todayCounts[s] = todayAppts.filter(a => a.appointment_status === s).length; });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="dashboard" size={20} color={C.accentLight} /> Daily Overview
        <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 400 }}>
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </span>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {metrics.map(m => (
          <div key={m.label}
            onClick={m.action || undefined}
            style={{
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              borderTop: `3px solid ${m.accent}`, borderRadius: 10,
              padding: "1.1rem 1.25rem", cursor: m.action ? "pointer" : "default",
              transition: "border-color 0.15s",
            }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {m.label} <Icon name={m.icon} size={14} color={m.accent} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: m.accent, lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Today's pipeline */}
      <div style={{ marginBottom: "0.75rem", fontSize: 13, fontWeight: 600, color: C.textMuted }}>TODAY'S PIPELINE</div>
      <PipelineBar counts={todayCounts} activeFilter={null} onFilter={() => onNavigate("appointments")} />
    </div>
  );
}

// ── Wash Pro View ─────────────────────────────────────────────────────────────
function WashProTab() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const appts = await sbFetch(
        `appointments?select=*,customers(full_name,formatted_address,phone_number),vehicles(make,model,year,color,license_plate)&scheduled_start=gte.${today}T00:00:00&scheduled_start=lte.${today}T23:59:59&order=scheduled_start.asc&limit=100`
      ) || [];

      setRows(appts.map(a => ({
        ...a,
        customer_name:    a.customers?.full_name         || "—",
        customer_address: a.customers?.formatted_address || "—",
        customer_phone:   a.customers?.phone_number      || "—",
        vehicle_summary:  a.vehicles
          ? [a.vehicles.year, a.vehicles.color, a.vehicles.make, a.vehicles.model].filter(Boolean).join(" ")
          : "—",
        license_plate: a.vehicles?.license_plate || "—",
      })));
    } catch (e) { console.error(e); setRows([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance(appt) {
    try {
      const next = await advanceStatus(appt);
      if (next) showToast(`✓ ${appt.customer_name} → ${next}`);
      load();
    } catch (e) { showToast("Error: " + e.message); }
  }

  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div>
      <Toast msg={toast} />

      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="washpro" size={20} color={C.accentLight} /> Wash Pro — Today's Jobs
      </div>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: "1.5rem" }}>{today}</div>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading today's jobs…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted, fontSize: 13 }}>No appointments scheduled for today.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {rows.map(a => {
            const currentIdx = STATUS_PIPELINE.indexOf(a.appointment_status);
            const canAdvance = currentIdx >= 0 && currentIdx < STATUS_PIPELINE.length - 1;
            const nextStatus = canAdvance ? STATUS_PIPELINE[currentIdx + 1] : null;
            const col        = statusColor(a.appointment_status);
            const time       = a.scheduled_start
              ? new Date(a.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—";

            return (
              <div key={a.appointment_id} style={{
                background: C.surfaceAlt, border: `1px solid ${C.border}`,
                borderLeft: `4px solid ${col}`, borderRadius: 10, padding: "1.25rem 1.5rem",
              }}>
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{a.customer_name}</div>
                    <div style={{ fontSize: 12, color: C.accentLight, marginTop: 2 }}>
                      <Icon name="clock" size={12} color={C.accentLight} /> {time}
                    </div>
                  </div>
                  <span style={pill(a.appointment_status)}>{a.appointment_status}</span>
                </div>

                {/* Details grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.5rem", marginBottom: "1rem", fontSize: 13 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>Address</div>
                    <div style={{ color: C.text }}>{a.customer_address}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>Phone</div>
                    <div style={{ color: C.text }}>{a.customer_phone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>Vehicle</div>
                    <div style={{ color: C.text }}>{a.vehicle_summary}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>Plate</div>
                    <div style={{ color: C.text }}>{a.license_plate}</div>
                  </div>
                  {a.customer_notes && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>Notes</div>
                      <div style={{ color: C.warning, fontSize: 12 }}>{a.customer_notes}</div>
                    </div>
                  )}
                </div>

                {/* Pipeline progress */}
                <div style={{ display: "flex", gap: 4, marginBottom: "1rem", flexWrap: "wrap" }}>
                  {STATUS_PIPELINE.map((s, i) => {
                    const done    = STATUS_PIPELINE.indexOf(a.appointment_status) >= i;
                    const current = a.appointment_status === s;
                    return (
                      <div key={s} style={{
                        flex: 1, minWidth: 60, height: 4, borderRadius: 2,
                        background: done ? statusColor(s) : C.border,
                        opacity: current ? 1 : done ? 0.7 : 0.3,
                        transition: "background 0.3s",
                      }} title={s} />
                    );
                  })}
                </div>

                {/* Advance button */}
                {canAdvance ? (
                  <button
                    style={{ ...btn("success"), width: "100%", justifyContent: "center", padding: "10px", fontSize: 14 }}
                    onClick={() => handleAdvance(a)}>
                    <Icon name="arrow" size={15} /> Mark as {nextStatus}
                  </button>
                ) : a.appointment_status === "Completed" ? (
                  <div style={{ textAlign: "center", padding: "8px", color: C.success, fontWeight: 700, fontSize: 13 }}>
                    <Icon name="check" size={14} color={C.success} /> Completed
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "8px", color: C.textMuted, fontSize: 12 }}>
                    Status: {a.appointment_status}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Customers Tab (unchanged, from v1) ────────────────────────────────────────
function CustomersTab() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]     = useState("");

  const showToast = m => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await sbFetch("customers?select=*&order=full_name.asc") || []); }
    catch (_) { setRows([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (selected) {
      await sbFetch(`customers?customer_id=eq.${selected.customer_id}`, { method: "PATCH", body: JSON.stringify(form) });
      showToast("Customer updated.");
    } else {
      await sbFetch("customers", { method: "POST", body: JSON.stringify(form) });
      showToast("Customer created.");
    }
    load();
  }

  const filtered = rows.filter(r => {
    if (showArchived ? r.status !== "archived" : r.status === "archived") return false;
    const q = search.toLowerCase();
    return !q || (r.full_name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q) || (r.phone_number || "").includes(q);
  });

  const td  = { padding: "11px 14px", borderBottom: `1px solid ${C.border}22`, verticalAlign: "middle", color: C.text, fontSize: 13 };
  const th  = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", background: `${C.border}55`, borderBottom: `1px solid ${C.border}` };
  const inp = { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 11px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 };

  return (
    <div>
      <Toast msg={toast} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="customers" size={20} color={C.accentLight} /> Customers
        </div>
        <button style={btn("gold")} onClick={() => { setSelected(null); setModal("form"); }}>
          <Icon name="plus" size={13} /> New Customer
        </button>
      </div>

      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "1rem 1.5rem", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}><Icon name="search" size={13} color={C.textMuted} /></span>
            <input style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 11px 6px 30px", color: C.text, fontSize: 13, outline: "none", width: 200 }}
              placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button style={btn(showArchived ? "danger" : "ghost", true)} onClick={() => setShowArchived(v => !v)}>
            {showArchived ? "Archived" : "Active"}
          </button>
          <button style={btn("ghost", true)} onClick={load}><Icon name="refresh" size={13} /></button>
          <div style={{ marginLeft: "auto", fontSize: 12, color: C.textMuted }}>{filtered.length} customers</div>
        </div>

        {loading ? <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading…</div>
          : filtered.length === 0 ? <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted, fontSize: 13 }}>No customers found.</div>
          : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["Name", "Email", "Phone", "ZIP", "Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.customer_id}>
                      <td style={td}><div style={{ fontWeight: 600 }}>{c.full_name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{c.customer_id?.slice(0, 8)}…</div></td>
                      <td style={{ ...td, color: C.accentLight }}>{c.email || "—"}</td>
                      <td style={td}>{c.phone_number || "—"}</td>
                      <td style={td}>{c.zip_code || "—"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={btn("ghost", true)} onClick={() => { setSelected(c); setModal("form"); }}><Icon name="edit" size={12} /></button>
                          {c.status === "archived"
                            ? <button style={btn("success", true)} onClick={async () => { await sbFetch(`customers?customer_id=eq.${c.customer_id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }); showToast("Restored."); load(); }}>Restore</button>
                            : <button style={btn("danger", true)} onClick={async () => { await sbFetch(`customers?customer_id=eq.${c.customer_id}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) }); showToast("Archived."); load(); }}>Archive</button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal === "form" && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 540, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{selected ? "Edit Customer" : "New Customer"}</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }} onClick={() => setModal(null)}><Icon name="x" size={18} /></button>
            </div>
            {(() => {
              const fields = [
                { key: "full_name", label: "Full Name", span: 2 },
                { key: "email", label: "Email", type: "email" },
                { key: "phone_number", label: "Phone" },
                { key: "formatted_address", label: "Address", span: 2 },
                { key: "zip_code", label: "ZIP Code" },
              ];
              const [form, setForm] = useState(selected || {});
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    {fields.map(f => (
                      <div key={f.key} style={{ gridColumn: f.span === 2 ? "1 / -1" : undefined }}>
                        <label style={lbl}>{f.label}</label>
                        <input style={inp} type={f.type || "text"} value={form[f.key] || ""}
                          onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "1.5rem" }}>
                    <button style={btn("ghost")} onClick={() => setModal(null)}>Cancel</button>
                    <button style={btn("primary")} onClick={async () => { await handleSave(form); setModal(null); }}>Save</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",    label: "Dashboard",    icon: "dashboard" },
  { id: "appointments", label: "Appointments", icon: "appointments" },
  { id: "washpro",      label: "Wash Pro View",icon: "washpro" },
  { id: "customers",    label: "Customers",    icon: "customers" },
];

const NAV_COLORS = {
  dashboard:    C.accentLight,
  appointments: C.accentLight,
  washpro:      C.success,
  customers:    C.gold,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab]   = useState("dashboard");

  if (!user) return <Login onLogin={setUser} />;

  const initials = user.split("@")[0].slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: C.base, color: C.text, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 2rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 17, letterSpacing: "0.04em" }}>
          <span style={{ color: C.gold }}>JECS</span> Quick Wash
          <span style={{ background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.08em" }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.textMuted }}>
          <span style={{ fontSize: 12 }}>{user}</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},${C.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff" }}>{initials}</div>
          <button style={{ ...btn("ghost", true), display: "flex", alignItems: "center", gap: 6 }} onClick={() => setUser(null)}>
            <Icon name="logout" size={13} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <nav style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "1.5rem 0", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          {NAV.map(n => {
            const active = tab === n.id;
            const col    = NAV_COLORS[n.id] || C.textMuted;
            return (
              <div key={n.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? col : C.textMuted, background: active ? `${col}18` : "transparent", borderLeft: active ? `3px solid ${col}` : "3px solid transparent", transition: "all 0.12s", userSelect: "none" }}
                onClick={() => setTab(n.id)}>
                <Icon name={n.icon} size={15} color={active ? col : C.textMuted} />
                {n.label}
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ padding: "10px 20px", fontSize: 10, color: `${C.textMuted}66`, lineHeight: 1.7 }}>
            Jubilee Executive<br />Car Service
          </div>
        </nav>

        {/* Main */}
        <main style={{ flex: 1, padding: "2rem", overflowY: "auto", maxHeight: "calc(100vh - 60px)" }}>
          {tab === "dashboard"    && <DashboardTab onNavigate={setTab} />}
          {tab === "appointments" && <AppointmentsTab />}
          {tab === "washpro"      && <WashProTab />}
          {tab === "customers"    && <CustomersTab />}
        </main>
      </div>
    </div>
  );
          }
