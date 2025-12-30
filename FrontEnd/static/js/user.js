// static/js/user.js — Updated: show TOP 3 NON-FRAUD claims from MongoDB, profile from /user_data

document.addEventListener("DOMContentLoaded", () => {
  wireTheme();
  setupLogout(); // Set up logout immediately
  init();
});

// Logout button
function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("Logout clicked - clearing session");
      localStorage.removeItem("authToken");
      localStorage.removeItem("userData");
      sessionStorage.clear();
      try { await fetch('/logout', { method: 'GET', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
      window.location.href = "/login";
    });
  } else {
    console.warn("Logout button not found in DOM");
  }
}

// Main init
async function init() {
  try {
    // 1) Profile (from app.py MySQL)
    try {
      const p = await fetchJSON("/user_data");
      if (p?.status === "success" && Array.isArray(p.data) && p.data.length) {
        renderProfile(p.data[0]);
      } else {
        notify("Unable to load profile.", "warn");
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      notify("Unable to load profile.", "error");
    }

    // 2) Claims from MongoDB
    let claimsFromMongo = [];
    try {
      const m = await fetchJSON("http://localhost:5002/all_claims");
      if (m?.status === "success" && Array.isArray(m.data)) {
        claimsFromMongo = m.data;
      } else {
        console.warn("Mongo returned non-success or empty:", m);
        notify("Unable to load claims from MongoDB.", "warn");
      }
    } catch (err) {
      console.error("Mongo claims fetch error:", err);
      notify("MongoDB service unavailable.", "error");
    }

    // 3) Sort, filter NON-FRAUD, then take top 3
    const sorted = sortClaimsByDateDesc(claimsFromMongo);
    const nonFraudList = sorted.filter(c => isNonFraudStatus(c.status ?? c.review_status ?? c.prediction_label));
    const top3NonFraud = Array.isArray(nonFraudList) ? nonFraudList.slice(0, 3) : [];

    // 4) Render top 3 non-fraud claims
    renderClaims(top3NonFraud);

    // 5) Chatbot init (optional)
    if (typeof initChatbot === 'function') initChatbot();

  } catch (e) {
    console.error("init error:", e);
    notify("Server error. Please try again.", "error");
  }
}

/* -------- Helpers -------- */
function isNonFraudStatus(status) {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  // match common "non-fraud" labels; adjust/personalize as needed
  return /(^|\W)(non[\s_-]?fraud|no[\s_-]?fraud|clean|approved|ok|no[-_ ]?issue|not[-_ ]?fraud)(\W|$)/i.test(s);
}

function wireTheme() {
  const btn = document.getElementById("themeToggle");
  const icon = document.getElementById("theme-icon");
  function setIcon(theme) {
    if (!icon) return;
    icon.src = theme === "light" ? "/static/assets/images/sun.png" : "/static/assets/images/brightness.png";
    icon.alt = theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";
  }
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  setIcon(saved);
  btn?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setIcon(next);
  });
}

// improved fetch helper
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { credentials: "same-origin", ...options });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (e) {}
    const errMsg = parsed && parsed.message ? parsed.message : `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return text ? JSON.parse(text) : {};
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function safe(v) { return v != null ? String(v) : ''; }
function qs(sel) { return document.querySelector(sel); }
function notify(msg, lvl = "info") { console.log(`[${lvl.toUpperCase()}] ${msg}`); }

function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === "") return '-';
  const n = Number(amount);
  if (isNaN(n)) return safe(amount);
  return `$${n.toFixed(2)}`;
}
function statusPill(status) {
  const s = (status || '').toString();
  const statusClass = s ? s.toLowerCase().replace(/\s+/g, '-') : 'unknown';
  const nonIndicators = ['clean', 'non-fraud', 'no-fraud', 'approved', 'ok'];
  const isNon = nonIndicators.some(k => statusClass.includes(k));
  const cls = isNon ? `status-pill status-non` : `status-pill status-${statusClass}`;
  return `<span class="${cls}">${safe(s)}</span>`;
}

/* -------- Sorting utility (same as before) -------- */
function sortClaimsByDateDesc(list) {
  if (!Array.isArray(list)) return [];

  const dateFields = ["created_at", "createdAt", "claim_date", "date", "submitted_at", "timestamp"];
  const mapped = list.map(item => {
    let dt = null;
    for (const f of dateFields) {
      if (item && item[f]) {
        const d = new Date(item[f]);
        if (!isNaN(d.getTime())) { dt = d; break; }
      }
    }
    return { item, dt };
  });

  const anyDate = mapped.some(m => m.dt);
  if (anyDate) {
    mapped.sort((a, b) => (b.dt ? b.dt.getTime() : 0) - (a.dt ? a.dt.getTime() : 0));
    return mapped.map(m => m.item);
  }

  // fallback: numeric extraction from claim_id
  const extracted = list.map(item => {
    let num = null;
    if (item && item.claim_id && typeof item.claim_id === "string") {
      const m = item.claim_id.match(/(\d+)/);
      if (m) num = parseInt(m[1], 10);
    }
    return { item, num };
  });
  if (extracted.some(x => x.num !== null)) {
    extracted.sort((a, b) => (b.num || 0) - (a.num || 0));
    return extracted.map(x => x.item);
  }

  return list.slice();
}

/* -------- Render Profile -------- */
function renderProfile(user) {
  setText("fullName", `${safe(user.first_name)} ${safe(user.last_name)}`.trim() || "—");
  setText("patientId", `Patient ID: ${safe(user.patient_id) || "—"}`);
  setText("age", user.age ? `${safe(user.age)} years` : "-");
  setText("gender", safe(user.gender) || "-");
  setText("phone", safe(user.phone_no) || "-");
  setText("insuranceId", safe(user.insurance_id) || "-");
  setText("address", safe(user.address) || "-");
  const history = Array.isArray(user.medical_history) ? user.medical_history : (user.medical_history ? [user.medical_history] : []);
  setText("medicalHistory", history.length ? history.join(", ") : "-");
  setText("username", safe(user.first_name) || "User");
  setText("sidebarName", `${safe(user.first_name)} ${safe(user.last_name)}`.trim() || "User");
}

/* -------- Render Claims (top 3 non-fraud passed in) -------- */
function renderClaims(list) {
  const tbody = qs("#claimsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:18px 8px;">No non-fraud claims found</td></tr>`;
    return;
  }

  list.forEach(c => {
    const tr = document.createElement("tr");
    const amount = c.amount ?? c.claim_amount ?? c.amount_claimed ?? c.amt;
    const status = c.status ?? c.review_status ?? c.prediction_label ?? "";
    tr.innerHTML = `
      <td>${safe(c.claim_id ?? c.id)}</td>
      <td>${safe(c.provider_id ?? c.provider)}</td>
      <td class="amount">${formatAmount(amount)}</td>
      <td>${statusPill(status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

