const searchInput = document.getElementById("searchInputOnly");
const clearBtn = document.getElementById("searchClearOnly");
const searchResult = document.getElementById("searchResult");

console.log("🔎 ticket-search.js loaded");

const searchBtn = document.getElementById("searchBtnOnly");


// ─────────────────────────────────────────────
// API WRAPPER
// ─────────────────────────────────────────────
async function apiRequest(endpoint, method = "GET", body = null) {

  const API_ROOT = "http://127.0.0.1:8000/api";

  try {

    const res = await fetch(`${API_ROOT}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : null
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Request failed");
    }

    return data;

  } catch (err) {

    console.error("❌ API Error:", err.message);
    return { error: true, message: err.message };
  }
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getParentKey(input) {
  if (!input) return "";
  const value = input.trim().toUpperCase();
  const match = value.match(/^([A-Z]+-\d+)/);
  return match ? match[1] : value;
}


// ─────────────────────────────────────────────
// CHILD VIEW (UNCHANGED)
// ─────────────────────────────────────────────
function createChildView(ticket) {

  const div = document.createElement("div");

  div.className =
    "bg-yellow/5 border border-yellow/20 rounded-xl p-4 mb-4 animate-slideUp";

  div.innerHTML = `

    <!-- HEADER -->
    <div class="flex items-center justify-between mb-2">

      <span class="mono text-yellow text-xs font-bold">
        ${ticket.issue_key}
      </span>

      <span class="mono text-xs px-2 py-0.5 rounded border ${ticket.status === "Completed"
      ? "text-green border-green/20 bg-green/5"
      : "text-yellow border-yellow/20 bg-yellow/5"
    }">
        ${ticket.status === "Completed" ? "✔ Completed" : "● Open"}
      </span>

    </div>


    <!-- BODY -->
    <div class="text-sm space-y-1 text-slate-300">

      <div class="grid grid-cols-2 gap-2 text-xs">

        <div>
          <span class="mono text-[0.6rem] text-muted uppercase block mb-0.5">
            Name
          </span>
          <div>${ticket.name || "-"}</div>
        </div>

        <div>
          <span class="mono text-[0.6rem] text-muted uppercase block mb-0.5">
            Email
          </span>
          <div class="truncate">${ticket.email || "-"}</div>
        </div>

      </div>

      <div>
        <span class="mono text-[0.6rem] text-muted uppercase block mb-0.5">
          Summary
        </span>
        <div>${ticket.summary || "-"}</div>
      </div>

      <div>
        <span class="mono text-[0.6rem] text-muted uppercase block mb-0.5">
          Description
        </span>
        <div class="text-slate-300 leading-relaxed">
          ${ticket.description || "-"}
        </div>
      </div>

    </div>
  `;

  return div;
}


// ─────────────────────────────────────────────
// FULL DASHBOARD CARD (EXACT COPY - SAME AS MAIN FILE)
// ─────────────────────────────────────────────
function createFullTicketCard(t, idx = 0) {

  const isCompleted = t.status === "Completed";

  const card = document.createElement("div");

  card.className =
    "animate-slideUp bg-surface border border-purple/15 rounded-2xl overflow-hidden shadow-lg hover:border-purple/30 transition-all duration-200";

  card.style.animationDelay = `${idx * 0.05}s`;

  card.innerHTML = `

    <!-- HEADER -->
    <div class="flex items-center justify-between px-4 py-3 bg-surface2 border-b border-purple/15">

      <div class="flex items-center gap-2">

        <span class="mono text-yellow text-sm font-bold">
          ${t.issue_key || "-"}
        </span>

        ${t.child_count > 0 ? `
          <span class="mono text-[0.6rem] px-2 py-0.5 rounded-full bg-purple/10 border border-purple/20 text-purple">
            ${t.child_count} child
          </span>
        ` : ""}

      </div>

      <span class="mono text-xs px-2.5 py-0.5 rounded-full border ${isCompleted
      ? 'text-green border-green/20 bg-green/5'
      : 'text-yellow border-yellow/20 bg-yellow/5'
    }">
        ${isCompleted ? "✔ Completed" : "● Open"}
      </span>

    </div>


    <!-- ESCALATION / ASSIGNED INFO -->
    ${!isCompleted ? (() => {

      const esc = localStorage.getItem(`esc_${t.issue_key}`);

      if (!esc) {
        return `
          <div class="px-4 py-2 border-b border-purple/10 bg-surface2">
            <span class="mono text-[0.65rem] text-yellow bg-yellow/10 px-2 py-0.5 rounded-full">
              Status: Assigned
            </span>
          </div>
        `;
      }

      return `
        <div class="px-4 py-2 border-b border-purple/10 bg-blue-900/10 flex items-center gap-2">

          <span class="mono text-[0.65rem] text-white/90 bg-blue-700/30 px-2 py-0.5 rounded-full">
            🚀 Escalated to (${esc})
          </span>

        </div>
      `;
    })() : ''}


    <!-- BODY -->
    <div class="px-4 py-3 space-y-2 text-sm">

      <!-- NAME + EMAIL -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-2">

        <div>
          <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block mb-0.5">
            Name
          </span>
          <span class="text-slate-200 text-xs">
            ${t.name || "-"}
          </span>
        </div>

        <div>
          <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block mb-0.5">
            Email
          </span>
          <span class="text-slate-200 text-xs truncate block">
            ${t.email || "-"}
          </span>
        </div>

      </div>


      <!-- SUMMARY -->
      <div>
        <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block mb-0.5">
          Summary
        </span>
        <span class="text-slate-200 text-xs">
          ${t.summary || "-"}
        </span>
      </div>


      <!-- DESCRIPTION -->
      <div>
        <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block mb-0.5">
          Description
        </span>
        <span class="text-slate-300 text-xs leading-relaxed line-clamp-2">
          ${t.description || "-"}
        </span>
      </div>

    </div>


    <!-- ACTIONS -->
    <div class="px-4 py-3 border-t border-purple/10 flex items-center gap-2">

      <button class="flex-1 bg-purple/15 border border-purple/20 text-purple text-[0.65rem] font-bold py-2 px-3 rounded-xl"
        onclick="window.open('runbooks.html?id=${t.issue_key}', '_blank')">
        ⚙ Runbook
      </button>

      <button class="flex-1 bg-surface2 border border-purple/15 text-slate-300 text-[0.65rem] font-bold py-2 px-3 rounded-xl"
        onclick="openChildTickets('${t.issue_key}')">
        👥 Child
      </button>

      <button class="bg-red/10 border border-red/20 text-red text-[0.65rem] font-bold py-2 px-3 rounded-xl"
        onclick="deleteTicket('${t.issue_key}')">
        🗑
      </button>

    </div>
  `;

  return card;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function showLoadingSteps() {

  const steps = [
    "🔍 Fetching ticket...",
    "👶 Loading child relations...",
    "📦 Finalizing view..."
  ];

  searchResult.innerHTML = `
    <div class="mono text-sm text-muted space-y-3 p-6">
      ${steps.map(s => `
        <div class="flex items-center gap-2 animate-pulse">
          <span class="text-purple">●</span>
          <span>${s}</span>
        </div>
      `).join("")}
    </div>
  `;

  for (let i = 0; i < steps.length; i++) {
    await sleep(2000); // 2 sec per step
  }
}

// ─────────────────────────────────────────────
// SEARCH LOGIC
// ─────────────────────────────────────────────
async function filterTickets() {

  let input = searchInput?.value?.trim().toUpperCase();

  if (!input) {
    searchResult.innerHTML = "";
    clearBtn.classList.add("hidden");
    return;
  }

  const parentKey = getParentKey(input);

  try {

    // ─────────────────────────────────────────────
    // STEP-BY-STEP LOADING UI (PROFESSIONAL)
    // ─────────────────────────────────────────────
    const steps = [
      { icon: "🔍", label: "Fetching ticket details", sub: "Querying issue registry & metadata" },
      { icon: "👶", label: "Child & parent detection", sub: "Mapping parent-child relationships & hierarchy" },
      { icon: "🔄", label: "Duplicate detection", sub: "Cross-checking for duplicate & linked issues" },
      { icon: "📖", label: "Runbook lookup & generation", sub: "Fetching & compiling resolution runbooks" },
      { icon: "📦", label: "Preparing dashboard view", sub: "Finalizing all data for render" }
    ];

    searchResult.innerHTML = `
      <style>
        @keyframes loaderSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes loaderFadeSlideIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loaderPulseIcon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(0.82); }
        }
        @keyframes loaderGlow {
          0%, 100% { box-shadow: 0 0 6px #a855f760; }
          50%       { box-shadow: 0 0 14px #a855f7b0; }
        }
        .ldr-step { animation: loaderFadeSlideIn 0.3s ease both; }
        .ldr-step.active .ldr-icon  { animation: loaderPulseIcon 1s ease-in-out infinite; }
        .ldr-step.active .ldr-dot   { border-color: #a855f7; animation: loaderGlow 1.2s ease-in-out infinite; }
        .ldr-step.done   .ldr-dot   { background: #a855f7; border-color: #a855f7; box-shadow: 0 0 8px #a855f750; }
        .ldr-step.done   .ldr-label { color: #cbd5e1; }
        .ldr-step.done   .ldr-sub   { color: #4b5563; }
        .ldr-step.active .ldr-label { color: #f8fafc; font-weight: 700; }
        .ldr-step.active .ldr-sub   { color: #94a3b8; }
        .ldr-step.pending .ldr-label { color: #374151; }
        .ldr-step.pending .ldr-sub   { color: #1f2937; }
        .ldr-dot {
          width: 10px; height: 10px; border-radius: 50%;
          border: 1.5px solid #2d2d3e; background: transparent;
          flex-shrink: 0; transition: all 0.35s ease;
        }
        .ldr-connector {
          width: 1.5px; height: 16px;
          background: #1e1b2e;
          margin: 2px 0 2px 4.25px;
          transition: background 0.4s ease;
        }
        .ldr-connector.lit {
          background: linear-gradient(to bottom, #a855f7 0%, #2d2d3e 100%);
        }
        .ldr-check { display: none; color: #a855f7; font-size: 0.6rem; margin-left: 4px; }
        .ldr-check.show { display: inline; }
        .ldr-badge {
          font-size: 0.55rem; font-family: 'SF Mono', 'Fira Code', monospace;
          letter-spacing: 0.06em; text-transform: uppercase; padding: 1px 6px;
          border-radius: 20px; border: 1px solid rgba(168,85,247,0.2);
          color: #7c3aed; background: rgba(168,85,247,0.06);
        }
      </style>

      <div id="loaderWrap" style="
        background: linear-gradient(160deg, #0d0d1a 0%, #110e1f 100%);
        border: 1px solid rgba(168,85,247,0.14);
        border-radius: 18px;
        padding: 22px 24px 20px;
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03);
      ">

        <!-- ── Header ── -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="
              width:28px; height:28px; border-radius:50%;
              border: 2px solid rgba(168,85,247,0.25);
              border-top-color: #a855f7;
              animation: loaderSpin 0.85s linear infinite;
              flex-shrink:0;
            "></div>
            <div>
              <div style="font-size:0.7rem; font-weight:700; color:#e2e8f0; letter-spacing:0.1em; text-transform:uppercase;">
                Intelligence Pipeline
              </div>
              <div style="font-size:0.58rem; color:#4b5563; margin-top:2px; letter-spacing:0.04em;">
                ${parentKey} · ${steps.length}-phase ticket analysis
              </div>
            </div>
          </div>
          <span class="ldr-badge">Running</span>
        </div>

        <!-- ── Progress bar ── -->
        <div style="height:2px; background:#1a1730; border-radius:4px; margin-bottom:20px; overflow:hidden;">
          <div id="ldrBar" style="
            height:100%; width:0%;
            background: linear-gradient(90deg, #6d28d9, #a855f7, #c084fc);
            border-radius:4px;
            transition: width 0.55s cubic-bezier(0.4,0,0.2,1);
            box-shadow: 0 0 8px #a855f760;
          "></div>
        </div>

        <!-- ── Steps ── -->
        <div id="ldrStepList">
          ${steps.map((s, i) => `
            <div id="lstep_${i}" class="ldr-step ${i === 0 ? 'active' : 'pending'}"
                 style="animation-delay:${i * 0.04}s;">
              <div style="display:flex; align-items:flex-start; gap:10px;">
                <!-- dot + connector column -->
                <div style="display:flex; flex-direction:column; align-items:center; padding-top:3px;">
                  <div class="ldr-dot"></div>
                  ${i < steps.length - 1
        ? `<div class="ldr-connector" id="lconn_${i}"></div>`
        : ""}
                </div>
                <!-- text column -->
                <div style="min-height:${i < steps.length - 1 ? '34px' : '18px'}; padding-bottom:${i < steps.length - 1 ? '2px' : '0'};">
                  <div style="display:flex; align-items:center; gap:5px; line-height:1;">
                    <span class="ldr-icon" style="font-size:0.7rem;">${s.icon}</span>
                    <span class="ldr-label" style="font-size:0.68rem; letter-spacing:0.025em; transition:color 0.3s ease;">
                      ${s.label}
                    </span>
                    <span class="ldr-check" id="lcheck_${i}">✔</span>
                  </div>
                  <div class="ldr-sub" style="font-size:0.58rem; letter-spacing:0.02em; margin-top:2px; padding-left:21px; transition:color 0.3s ease;">
                    ${s.sub}
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>

        <!-- ── Footer ── -->
        <div style="
          margin-top:16px; padding-top:12px;
          border-top:1px solid rgba(255,255,255,0.04);
          display:flex; align-items:center; justify-content:space-between;
        ">
          <span style="font-size:0.56rem; color:#2d2d3e; letter-spacing:0.06em; text-transform:uppercase;">
            ● Ticket intelligence · Est. ~${steps.length}s
          </span>
          <span id="ldrPhaseLabel" style="font-size:0.56rem; color:#4b5563; letter-spacing:0.04em;">
            Phase 1 / ${steps.length}
          </span>
        </div>

      </div>
    `;

    // ── Animate steps sequentially ──
    const STEP_MS = 1000;
    for (let i = 0; i < steps.length; i++) {

      const el = document.getElementById(`lstep_${i}`);
      const bar = document.getElementById("ldrBar");
      const check = document.getElementById(`lcheck_${i}`);
      const conn = document.getElementById(`lconn_${i}`);
      const phase = document.getElementById("ldrPhaseLabel");

      if (el) el.className = "ldr-step active";
      if (bar) bar.style.width = `${Math.round(((i + 0.5) / steps.length) * 100)}%`;
      if (phase) phase.textContent = `Phase ${i + 1} / ${steps.length}`;

      await new Promise(r => setTimeout(r, STEP_MS));

      if (el) el.className = "ldr-step done";
      if (check) check.classList.add("show");
      if (conn) conn.classList.add("lit");
      if (bar) bar.style.width = `${Math.round(((i + 1) / steps.length) * 100)}%`;

      if (i + 1 < steps.length) {
        const next = document.getElementById(`lstep_${i + 1}`);
        if (next) next.className = "ldr-step active";
      }
    }

    // Mark badge as complete
    const badge = document.querySelector(".ldr-badge");
    if (badge) {
      badge.textContent = "Complete";
      badge.style.color = "#22c55e";
      badge.style.borderColor = "rgba(34,197,94,0.25)";
      badge.style.background = "rgba(34,197,94,0.06)";
    }

    // ─────────────────────────────────────────────
    // API CALL
    // ─────────────────────────────────────────────
    const res = await apiRequest(`/tickets/search/${parentKey}`);

    if (!res || res.type === "error") {

      searchResult.innerHTML = `
        <div class="text-red-400 mono text-center py-6">
          ❌ ${res?.message || "Not found"}
        </div>
      `;

      clearBtn.classList.remove("hidden");
      return;
    }

    searchResult.innerHTML = "";

    const parent = res.parent;

    // ─────────────────────────────────────────────
    // CHILD DETECTION
    // ─────────────────────────────────────────────
    const child = res.children?.find(c =>
      (c.child_key || "").trim().toUpperCase() === input ||
      (c.issue_key || "").trim().toUpperCase() === input
    );

    if (child) {
      searchResult.appendChild(createChildView(child));
    }

    // ─────────────────────────────────────────────
    // PARENT FULL DASHBOARD CARD (UNCHANGED)
    // ─────────────────────────────────────────────
    const parentWrap = document.createElement("div");
    parentWrap.className = "mt-4 border-t border-purple/20 pt-4";

    const label = document.createElement("div");
    label.className = "mono text-xs text-muted mb-2";
    label.innerText = "🔗 Parent Ticket";

    parentWrap.appendChild(label);
    parentWrap.appendChild(createFullTicketCard(parent, 0));

    searchResult.appendChild(parentWrap);

    clearBtn.classList.remove("hidden");


    // ─────────────────────────────────────────────
    // AUTO REDIRECT TO DASHBOARD
    // ─────────────────────────────────────────────
    localStorage.setItem(
      "highlight_ticket",
      parent.issue_key
    );

    // optional redirect message
    const redirectMsg = document.createElement("div");

    redirectMsg.id = "redirectMsg";

    redirectMsg.className =
      "mono text-xs text-yellow text-center mt-4 animate-pulse";

    redirectMsg.innerText =
      "Redirecting to dashboard...";

    searchResult.appendChild(redirectMsg);


    // wait 2 sec then redirect
    setTimeout(() => {

      // remove redirect text
      document.getElementById(
        "redirectMsg"
      )?.remove();

      // open dashboard
      window.open(
        "tickets.html",
        "_blank"
      );

    }, 3000);

  } catch (err) {

    searchResult.innerHTML = `
      <div class="text-red-400 mono text-center py-6">
        ❌ Search failed
      </div>
    `;
  }
}



// ─────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────
// only button click triggers search
searchBtn?.addEventListener("click", filterTickets);

// optional: keep Enter also working (recommended UX)
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") filterTickets();
});

clearBtn?.addEventListener("click", () => {
  searchInput.value = "";
  searchResult.innerHTML = "";
  clearBtn.classList.add("hidden");
});

window.openChildTickets = openChildTickets;
window.deleteTicket = deleteTicket;
window.updateStatus = updateStatus;
window.executeMerge = executeMerge;