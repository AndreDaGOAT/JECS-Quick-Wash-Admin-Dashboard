import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SB_URL = "https://mylqkbpclcrqorjctjxn.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bHFrYnBjbGNycW9yamN0anhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjcxNzgsImV4cCI6MjA5NTMwMzE3OH0.yeZZHm0BEvrJShe8Wek5rfKAwunJQ8byKF1THbtwYYg";

const ADMIN_EMAILS = [
  "concierge@jubileeexecutivecarservice.com",
  "contact@jubileeexecutivecarservice.com",
  "aarmstrong1234@gmail.com",
  "assistant@jubileeexecutivecarservice.com",
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
  packages:     "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM4 5h16M9 3h6",
  washpros:     "M9 11a4 4 0 100-8 4 4 0 000 8zm8 0a3 3 0 100-6 3 3 0 000 6zM3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M19 14v4m0 0v4m0-4h4m-4 0h-4",
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
    <div style={{
      minHeight: "100vh",
      background: C.base,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      padding: "1rem",
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${C.gold}`,
        borderRadius: 12,
        padding: "2.5rem",
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 24px 60px #00000055",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.gold, letterSpacing: "0.02em" }}>JECS</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>Quick Wash · Admin Portal</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Admin Email
            </label>
            <input
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.15s" }}
              type="email"
              placeholder="your@email.com"
              value={email}
              autoComplete="email"
              onChange={e => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handle()}
            />
          </div>
          {err && (
            <div style={{ fontSize: 12, color: C.danger, background: `${C.danger}11`, border: `1px solid ${C.danger}33`, borderRadius: 6, padding: "8px 12px" }}>
              {err}
            </div>
          )}
          <button
            style={{ ...btn("gold"), padding: "11px", width: "100%", justifyContent: "center", fontSize: 14, fontWeight: 700, borderRadius: 8 }}
            onClick={handle}>
            Sign In
          </button>
        </div>
        <div style={{ marginTop: "1.75rem", fontSize: 11, color: C.textMuted, textAlign: "center", lineHeight: 1.7, borderTop: `1px solid ${C.border}`, paddingTop: "1rem" }}>
          Authorised personnel only<br />Jubilee Executive Car Service
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

  const mapsUrl = appt.customer_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.customer_address)}`
    : null;

  const td = { padding: "12px 14px", borderBottom: `1px solid ${C.border}22`, verticalAlign: "middle", color: C.text, fontSize: 13 };

  return (
    <tr style={{ background: hovered ? C.surfaceHover : "transparent", transition: "background 0.1s" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{appt.customer_name || "—"}</div>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: C.accentLight, marginTop: 2, display: "block", textDecoration: "none" }}
            title="Open in Google Maps">
            📍 {appt.customer_address}
          </a>
        ) : (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{appt.customer_address || ""}</div>
        )}
      </td>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.accentLight }}>
          <Icon name="clock" size={12} color={C.accentLight} /> {time}
        </div>
        {appt.preferred_time_window && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{appt.preferred_time_window}</div>
        )}
      </td>
      {!compact && (
        <td style={td}>
          <div>{appt.vehicle_summary !== "—" ? appt.vehicle_summary : "—"}</div>
          {appt.license_plate && appt.license_plate !== "—" && (
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginTop: 2 }}>
              🪪 {appt.license_plate}
            </div>
          )}
        </td>
      )}
      <td style={td}><span style={pill(appt.appointment_status)}>{appt.appointment_status || "—"}</span></td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {canAdvance && (
            <button style={btn("pipeline", true)} onClick={handleAdvance} disabled={advancing} title={`Advance to ${nextStatus}`}>
              {advancing ? "…" : <>→ {nextStatus}</>}
            </button>
          )}
          <select
            style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
            value={appt.appointment_status || ""}
            onChange={e => onSetStatus(appt, e.target.value)}
          >
            {STATUS_PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
            <option value={STATUS_CANCELLED}>Cancelled</option>
            <option value={STATUS_RESCHEDULED}>Rescheduled</option>
          </select>
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
      // Step 1: Fetch appointments + customers (reliable direct FK)
      let appts = null;
      try {
        appts = await sbFetch(
          "appointments?select=*,customers(full_name,formatted_address)&order=scheduled_start.asc&limit=500"
        );
      } catch (e) {
        console.warn("[JECS] appointments fetch failed:", e.message);
        appts = await sbFetch("appointments?select=*&order=scheduled_start.asc&limit=500") || [];
      }

      // Step 2: For each appointment, resolve vehicle via service_request_id
      // appointments.service_request_id → service_requests.vehicle_id → vehicles.*
      const enriched = await Promise.all((appts || []).map(async (a) => {
        const custName    = a.customers?.full_name         || null;
        const custAddr    = a.customers?.formatted_address || null;
        let vehicleSum    = null;
        let licensePlate  = null;
        let vehicleType   = null;

        console.log(`[JECS] Appt ${a.appointment_id?.slice(0,8)} | service_request_id: ${a.service_request_id} | customer_id: ${a.customer_id}`);

        // Only attempt vehicle lookup if we have a service_request_id
        if (a.service_request_id) {
          try {
            const srs = await sbFetch(
              `service_requests?request_id=eq.${a.service_request_id}&select=vehicle_id&limit=1`
            );
            const vid = srs?.[0]?.vehicle_id;
            console.log(`[JECS]   → service_request vehicle_id: ${vid}`);
            if (vid) {
              const vehs = await sbFetch(
                `vehicles?vehicle_id=eq.${vid}&select=vehicle_type,color,license_plate&limit=1`
              );
              console.log(`[JECS]   → vehicle record:`, vehs?.[0]);
              if (vehs?.[0]) {
                const v    = vehs[0];
                vehicleSum   = v.vehicle_type || null;
                licensePlate = v.license_plate || null;
                vehicleType  = v.vehicle_type  || null;
              }
            }
          } catch (e) {
            console.warn("[JECS] vehicle lookup failed for appt", a.appointment_id, e.message);
          }
        }

        // Fallback: lookup by customer_id
        if (!vehicleSum && !vehicleType && a.customer_id) {
          try {
            const vehs = await sbFetch(
              `vehicles?customer_id=eq.${a.customer_id}&select=vehicle_type,color,license_plate&order=created_at.desc&limit=1`
            );
            console.log(`[JECS]   → customer vehicle fallback:`, vehs?.[0]);
            if (vehs?.[0]) {
              const v    = vehs[0];
              vehicleSum   = v.vehicle_type || null;
              licensePlate = v.license_plate || null;
              vehicleType  = v.vehicle_type  || null;
            }
          } catch (_) {}
        }

        console.log(`[JECS]   → final: summary="${vehicleSum}" type="${vehicleType}" plate="${licensePlate}"`);

        const vehicleDisplay = vehicleSum || vehicleType || null;

        return {
          ...a,
          customer_name:    custName       || "—",
          customer_address: custAddr       || "",
          vehicle_summary:  vehicleDisplay || "—",
          license_plate:    licensePlate   || "—",
          vehicle_type:     vehicleType    || "—",
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

// ── Vehicle Lookup — fetches directly from Supabase regardless of join chain ──
function VehicleLookup({ customerId, serviceRequestId }) {
  const [veh, setVeh]       = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!customerId && !serviceRequestId) { setStatus("no-ids"); return; }
    (async () => {
      setStatus("loading");
      try {
        // Try via service_request → vehicle_id first
        if (serviceRequestId) {
          const srs = await sbFetch(`service_requests?request_id=eq.${serviceRequestId}&select=vehicle_id&limit=1`);
          const vid = srs?.[0]?.vehicle_id;
          if (vid) {
            const vehs = await sbFetch(`vehicles?vehicle_id=eq.${vid}&select=vehicle_type,color,license_plate,vehicle_id&limit=1`);
            if (vehs?.[0]) { setVeh(vehs[0]); setStatus("found"); return; }
          }
        }
        // Fallback: most recent vehicle by customer
        if (customerId) {
          const vehs = await sbFetch(`vehicles?customer_id=eq.${customerId}&select=vehicle_type,color,license_plate,vehicle_id&order=created_at.desc&limit=1`);
          if (vehs?.[0]) { setVeh(vehs[0]); setStatus("found"); return; }
        }
        setStatus("not-found");
      } catch (e) {
        console.error("[JECS] VehicleLookup error:", e.message);
        setStatus("error");
      }
    })();
  }, [customerId, serviceRequestId]);

  const C_lbl = { fontSize: 10, fontWeight: 700, color: "#7A90B0", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 2 };

  if (status === "loading") return <div style={{ fontSize: 12, color: "#7A90B0" }}>Loading vehicle…</div>;
  if (status === "not-found") return <div style={{ fontSize: 12, color: "#EF4444" }}>No vehicle record found in Supabase for this customer.</div>;
  if (status === "error")     return <div style={{ fontSize: 12, color: "#EF4444" }}>Error fetching vehicle data.</div>;
  if (status === "no-ids")    return <div style={{ fontSize: 12, color: "#7A90B0" }}>No customer or service request linked.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: 8 }}>
      <div>
        <span style={C_lbl}>Vehicle</span>
        <span style={{ fontSize: 13, color: "#F0F4FF" }}>{veh.vehicle_type || "—"}</span>
      </div>
      <div>
        <span style={C_lbl}>Color</span>
        <span style={{ fontSize: 13, color: "#F0F4FF" }}>{veh.color || "—"}</span>
      </div>
      <div>
        <span style={C_lbl}>License Plate</span>
        <span style={{ fontSize: 13, color: "#D4A843", fontWeight: 700 }}>{veh.license_plate ? `🪪 ${veh.license_plate}` : "—"}</span>
      </div>
      <div>
        <span style={C_lbl}>Vehicle ID</span>
        <span style={{ fontSize: 10, color: "#7A90B0", fontFamily: "monospace" }}>{veh.vehicle_id?.slice(0,8)}…</span>
      </div>
    </div>
  );
}


function AppointmentModal({ appt, onClose, onSave }) {
  const [form, setForm] = useState({
    scheduled_start:       appt?.scheduled_start       || "",
    scheduled_end:         appt?.scheduled_end         || "",
    appointment_status:    appt?.appointment_status    || "Requested",
    preferred_time_window: appt?.preferred_time_window || "",
    customer_notes:        appt?.customer_notes        || "",
    weather_score:         appt?.weather_score         || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const inp     = { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 11px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const inpReq  = { ...inp, border: `1px solid ${C.warning}66` };
  const lbl     = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 };
  const lblReq  = { ...lbl, color: C.warning };

  const mapsUrl = appt?.customer_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.customer_address)}`
    : null;

  async function save() {
    // Preferred time window is mandatory
    if (!form.preferred_time_window.trim()) {
      setErr("Preferred time window is required.");
      return;
    }
    setSaving(true); setErr("");
    try {
      const payload = {
        ...form,
        weather_score: form.weather_score === "" || form.weather_score === null
          ? null
          : parseInt(form.weather_score, 10) || null,
      };
      await onSave(payload);
      onClose();
    }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 580, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", padding: "2rem", boxShadow: "0 25px 60px #00000099" }}>

        {/* Header — customer name prominent */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Edit Appointment</div>
            {appt?.customer_name && (
              <div style={{ fontSize: 14, color: C.accentLight, marginTop: 4, fontWeight: 600 }}>
                👤 {appt.customer_name}
              </div>
            )}
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Read-only info strip — address + maps link + vehicle + plate */}
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: 13 }}>
          <div>
            <div style={lbl}>Address</div>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{ color: C.accentLight, textDecoration: "none", fontSize: 13 }}>
                📍 {appt?.customer_address || "—"}
              </a>
            ) : (
              <div style={{ color: C.text }}>{appt?.customer_address || "—"}</div>
            )}
          </div>
          <div>
            <div style={lbl}>Vehicle & Plate</div>
            <VehicleLookup
              customerId={appt?.customer_id}
              serviceRequestId={appt?.service_request_id}
            />
          </div>
        </div>

        {/* Editable fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

          {/* Preferred time window — mandatory */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lblReq}>Preferred Time Window <span style={{ color: C.danger }}>*</span></label>
            <select
              style={form.preferred_time_window ? inp : inpReq}
              value={form.preferred_time_window}
              onChange={e => setForm(v => ({ ...v, preferred_time_window: e.target.value }))}>
              <option value="">-- Select a time window --</option>
              <option value="8AM-11AM">8AM – 11AM</option>
              <option value="11AM-2PM">11AM – 2PM</option>
              <option value="2PM-5PM">2PM – 5PM</option>
            </select>
          </div>

          {/* Status */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.appointment_status}
              onChange={e => setForm(v => ({ ...v, appointment_status: e.target.value }))}>
              {STATUS_PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
              <option value={STATUS_CANCELLED}>Cancelled</option>
              <option value={STATUS_RESCHEDULED}>Rescheduled</option>
            </select>
          </div>

          {/* Scheduled start / end */}
          {[
            { key: "scheduled_start", label: "Scheduled Start", type: "datetime-local" },
            { key: "scheduled_end",   label: "Scheduled End",   type: "datetime-local" },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input style={inp} type={f.type} value={form[f.key] || ""}
                onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}

          {/* Weather score */}
          <div>
            <label style={lbl}>Weather Score (0–100)</label>
            <input style={inp} type="number" min="0" max="100"
              value={form.weather_score || ""}
              onChange={e => setForm(v => ({ ...v, weather_score: e.target.value }))} />
          </div>

          {/* Customer notes */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Customer Notes</label>
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }}
              value={form.customer_notes || ""}
              onChange={e => setForm(v => ({ ...v, customer_notes: e.target.value }))} />
          </div>
        </div>

        {err && (
          <div style={{ marginTop: "1rem", fontSize: 12, color: C.danger, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="alert" size={13} color={C.danger} /> {err}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "1.5rem" }}>
          <button style={btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={btn("primary")} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Date Range Navigator (shared by Dashboard + Wash Pro) ─────────────────────
function DateStrip({ selectedDate, onSelect, rangedays = 7 }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = -rangedays; i <= rangedays; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const scrollRef = useRef(null);

  useEffect(() => {
    // Scroll selected day into centre of the strip
    const el = document.getElementById(`day-${selectedDate}`);
    if (el && scrollRef.current) {
      const strip  = scrollRef.current;
      const elLeft = el.offsetLeft;
      const elW    = el.offsetWidth;
      const stripW = strip.offsetWidth;
      strip.scrollTo({ left: elLeft - stripW / 2 + elW / 2, behavior: "smooth" });
    }
  }, [selectedDate]);

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Previous */}
        <button style={btn("ghost", true)} onClick={() => {
          const idx = days.indexOf(selectedDate);
          if (idx > 0) onSelect(days[idx - 1]);
        }}>◀</button>

        {/* Scrollable day tiles — constrained, no overflow */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowX: "auto",
            display: "flex",
            gap: 4,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}>
          {days.map(d => {
            const date    = new Date(d + "T12:00:00");
            const isToday = d === todayStr;
            const isSel   = d === selectedDate;
            const isPast  = d < todayStr;
            return (
              <div key={d} id={`day-${d}`}
                onClick={() => onSelect(d)}
                style={{
                  flexShrink: 0,
                  width: 48,
                  textAlign: "center",
                  padding: "6px 2px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isSel ? C.accent : isToday ? `${C.gold}22` : "transparent",
                  border: `1px solid ${isSel ? C.accent : isToday ? `${C.gold}55` : "transparent"}`,
                  transition: "all 0.12s",
                }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: isSel ? "#fff" : isToday ? C.gold : C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {date.toLocaleDateString([], { weekday: "short" })}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isSel ? "#fff" : isPast ? C.textMuted : C.text, lineHeight: 1.3 }}>
                  {date.getDate()}
                </div>
                <div style={{ fontSize: 9, color: isSel ? "#ffffffaa" : C.textMuted }}>
                  {date.toLocaleDateString([], { month: "short" })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Next */}
        <button style={btn("ghost", true)} onClick={() => {
          const idx = days.indexOf(selectedDate);
          if (idx < days.length - 1) onSelect(days[idx + 1]);
        }}>▶</button>

        {/* Today shortcut */}
        <button
          style={btn(selectedDate === todayStr ? "primary" : "ghost", true)}
          onClick={() => onSelect(todayStr)}>
          Today
        </button>
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ onNavigate }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [allAppts, setAllAppts]   = useState([]);
  const [subs, setSubs]           = useState([]);
  const [payments, setPayments]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [appts, subsData, paysData] = await Promise.all([
          sbFetch("appointments?select=appointment_id,appointment_status,scheduled_start&limit=1000") || [],
          sbFetch("subscriptions?select=subscription_id,active&limit=500") || [],
          sbFetch("payments?select=payment_id,payment_status,amount&limit=500") || [],
        ]);
        setAllAppts(appts || []);
        setSubs(subsData || []);
        setPayments(paysData || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading…</div>;

  // Filter appointments to selected date
  const dayAppts   = allAppts.filter(a => (a.scheduled_start || "").startsWith(selectedDate));
  const isToday    = selectedDate === todayStr;
  const isPast     = selectedDate < todayStr;

  const requested  = dayAppts.filter(a => a.appointment_status === "Requested");
  const inFlight   = dayAppts.filter(a => ["Confirmed","En Route","In Progress","Quality Check"].includes(a.appointment_status));
  const completed  = dayAppts.filter(a => a.appointment_status === "Completed");
  const activeSubs = subs.filter(s => s.active === true);
  const pendingPay = payments.filter(p => p.payment_status === "Pending");
  const revenue    = payments.filter(p => p.payment_status === "Paid").reduce((s, p) => s + Number(p.amount || 0), 0);

  const dateLabel = isToday
    ? "Today"
    : new Date(selectedDate + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const metrics = [
    { label: `${dateLabel}'s Appointments`, value: dayAppts.length,   accent: C.accentLight, icon: "clock",         action: () => onNavigate("appointments") },
    { label: "Requested",                   value: requested.length,  accent: C.warning,     icon: "alert",         action: () => onNavigate("appointments") },
    { label: "In Progress",                 value: inFlight.length,   accent: C.purple,      icon: "car",           action: () => onNavigate("appointments") },
    { label: "Completed",                   value: completed.length,  accent: C.success,     icon: "check",         action: () => onNavigate("appointments") },
    { label: "Active Subscriptions",        value: activeSubs.length, accent: C.gold,        icon: "subscriptions", action: null },
    { label: "Payments Pending",            value: pendingPay.length, accent: C.danger,      icon: "alert",         action: null },
    { label: "Revenue (Paid)",              value: `$${revenue.toFixed(2)}`, accent: C.success, icon: "check",      action: null },
  ];

  const dayCounts = {};
  STATUS_PIPELINE.forEach(s => { dayCounts[s] = dayAppts.filter(a => a.appointment_status === s).length; });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="dashboard" size={20} color={C.accentLight} /> Overview
        <span style={{ fontSize: 13, color: isPast ? C.textMuted : isToday ? C.gold : C.accentLight, fontWeight: 600 }}>
          {dateLabel}
        </span>
      </div>

      {/* Date strip navigator — ±2 weeks */}
      <DateStrip selectedDate={selectedDate} onSelect={setSelectedDate} rangedays={7} />

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {metrics.map(m => (
          <div key={m.label} onClick={m.action || undefined}
            style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderTop: `3px solid ${m.accent}`, borderRadius: 10, padding: "1.1rem 1.25rem", cursor: m.action ? "pointer" : "default" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {m.label} <Icon name={m.icon} size={14} color={m.accent} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: m.accent, lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline for selected date */}
      <div style={{ marginBottom: "0.75rem", fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>
        Pipeline — {dateLabel}
      </div>
      <PipelineBar counts={dayCounts} activeFilter={null} onFilter={() => onNavigate("appointments")} />
    </div>
  );
}

// ── Error boundary — catches render errors so the whole dashboard doesn't crash
class MapErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, msg: "" }; }
  static getDerivedStateFromError(err) { return { hasError: true, msg: err.message }; }
  componentDidCatch(err) { console.error("[JECS] MapErrorBoundary caught:", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Map error — please refresh</div>
          <div style={{ fontSize: 11, color: "#7A90B0" }}>{this.state.msg}</div>
          <button
            style={{ marginTop: 12, background: "#0284C7", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}
            onClick={() => this.setState({ hasError: false, msg: "" })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Wash Pro Map — stable Leaflet instance ───────────────────────────────────
function WashProMap({ rows, selectedId, onSelect }) {
  const mapRef     = useRef(null);  // DOM node
  const leafRef    = useRef(null);  // L.map instance
  const clusterRef = useRef(null);  // L.markerClusterGroup instance
  const markersRef = useRef({});    // { appointment_id: L.marker }
  const onSelectRef = useRef(onSelect); // stable ref to avoid stale closure

  // Keep onSelect ref current
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // ── Initialise Leaflet once on mount ─────────────────────────────────────
  useEffect(() => {
    function initMap() {
      if (!mapRef.current || leafRef.current) return;
      const L   = window.L;
      const map = L.map(mapRef.current, { zoomControl: true })
        .setView([35.1495, -90.0490], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      leafRef.current = map;
    }

    function waitForLeaflet(attempts = 0) {
      if (window.L && window.L.markerClusterGroup) { initMap(); return; }
      if (attempts > 50) { console.error("[JECS] Leaflet failed to load after 7.5s"); return; }
      setTimeout(() => waitForLeaflet(attempts + 1), 150);
    }

    function loadScript(src, id, cb) {
      if (document.getElementById(id)) { cb(); return; }
      const s  = document.createElement("script");
      s.id     = id;
      s.src    = src;
      s.onload = cb;
      s.onerror = () => console.error("[JECS] Failed to load:", src);
      document.head.appendChild(s);
    }

    function injectCSS(href, id) {
      if (document.getElementById(id)) return;
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet"; l.href = href;
      document.head.appendChild(l);
    }

    injectCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",                              "lf-css");
    injectCSS("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",          "mc-css");
    injectCSS("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",  "mc-def-css");

    loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "lf-js", () => {
      loadScript("https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js", "mc-js",
        () => waitForLeaflet()
      );
    });

    // Destroy map only on true unmount (component removed from tree)
    return () => {
      if (leafRef.current) {
        leafRef.current.remove();
        leafRef.current  = null;
        clusterRef.current = null;
        markersRef.current = {};
      }
    };
  }, []); // empty deps — run once only

  // ── Update markers whenever rows or selectedId changes ───────────────────
  useEffect(() => {
    let cancelled = false; // guard against updates after effect cleanup

    function tryUpdate(attempts = 0) {
      if (cancelled) return; // component unmounted or effect re-ran — stop
      const L   = window.L;
      const map = leafRef.current;
      if (!L || !map) {
        if (attempts < 40) setTimeout(() => tryUpdate(attempts + 1), 150);
        return;
      }

      try {
        // Remove old cluster layer
        if (clusterRef.current) {
          try { map.removeLayer(clusterRef.current); } catch (_) {}
          clusterRef.current = null;
        }

        const cluster = L.markerClusterGroup({
          maxClusterRadius:    55,
          spiderfyOnMaxZoom:   true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction(c) {
            const n    = c.getChildCount();
            const size = n < 10 ? 34 : n < 50 ? 42 : 50;
            return L.divIcon({
              className: "",
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
                background:#0284C7;border:3px solid #fff;color:#fff;
                font-weight:800;font-size:${n < 10 ? 13 : 11}px;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 3px 10px rgba(2,132,199,0.45);">${n}</div>`,
              iconSize:   [size, size],
              iconAnchor: [size / 2, size / 2],
            });
          },
        });

        markersRef.current = {};
        const valid  = rows.filter(r => r.customer_lat && r.customer_lng);
        const bounds = [];

        valid.forEach(a => {
          if (cancelled) return;
          const isSel = a.appointment_id === selectedId;
          const color = STATUS_COLORS[a.appointment_status] || "#7A90B0";
          const size  = isSel ? 22 : 14;
          const time  = a.scheduled_start
            ? new Date(a.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "—";

          const icon = L.divIcon({
            className: "",
            html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;
              background:${color};border:${isSel ? 3 : 2}px solid #fff;
              box-shadow:${isSel ? `0 0 0 4px ${color}44,` : ""}0 2px 6px rgba(0,0,0,0.3)"></span>`,
            iconSize:    [size, size],
            iconAnchor:  [size / 2, size / 2],
            popupAnchor: [0, -(size + 4)],
          });

          const marker = L.marker([a.customer_lat, a.customer_lng], {
            icon, zIndexOffset: isSel ? 1000 : 0,
          })
            .bindPopup(`
              <div style="font-family:Inter,sans-serif;min-width:200px;font-size:13px;line-height:1.5">
                <div style="font-weight:700;color:#172033;margin-bottom:2px">${a.customer_name || "—"}</div>
                <div style="color:#65738A;font-size:11px;margin-bottom:5px">${time} · ${a.appointment_status}</div>
                <div style="font-size:12px;color:#172033;margin-bottom:3px">${a.customer_address || "—"}</div>
                ${a.vehicle_summary && a.vehicle_summary !== "—"
                  ? `<div style="font-size:11px;color:#D4A843;margin-top:3px">🚗 ${a.vehicle_summary}</div>` : ""}
              </div>`, { maxWidth: 280 })
            .on("click", () => onSelectRef.current(a.appointment_id));

          cluster.addLayer(marker);
          markersRef.current[a.appointment_id] = marker;
          bounds.push([a.customer_lat, a.customer_lng]);
        });

        if (cancelled) return;

        // Route polyline through active jobs
        map.eachLayer(l => { if (l._isRoute) { try { map.removeLayer(l); } catch (_) {} } });
        const routePts = valid
          .filter(r => !["Completed","Cancelled","Rescheduled"].includes(r.appointment_status))
          .sort((a, b) => (a.scheduled_start || "").localeCompare(b.scheduled_start || ""))
          .map(r => [r.customer_lat, r.customer_lng]);

        if (routePts.length > 1) {
          const line = L.polyline(routePts, {
            color: "#0284C7", weight: 2.5, opacity: 0.55, dashArray: "8 10",
          }).addTo(map);
          line._isRoute = true;
        }

        map.addLayer(cluster);
        clusterRef.current = cluster;

        if (bounds.length > 0) {
          try { map.fitBounds(L.latLngBounds(bounds).pad(0.15)); } catch (_) {}
        }

        if (!cancelled) setTimeout(() => {
          if (!cancelled && leafRef.current) leafRef.current.invalidateSize();
        }, 120);

      } catch (err) {
        console.warn("[JECS] WashProMap update error:", err.message);
      }
    }

    tryUpdate();

    // Cleanup: cancel any in-flight polls when rows/selectedId changes
    // or when component unmounts
    return () => { cancelled = true; };
  }, [rows, selectedId]);

  // ── Pan to selected marker ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !leafRef.current) return;
    let cancelled = false;
    const marker = markersRef.current[selectedId];
    if (marker) {
      try {
        leafRef.current.panTo(marker.getLatLng(), { animate: true, duration: 0.35 });
        setTimeout(() => {
          if (!cancelled && leafRef.current) {
            try { marker.openPopup(); } catch (_) {}
          }
        }, 400);
      } catch (_) {}
    }
    return () => { cancelled = true; };
  }, [selectedId]);

  return (
    <div ref={mapRef} style={{
      width: "100%", height: "100%", minHeight: 500,
      background: C.surfaceAlt,
    }} />
  );
}


// ── Wash Pro Tab — scales to 140+ appointments ────────────────────────────────
function WashProTab() {
  const todayStr  = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [rows,       setRows]      = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [toast,      setToast]     = useState("");
  const [selectedId, setSelectedId] = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [fStatus, setFStatus] = useState("all");
  const [fZip,    setFZip]    = useState("");
  const [fWindow, setFWindow] = useState("all");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  // ── Load — single batch query, vehicle lookup cached by vehicle_id ────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Batch fetch — customers embedded in one request
      const appts = await sbFetch(
        `appointments?select=*,customers(full_name,formatted_address,latitude,longitude,phone_number,zip_code)&scheduled_start=gte.${selectedDate}T00:00:00&scheduled_start=lte.${selectedDate}T23:59:59&order=scheduled_start.asc&limit=500`
      ) || [];

      // Batch-collect all unique vehicle_ids from service_requests
      // Single query instead of N queries
      const srIds = appts.map(a => a.service_request_id).filter(Boolean);
      let srMap   = {};
      if (srIds.length > 0) {
        try {
          const srs = await sbFetch(
            `service_requests?request_id=in.(${srIds.join(",")})&select=request_id,vehicle_id`
          ) || [];
          srs.forEach(s => { srMap[s.request_id] = s.vehicle_id; });
        } catch (_) {}
      }

      // Batch-collect all unique vehicle records
      const vIds  = [...new Set(Object.values(srMap).filter(Boolean))];
      let vehMap  = {};
      if (vIds.length > 0) {
        try {
          const vehs = await sbFetch(
            `vehicles?vehicle_id=in.(${vIds.join(",")})&select=vehicle_id,vehicle_type,license_plate`
          ) || [];
          vehs.forEach(v => { vehMap[v.vehicle_id] = v; });
        } catch (_) {}
      }

      const enriched = appts.map(a => {
        const vid  = srMap[a.service_request_id];
        const veh  = vid ? vehMap[vid] : null;
        const lat  = parseFloat(a.customers?.latitude);
        const lng  = parseFloat(a.customers?.longitude);
        return {
          ...a,
          customer_name:    a.customers?.full_name         || "—",
          customer_address: a.customers?.formatted_address || "—",
          customer_phone:   a.customers?.phone_number      || "—",
          customer_zip:     a.customers?.zip_code          || "",
          customer_lat:     isFinite(lat) ? lat : null,
          customer_lng:     isFinite(lng) ? lng : null,
          vehicle_summary:  veh?.vehicle_type              || "—",
          license_plate:    veh?.license_plate             || "—",
        };
      });

      setRows(enriched);
      setSelectedId(enriched[0]?.appointment_id || null);
    } catch (e) { console.error(e); setRows([]); }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance(appt) {
    try {
      const next = await advanceStatus(appt);
      if (next) showToast(`✓ ${appt.customer_name} → ${next}`);
      load();
    } catch (e) { showToast("Error: " + e.message); }
  }

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filtered = rows.filter(a => {
    if (fStatus !== "all" && a.appointment_status !== fStatus) return false;
    if (fZip && !(a.customer_zip || "").includes(fZip)) return false;
    if (fWindow !== "all" && a.preferred_time_window !== fWindow) return false;
    return true;
  });

  const isToday   = selectedDate === todayStr;
  const dateLabel = isToday
    ? "Today"
    : new Date(selectedDate + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  // Status counts across ALL rows (not filtered) for summary
  const counts = {};
  STATUS_PIPELINE.forEach(s => { counts[s] = rows.filter(r => r.appointment_status === s).length; });

  const inp = {
    background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 6, padding: "5px 9px", color: C.text,
    fontSize: 12, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 0 }}>
      <Toast msg={toast} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="washpro" size={20} color={C.accentLight} />
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Wash Pro View</span>
          <span style={{ fontSize: 13, color: isToday ? C.gold : C.accentLight, fontWeight: 600 }}>{dateLabel}</span>
          <span style={{ fontSize: 11, background: `${C.accent}22`, color: C.accentLight, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
            {rows.length} appointments
          </span>
        </div>
        <button style={btn("ghost", true)} onClick={load}>
          <Icon name="refresh" size={12} /> Refresh
        </button>
      </div>

      {/* ── Pipeline summary bar ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {STATUS_PIPELINE.filter(s => counts[s] > 0).map(s => {
          const col    = statusColor(s);
          const active = fStatus === s;
          return (
            <div key={s} onClick={() => setFStatus(active ? "all" : s)}
              style={{
                padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                fontWeight: 700, background: active ? `${col}33` : `${col}11`,
                border: `1px solid ${active ? col : `${col}33`}`, color: col,
                transition: "all 0.12s",
              }}>
              {counts[s]} {s}
            </div>
          );
        })}
        {fStatus !== "all" && (
          <button style={{ ...btn("ghost", true), fontSize: 11 }} onClick={() => setFStatus("all")}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Date strip ─────────────────────────────────────────────────── */}
      <DateStrip selectedDate={selectedDate} onSelect={setSelectedDate} rangedays={7} />

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted }}>
          Loading {rows.length || ""} appointments for {dateLabel}…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>
          No appointments scheduled for {dateLabel}.
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0,
          display: "grid",
          gridTemplateColumns: "3fr 2fr",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
          background: C.surfaceAlt,
        }}>

          {/* ── LEFT: Clustered map — always mounted ────────────────────── */}
          <div style={{ position: "relative", minHeight: 0 }}>
            <MapErrorBoundary>
              <WashProMap
                rows={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </MapErrorBoundary>
            </MapErrorBoundary>
            {!rows.some(r => r.customer_lat && r.customer_lng) && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: `${C.surfaceAlt}ee`, pointerEvents: "none",
                color: C.textMuted, gap: 8, padding: "2rem",
              }}>
                <Icon name="pin" size={28} color={C.border} />
                <div style={{ fontSize: 13, textAlign: "center" }}>
                  No geocoded addresses.<br />
                  <span style={{ fontSize: 11 }}>Customer latitude/longitude needed for map pins.</span>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Filtered cards ───────────────────────────────── */}
          <div style={{ borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", minHeight: 0 }}>

            {/* Filter bar */}
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, background: C.surface }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select style={inp} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  {STATUS_PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="Cancelled">Cancelled</option>
                  <option value="Rescheduled">Rescheduled</option>
                </select>
                <select style={inp} value={fWindow} onChange={e => setFWindow(e.target.value)}>
                  <option value="all">All Windows</option>
                  <option value="8AM-11AM">8AM – 11AM</option>
                  <option value="11AM-2PM">11AM – 2PM</option>
                  <option value="2PM-5PM">2PM – 5PM</option>
                </select>
                <input style={{ ...inp, width: 80 }} placeholder="ZIP" maxLength={5}
                  value={fZip} onChange={e => setFZip(e.target.value)} />
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
                Showing <span style={{ color: C.accentLight }}>{filtered.length}</span> of {rows.length}
                {(fStatus !== "all" || fZip || fWindow !== "all") && (
                  <button style={{ marginLeft: 8, background: "none", border: "none", color: C.danger, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                    onClick={() => { setFStatus("all"); setFZip(""); setFWindow("all"); }}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable cards */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: C.textMuted, fontSize: 12 }}>
                  No appointments match these filters.
                </div>
              ) : (
                filtered.map(a => {
                  const currentIdx = STATUS_PIPELINE.indexOf(a.appointment_status);
                  const canAdvance = currentIdx >= 0 && currentIdx < STATUS_PIPELINE.length - 1;
                  const next       = canAdvance ? STATUS_PIPELINE[currentIdx + 1] : null;
                  const col        = statusColor(a.appointment_status);
                  const isSelected = a.appointment_id === selectedId;
                  const time       = a.scheduled_start
                    ? new Date(a.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—";

                  return (
                    <div key={a.appointment_id}
                      onClick={() => setSelectedId(a.appointment_id)}
                      style={{
                        padding: "12px 14px",
                        borderLeft: `3px solid ${isSelected ? col : "transparent"}`,
                        borderBottom: `1px solid ${C.border}`,
                        background: isSelected ? `${col}12` : "transparent",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}>

                      {/* Card header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{a.customer_name}</div>
                          <div style={{ fontSize: 10, color: C.accentLight }}>
                            {time}{a.preferred_time_window ? ` · ${a.preferred_time_window}` : ""}
                          </div>
                        </div>
                        <span style={{ ...pill(a.appointment_status), fontSize: 9, padding: "2px 7px" }}>
                          {a.appointment_status}
                        </span>
                      </div>

                      {/* Address */}
                      {a.customer_address !== "—" && (
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>
                          📍 {a.customer_address}
                        </div>
                      )}

                      {/* Vehicle + plate on one line */}
                      {a.vehicle_summary !== "—" && (
                        <div style={{ fontSize: 10, color: C.text, marginBottom: 3 }}>
                          🚗 {a.vehicle_summary}
                          {a.license_plate !== "—" && (
                            <span style={{ color: C.gold, fontWeight: 700, marginLeft: 6 }}>🪪 {a.license_plate}</span>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {a.customer_notes && (
                        <div style={{ fontSize: 10, color: C.warning, marginBottom: 4 }}>⚠ {a.customer_notes}</div>
                      )}

                      {/* Pipeline bar */}
                      <div style={{ display: "flex", gap: 2, marginBottom: canAdvance ? 6 : 0 }}>
                        {STATUS_PIPELINE.map((s, i) => (
                          <div key={s} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: STATUS_PIPELINE.indexOf(a.appointment_status) >= i
                              ? statusColor(s) : C.border,
                            opacity: a.appointment_status === s ? 1
                              : STATUS_PIPELINE.indexOf(a.appointment_status) > i ? 0.7 : 0.2,
                          }} title={s} />
                        ))}
                      </div>

                      {/* Advance button */}
                      {canAdvance && (
                        <button
                          style={{ ...btn("success", true), width: "100%", justifyContent: "center", fontSize: 10, padding: "4px 8px" }}
                          onClick={e => { e.stopPropagation(); handleAdvance(a); }}>
                          <Icon name="arrow" size={10} /> {next}
                        </button>
                      )}

                      {a.appointment_status === "Completed" && (
                        <div style={{ fontSize: 10, color: C.success, fontWeight: 700 }}>✓ Completed</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
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

// ── Service Packages Tab ──────────────────────────────────────────────────────
function ServicePackagesTab() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'form'
  const [selected, setSelected] = useState(null);
  const [toast, setToast]       = useState("");

  const showToast = m => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { setPackages(await sbFetch("service_packages?select=*&order=package_name.asc") || []); }
    catch (_) { setPackages([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    const payload = {
      ...form,
      base_price:                  form.base_price                  === "" ? null : parseFloat(form.base_price),
      estimated_duration_minutes:  form.estimated_duration_minutes  === "" ? null : parseInt(form.estimated_duration_minutes, 10),
      minimum_dry_days:            form.minimum_dry_days            === "" ? null : parseInt(form.minimum_dry_days, 10),
      requires_dry_window:         form.requires_dry_window === true || form.requires_dry_window === "true",
      active:                      form.active === true || form.active === "true",
    };
    if (selected) {
      await sbFetch(`service_packages?package_id=eq.${selected.package_id}`, {
        method: "PATCH", body: JSON.stringify(payload),
      });
      showToast("Package updated.");
    } else {
      await sbFetch("service_packages", { method: "POST", body: JSON.stringify(payload) });
      showToast("Package created.");
    }
    load();
  }

  async function toggleActive(pkg) {
    await sbFetch(`service_packages?package_id=eq.${pkg.package_id}`, {
      method: "PATCH", body: JSON.stringify({ active: !pkg.active }),
    });
    showToast(`${pkg.package_name} ${!pkg.active ? "activated" : "deactivated"}.`);
    load();
  }

  const inp = { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 11px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 };
  const td  = { padding: "13px 16px", borderBottom: `1px solid ${C.border}22`, verticalAlign: "middle", color: C.text, fontSize: 13 };
  const th  = { padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", background: `${C.border}55`, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  return (
    <div>
      <Toast msg={toast} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="packages" size={20} color={C.gold} /> Service Packages
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 400 }}>
            · {packages.filter(p => p.active).length} active
          </span>
        </div>
        <button style={btn("gold")} onClick={() => { setSelected(null); setModal("form"); }}>
          <Icon name="plus" size={13} /> New Package
        </button>
      </div>

      {/* Info banner */}
      <div style={{ background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 8, padding: "10px 16px", marginBottom: "1.5rem", fontSize: 13, color: C.gold, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="alert" size={14} color={C.gold} />
        Changes here update Supabase immediately. Update the package UUIDs in <code style={{ background: `${C.gold}22`, padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>index.html</code> on the customer site if you add new packages.
      </div>

      {/* Package cards grid */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading packages…</div>
      ) : packages.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted, fontSize: 13 }}>No packages found. Create your first one.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
          {packages.map(pkg => (
            <div key={pkg.package_id} style={{
              background: C.surfaceAlt, border: `1px solid ${pkg.active ? C.border : C.border + "66"}`,
              borderTop: `3px solid ${pkg.active ? C.gold : C.border}`,
              borderRadius: 10, padding: "1.25rem",
              opacity: pkg.active ? 1 : 0.6, transition: "opacity 0.15s",
            }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{pkg.package_name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontFamily: "monospace" }}>
                    {pkg.package_id?.slice(0, 8)}…
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                  background: pkg.active ? `${C.success}22` : `${C.textMuted}22`,
                  color: pkg.active ? C.success : C.textMuted,
                  border: `1px solid ${pkg.active ? C.success + "44" : C.border}`,
                  textTransform: "uppercase", letterSpacing: "0.07em",
                }}>
                  {pkg.active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Description */}
              {pkg.description && (
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: "0.75rem", lineHeight: 1.5 }}>
                  {pkg.description}
                </p>
              )}

              {/* Pricing & timing */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: C.surface, borderRadius: 7, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Base Price</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>
                    {pkg.base_price != null ? `$${Number(pkg.base_price).toFixed(2)}` : "—"}
                  </div>
                </div>
                <div style={{ background: C.surface, borderRadius: 7, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Duration</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.accentLight }}>
                    {pkg.estimated_duration_minutes != null ? `${pkg.estimated_duration_minutes}m` : "—"}
                  </div>
                </div>
              </div>

              {/* Dry window info */}
              {pkg.requires_dry_window && (
                <div style={{ fontSize: 11, color: C.warning, background: `${C.warning}11`, border: `1px solid ${C.warning}33`, borderRadius: 6, padding: "5px 9px", marginBottom: "0.75rem" }}>
                  ☀️ Requires {pkg.minimum_dry_days || 0} dry day{pkg.minimum_dry_days !== 1 ? "s" : ""} before service
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: "0.75rem" }}>
                <button style={{ ...btn("ghost", true), flex: 1, justifyContent: "center" }}
                  onClick={() => { setSelected(pkg); setModal("form"); }}>
                  <Icon name="edit" size={12} /> Edit
                </button>
                <button
                  style={{ ...btn(pkg.active ? "danger" : "success", true), flex: 1, justifyContent: "center" }}
                  onClick={() => toggleActive(pkg)}>
                  {pkg.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package table for quick price reference */}
      {packages.length > 0 && (
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.textMuted }}>
            Price Sheet — All Packages
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Package", "Price", "Duration", "Dry Window", "Min Dry Days", "Status"].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {packages.map(pkg => (
                <tr key={pkg.package_id}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{pkg.package_name}</div></td>
                  <td style={{ ...td, color: C.gold, fontWeight: 700 }}>
                    {pkg.base_price != null ? `$${Number(pkg.base_price).toFixed(2)}` : "—"}
                  </td>
                  <td style={td}>{pkg.estimated_duration_minutes != null ? `${pkg.estimated_duration_minutes} min` : "—"}</td>
                  <td style={td}>
                    <span style={{ color: pkg.requires_dry_window ? C.warning : C.textMuted }}>
                      {pkg.requires_dry_window ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={td}>{pkg.minimum_dry_days ?? "0"} day{pkg.minimum_dry_days !== 1 ? "s" : ""}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                      background: pkg.active ? `${C.success}22` : `${C.textMuted}22`,
                      color: pkg.active ? C.success : C.textMuted,
                    }}>
                      {pkg.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create modal */}
      {modal === "form" && (
        <PackageModal
          pkg={selected}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={async (form) => { await handleSave(form); setModal(null); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Package Modal ─────────────────────────────────────────────────────────────
function PackageModal({ pkg, onClose, onSave }) {
  const [form, setForm] = useState({
    package_name:               pkg?.package_name               || "",
    description:                pkg?.description                || "",
    base_price:                  pkg?.base_price                 ?? "",
    estimated_duration_minutes:  pkg?.estimated_duration_minutes ?? "",
    requires_dry_window:         pkg?.requires_dry_window        ?? false,
    minimum_dry_days:            pkg?.minimum_dry_days           ?? 0,
    active:                      pkg?.active                     ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const inp = { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 11px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 };

  async function save() {
    if (!form.package_name.trim()) { setErr("Package name is required."); return; }
    if (form.base_price !== "" && isNaN(parseFloat(form.base_price))) { setErr("Price must be a number."); return; }
    setSaving(true); setErr("");
    try { await onSave(form); }
    catch (e) { setErr(e.message || "Save failed."); setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 560, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", padding: "2rem", boxShadow: "0 25px 60px #00000099" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
            {pkg ? "Edit Package" : "New Package"}
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

          {/* Package name — full width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Package Name <span style={{ color: C.danger }}>*</span></label>
            <input style={inp} type="text" placeholder="e.g. Quick Wash"
              value={form.package_name}
              onChange={e => setForm(f => ({ ...f, package_name: e.target.value }))} />
          </div>

          {/* Description — full width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }}
              placeholder="Brief description shown to customers…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Price */}
          <div>
            <label style={lbl}>Base Price ($)</label>
            <input style={inp} type="number" min="0" step="0.01" placeholder="0.00"
              value={form.base_price}
              onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} />
          </div>

          {/* Duration */}
          <div>
            <label style={lbl}>Duration (minutes)</label>
            <input style={inp} type="number" min="1" placeholder="e.g. 20"
              value={form.estimated_duration_minutes}
              onChange={e => setForm(f => ({ ...f, estimated_duration_minutes: e.target.value }))} />
          </div>

          {/* Requires dry window */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.requires_dry_window}
                onChange={e => setForm(f => ({ ...f, requires_dry_window: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: C.warning }} />
              <span>Requires Dry Window (weather-dependent service)</span>
            </label>
          </div>

          {/* Minimum dry days — only show if dry window required */}
          {form.requires_dry_window && (
            <div>
              <label style={lbl}>Minimum Dry Days Before Service</label>
              <input style={inp} type="number" min="0" max="14" placeholder="0"
                value={form.minimum_dry_days}
                onChange={e => setForm(f => ({ ...f, minimum_dry_days: e.target.value }))} />
            </div>
          )}

          {/* Active toggle */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: C.success }} />
              <span>Active — visible on booking form</span>
            </label>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: "1rem", fontSize: 12, color: C.danger, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="alert" size={13} color={C.danger} /> {err}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "1.5rem" }}>
          <button style={btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={btn("gold")} onClick={save} disabled={saving}>
            {saving ? "Saving…" : pkg ? "Update Package" : "Create Package"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Wash Pro Profiles Tab ─────────────────────────────────────────────────────
const ONBOARDING_STATUSES  = ["pending","submitted","under_review","approved","rejected","suspended"];
const W9_STATUSES          = ["not_required","required","submitted","verified","needs_correction"];
const AGREEMENT_STATUSES   = ["required","submitted","signed","expired"];
const INSURANCE_STATUSES   = ["not_required","required","submitted","verified","expired"];
const BGCHECK_STATUSES     = ["not_required","required","submitted","passed","failed"];
const WORKER_TYPES         = ["employee","independent_contractor"];

const ONBOARDING_COLOR = {
  pending:      "#7A90B0",
  submitted:    "#0284C7",
  under_review: "#8B5CF6",
  approved:     "#10B981",
  rejected:     "#EF4444",
  suspended:    "#F59E0B",
};

const STATUS_BADGE_COLOR = {
  not_required:    { bg: "#1C2A3E", col: "#7A90B0" },
  required:        { bg: "#F59E0B22", col: "#F59E0B" },
  submitted:       { bg: "#0284C722", col: "#0284C7" },
  verified:        { bg: "#10B98122", col: "#10B981" },
  signed:          { bg: "#10B98122", col: "#10B981" },
  passed:          { bg: "#10B98122", col: "#10B981" },
  needs_correction:{ bg: "#EF444422", col: "#EF4444" },
  failed:          { bg: "#EF444422", col: "#EF4444" },
  expired:         { bg: "#F59E0B22", col: "#F59E0B" },
};

function statusDot(val) {
  const s = STATUS_BADGE_COLOR[val] || { bg: "#1C2A3E", col: "#7A90B0" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.05em", background: s.bg, color: s.col,
    }}>{(val || "—").replace(/_/g, " ")}</span>
  );
}

function WashProProfileModal({ profile, onClose, onSave }) {
  const isNew = !profile;
  const [form, setForm] = useState({
    worker_type:              profile?.worker_type              || "independent_contractor",
    legal_name:               profile?.legal_name               || "",
    business_name:            profile?.business_name            || "",
    email:                    profile?.email                    || "",
    phone_number:             profile?.phone_number             || "",
    onboarding_status:        profile?.onboarding_status        || "pending",
    w9_status:                profile?.w9_status                || "required",
    agreement_status:         profile?.agreement_status         || "required",
    insurance_status:         profile?.insurance_status         || "not_required",
    background_check_status:  profile?.background_check_status  || "not_required",
    active:                   profile?.active                   ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const inp = { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 11px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.legal_name.trim()) { setErr("Legal name is required."); return; }
    if (!form.email.trim())      { setErr("Email is required."); return; }
    setSaving(true); setErr("");
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const sectionHdr = (label) => (
    <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: "0.1em",
      textTransform: "uppercase", gridColumn: "1/-1", marginTop: 8,
      paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
      {label}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        width: 620, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto",
        padding: "2rem", boxShadow: "0 25px 60px #00000099" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
            {isNew ? "New Wash Pro Profile" : `Edit — ${profile.legal_name}`}
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}
            onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

          {sectionHdr("Identity")}

          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Worker Type</label>
            <select style={inp} value={form.worker_type} onChange={e => set("worker_type", e.target.value)}>
              <option value="employee">Employee</option>
              <option value="independent_contractor">Independent Contractor</option>
            </select>
          </div>

          {[
            { key: "legal_name",    label: "Legal Name",    required: true },
            { key: "business_name", label: "Business Name (optional)" },
            { key: "email",         label: "Email",         type: "email", required: true },
            { key: "phone_number",  label: "Phone Number",  type: "tel" },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}{f.required && <span style={{ color: C.danger }}> *</span>}</label>
              <input style={inp} type={f.type || "text"} value={form[f.key] || ""}
                onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}

          {sectionHdr("Onboarding Status")}

          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Onboarding Status</label>
            <select style={{ ...inp, borderColor: ONBOARDING_COLOR[form.onboarding_status] + "88" }}
              value={form.onboarding_status} onChange={e => set("onboarding_status", e.target.value)}>
              {ONBOARDING_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          {sectionHdr("Document & Compliance Status")}

          {[
            { key: "w9_status",                label: "W9 Status",               options: W9_STATUSES,       show: form.worker_type === "independent_contractor" },
            { key: "agreement_status",          label: "Agreement Status",        options: AGREEMENT_STATUSES,show: true },
            { key: "insurance_status",          label: "Insurance Status",        options: INSURANCE_STATUSES,show: true },
            { key: "background_check_status",   label: "Background Check Status", options: BGCHECK_STATUSES,  show: true },
          ].filter(f => f.show).map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <select style={inp} value={form[f.key]} onChange={e => set(f.key, e.target.value)}>
                {f.options.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          ))}

          {sectionHdr("Account")}

          <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ ...lbl, margin: 0 }}>Active</label>
            <input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.success }} />
            <span style={{ fontSize: 12, color: C.textMuted }}>
              {form.active ? "Wash Pro is active and can log in" : "Wash Pro cannot log in yet"}
            </span>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: "1rem", fontSize: 12, color: C.danger,
            display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="alert" size={13} color={C.danger} /> {err}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "1.5rem" }}>
          <button style={btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={btn("primary")} onClick={save} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create Profile" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WashProProfilesTab() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [typeFilter, setType]   = useState("all");
  const [statusFilter, setStat] = useState("all");
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]       = useState("");
  const [hovered, setHovered]   = useState(null);

  const showToast = m => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Join profiles to get auth email as fallback
      const data = await sbFetch(
        "wash_pro_profiles?select=*,profiles(id,full_name,email,role,phone_number)&order=created_at.desc&limit=200"
      ) || [];

      // Enrich — prefer wash_pro_profiles fields, fall back to profiles
      const enriched = data.map(r => ({
        ...r,
        display_name:  r.legal_name   || r.profiles?.full_name  || "—",
        display_email: r.email        || r.profiles?.email       || "—",
        display_phone: r.phone_number || r.profiles?.phone_number|| "—",
      }));

      setRows(enriched);
    } catch (e) {
      console.error("[JECS] wash_pro_profiles load failed:", e.message);
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (selected) {
      await sbFetch(`wash_pro_profiles?wash_pro_id=eq.${selected.wash_pro_id}`, {
        method: "PATCH", body: JSON.stringify({ ...form, updated_at: new Date().toISOString() }),
      });
      // Auto-set approved_at when status changes to approved
      if (form.onboarding_status === "approved" && selected.onboarding_status !== "approved") {
        await sbFetch(`wash_pro_profiles?wash_pro_id=eq.${selected.wash_pro_id}`, {
          method: "PATCH", body: JSON.stringify({ approved_at: new Date().toISOString() }),
        });
      }
      showToast("Profile updated.");
    } else {
      await sbFetch("wash_pro_profiles", { method: "POST", body: JSON.stringify(form) });
      showToast("Profile created.");
    }
    load();
  }

  async function toggleActive(row) {
    await sbFetch(`wash_pro_profiles?wash_pro_id=eq.${row.wash_pro_id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !row.active, updated_at: new Date().toISOString() }),
    });
    showToast(row.active ? "Deactivated." : "Activated.");
    load();
  }

  const filtered = rows.filter(r => {
    if (typeFilter !== "all" && r.worker_type !== typeFilter) return false;
    if (statusFilter !== "all" && r.onboarding_status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || (r.legal_name || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.business_name || "").toLowerCase().includes(q);
  });

  // Summary counts
  const counts = {};
  ONBOARDING_STATUSES.forEach(s => { counts[s] = rows.filter(r => r.onboarding_status === s).length; });

  const th = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase",
    background: `${C.border}55`, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const td = { padding: "11px 14px", borderBottom: `1px solid ${C.border}22`,
    verticalAlign: "middle", color: C.text, fontSize: 13 };

  return (
    <div>
      <Toast msg={toast} />

      {/* Page title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="washpro" size={20} color={C.accentLight} /> Wash Pro Profiles
          <span style={{ fontSize: 12, background: `${C.accent}22`, color: C.accentLight,
            padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
            {rows.length} total
          </span>
        </div>
        <button style={btn("gold")} onClick={() => { setSelected(null); setModal("form"); }}>
          <Icon name="plus" size={13} /> New Profile
        </button>
      </div>

      {/* Onboarding pipeline summary */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {ONBOARDING_STATUSES.map(s => {
          const col    = ONBOARDING_COLOR[s] || C.textMuted;
          const active = statusFilter === s;
          return (
            <div key={s} onClick={() => setStat(active ? "all" : s)}
              style={{ flex: 1, minWidth: 90, background: active ? `${col}33` : C.surfaceAlt,
                border: `1px solid ${active ? col : C.border}`, borderTop: `3px solid ${col}`,
                borderRadius: 8, padding: "8px 12px", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: col, textTransform: "uppercase",
                letterSpacing: "0.07em", marginBottom: 3 }}>{s.replace(/_/g, " ")}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: active ? col : C.text }}>
                {counts[s] || 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "1rem 1.5rem",
          borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}>
              <Icon name="search" size={13} color={C.textMuted} />
            </span>
            <input style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "6px 11px 6px 30px", color: C.text, fontSize: 13, outline: "none", width: 200 }}
              placeholder="Search wash pros…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "6px 10px", color: C.text, fontSize: 12, cursor: "pointer" }}
            value={typeFilter} onChange={e => setType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="employee">Employee</option>
            <option value="independent_contractor">Independent Contractor</option>
          </select>
          <button style={btn("ghost", true)} onClick={load}>
            <Icon name="refresh" size={13} />
          </button>
          <div style={{ marginLeft: "auto", fontSize: 12, color: C.textMuted }}>
            {filtered.length} profile{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted }}>Loading profiles…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No wash pro profiles found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Name","Type","Onboarding","W9","Agreement","Insurance","Bg Check","Active","Actions"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.wash_pro_id}
                    style={{ background: hovered === r.wash_pro_id ? C.surfaceHover : "transparent",
                      transition: "background 0.1s" }}
                    onMouseEnter={() => setHovered(r.wash_pro_id)}
                    onMouseLeave={() => setHovered(null)}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.display_name || r.legal_name || "—"}</div>
                      {r.business_name && (
                        <div style={{ fontSize: 11, color: C.textMuted }}>{r.business_name}</div>
                      )}
                      <div style={{ fontSize: 11, color: C.accentLight }}>{r.display_email || r.email || "—"}</div>
                      {(r.display_phone || r.phone_number) && (
                        <div style={{ fontSize: 11, color: C.textMuted }}>{r.display_phone || r.phone_number}</div>
                      )}
                    </td>
                    <td style={td}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 10,
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        background: r.worker_type === "employee" ? `${C.accent}22` : `${C.purple}22`,
                        color: r.worker_type === "employee" ? C.accentLight : C.purple,
                      }}>
                        {r.worker_type === "employee" ? "Employee" : "Contractor"}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 10,
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        background: `${ONBOARDING_COLOR[r.onboarding_status] || C.textMuted}22`,
                        color: ONBOARDING_COLOR[r.onboarding_status] || C.textMuted,
                      }}>
                        {(r.onboarding_status || "—").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={td}>{r.worker_type === "independent_contractor" ? statusDot(r.w9_status) : <span style={{ color: C.textMuted, fontSize: 11 }}>N/A</span>}</td>
                    <td style={td}>{statusDot(r.agreement_status)}</td>
                    <td style={td}>{statusDot(r.insurance_status)}</td>
                    <td style={td}>{statusDot(r.background_check_status)}</td>
                    <td style={td}>
                      <span style={{
                        display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                        background: r.active ? C.success : C.danger,
                        boxShadow: r.active ? `0 0 6px ${C.success}` : "none",
                      }} />
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={btn("ghost", true)} title="Edit"
                          onClick={() => { setSelected(r); setModal("form"); }}>
                          <Icon name="edit" size={12} />
                        </button>
                        <button
                          style={btn(r.active ? "danger" : "success", true)}
                          title={r.active ? "Deactivate" : "Activate"}
                          onClick={() => toggleActive(r)}>
                          {r.active ? "Deactivate" : "Activate"}
                        </button>
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
        <WashProProfileModal
          profile={selected}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",    label: "Dashboard",         icon: "dashboard" },
  { id: "appointments", label: "Appointments",      icon: "appointments" },
  { id: "washpro",      label: "Wash Pro View",     icon: "washpro" },
  { id: "customers",    label: "Customers",         icon: "customers" },
  { id: "packages",     label: "Service Packages",  icon: "packages" },
  { id: "washpros",     label: "Wash Pro Profiles", icon: "washpros" },
];

const NAV_COLORS = {
  dashboard:    C.accentLight,
  appointments: C.accentLight,
  washpro:      C.success,
  customers:    C.gold,
  packages:     C.gold,
  washpros:     C.purple,
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
          {tab === "packages"     && <ServicePackagesTab />}
          {tab === "washpros"     && <WashProProfilesTab />}
        </main>
      </div>
    </div>
  );
}
