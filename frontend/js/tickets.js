let updatingTickets = new Set();


// ─────────────────────────────────────────────
// LOAD TICKETS
// ─────────────────────────────────────────────
async function loadTickets() {

  try {

    const res = await apiRequest("/tickets");

    const container =
      document.getElementById("ticketList");

    if (!container) return;

    container.innerHTML = "";

    const allTickets =
      Array.isArray(res) ? res :
        Array.isArray(res?.tickets) ? res.tickets :
          Array.isArray(res?.data) ? res.data : [];

    // ONLY PARENT TICKETS
    const tickets = allTickets.filter(
      t => !t.parent_ticket_key && !t.child_key
    );

    if (tickets.length === 0) {

      container.innerHTML = `
        <div class="mono text-center py-16 text-muted text-sm col-span-2">
          <div class="text-4xl mb-4">📭</div>
          <div>No tickets found</div>
        </div>
      `;

      return;
    }

    tickets.forEach((t, idx) => {

      const isUpdating =
        updatingTickets.has(t.issue_key);

      const isCompleted =
        t.status === "Completed" || isUpdating;

      const card = document.createElement("div");

      card.className =
        "animate-slideUp bg-surface border border-purple/15 rounded-2xl overflow-hidden shadow-lg hover:border-purple/30 transition-all duration-200";

      card.style.animationDelay =
        `${idx * 0.05}s`;

      card.id = `ticket-${t.issue_key}`;

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


        <!-- ESCALATION -->
        ${!isCompleted ? (() => {

          const esc =
            localStorage.getItem(
              `esc_${t.issue_key}`
            );

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
            <div class="escalation-label px-4 py-2 border-b border-purple/10 bg-blue-900/10 rounded-b-lg flex items-center gap-2">

              <span class="mono text-[0.65rem] text-white/90 bg-blue-700/30 px-2 py-0.5 rounded-full">
                🚀 Escalated to (${esc})
              </span>

            </div>
          `;

        })() : ''}


        <!-- BODY -->
        <div class="px-4 py-3 space-y-2 text-sm">

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


          <div>
            <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block mb-0.5">
              Summary
            </span>

            <span class="text-slate-200 text-xs">
              ${t.summary || "-"}
            </span>
          </div>


          <div>
            <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block mb-0.5">
              Description
            </span>

            <span class="text-slate-300 text-xs leading-relaxed line-clamp-2">
              ${t.description || "-"}
            </span>
          </div>


          ${!isCompleted ? `
            <div class="flex items-center gap-2 pt-1">

              <span class="mono text-[0.6rem] text-muted uppercase tracking-widest">
                Update Status
              </span>

              <select onchange="updateStatus('${t.issue_key}', this)">
                <option value="Open" selected>
                  Open
                </option>

                <option value="Completed">
                  Completed
                </option>
              </select>

            </div>
          ` : ''}

        </div>


        <!-- ACTIONS -->
        <div class="px-4 py-3 border-t border-purple/10 flex items-center gap-2">

          <button
            class="flex-1 bg-purple/15 hover:bg-purple/25 border border-purple/20 text-purple text-[0.65rem] font-bold py-2 px-3 rounded-xl mono transition-all duration-200 hover:scale-[1.02]"
            onclick="window.open('runbooks.html?id=${t.issue_key}', '_blank')"
          >
            ⚙ Runbook
          </button>

          <button
            class="flex-1 bg-surface2 hover:bg-white/5 border border-purple/15 text-slate-300 text-[0.65rem] font-bold py-2 px-3 rounded-xl mono transition-all duration-200 hover:scale-[1.02]"
            onclick="openChildTickets('${t.issue_key}')"
          >
            👥 Child
          </button>

          <button
  class="flex-1 bg-yellow/10 hover:bg-yellow/20 border border-yellow/20 text-yellow text-[0.65rem] font-bold py-2 px-3 rounded-xl mono transition-all"
  onclick="openMergeModal('${t.issue_key}')"
>
  🔀 Merge
</button>

          <button
            class="bg-red/10 hover:bg-red/20 border border-red/20 text-red text-[0.65rem] font-bold py-2 px-3 rounded-xl mono transition-all duration-200 hover:scale-[1.02]"
            onclick="deleteTicket('${t.issue_key}')"
          >
            🗑
          </button>

        </div>
      `;

      container.appendChild(card);
      // ─────────────────────────────────────────────
      // HIGHLIGHT SEARCHED TICKET
      // ─────────────────────────────────────────────
      const highlightTicket =
  localStorage.getItem(
    "highlight_ticket"
  );

if (
  highlightTicket &&
  highlightTicket === t.issue_key
) {

  // wait slightly so full DOM renders
  setTimeout(() => {

    // smooth auto scroll
    card.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    // add highlight after scroll starts
    setTimeout(() => {

      card.classList.add(
        "ring-4",
        "ring-yellow-400",
        "scale-[1.02]",
        "transition-all",
        "duration-300"
      );

    }, 400);

  }, 300);

  // remove highlight after 3 sec
  setTimeout(() => {

    card.classList.remove(
      "ring-4",
      "ring-yellow-400",
      "scale-[1.02]"
    );

    localStorage.removeItem(
      "highlight_ticket"
    );

  }, 3000);
}

    });

  } catch (err) {

    console.error(
      "❌ Load tickets failed:",
      err
    );
  }
}


// ─────────────────────────────────────────────
// UPDATE STATUS
// ─────────────────────────────────────────────
async function updateStatus(issueKey, dropdown) {

  try {

    const selected = dropdown.value;

    if (selected !== "Completed") return;

    updatingTickets.add(issueKey);

    dropdown.disabled = true;

    const res = await apiRequest(
      `/tickets/${issueKey}/complete`,
      "PUT"
    );

    if (res?.error) {

      console.error(
        "❌ Status update failed:",
        res.message
      );

      updatingTickets.delete(issueKey);

      loadTickets();

      return;
    }

    localStorage.removeItem(
      `esc_${issueKey}`
    );

    setTimeout(() => {

      updatingTickets.delete(issueKey);

      loadTickets();

    }, 500);

  } catch (err) {

    console.error(
      "❌ updateStatus error:",
      err
    );

    updatingTickets.delete(issueKey);

    loadTickets();
  }
}



async function detachChildTicket(issueKey) {

  try {

    const res = await apiRequest(
      `/tickets/${issueKey}/detach`,
      "PUT"
    );

    if (res?.error) {
      console.error("Detach failed:", res.message);
      return;
    }

    // refresh modal + dashboard
    closeChildModal();
    loadTickets();

  } catch (err) {
    console.error("Detach error:", err);
  }
}

// ─────────────────────────────────────────────
// CHILD MODAL
// ─────────────────────────────────────────────
async function openChildTickets(parentKey) {

  try {

    const res = await apiRequest("/tickets");

    const allTickets =
      Array.isArray(res) ? res :
        Array.isArray(res?.tickets) ? res.tickets :
          Array.isArray(res?.data) ? res.data : [];

    const children = allTickets.filter(
      t => t.parent_ticket_key === parentKey
    );

    const old =
      document.getElementById("childModal");

    if (old) old.remove();

    const modal =
      document.createElement("div");

    modal.id = "childModal";

    modal.className =
      "fixed inset-0 bg-black/70 modal-backdrop flex items-center justify-center z-50";

    modal.onclick = (e) => {
      if (e.target === modal)
        closeChildModal();
    };

    modal.innerHTML = `
      <div class="bg-surface border border-purple/15 rounded-2xl w-[620px] max-h-[80vh] overflow-auto relative shadow-2xl animate-slideUp">

        <div class="flex items-center justify-between px-6 py-4 bg-surface2 border-b border-purple/15 sticky top-0">

          <div>
            <h2 class="font-bold text-purple">
              Child Tickets
            </h2>

            <p class="mono text-muted text-xs mt-0.5">
              Parent: ${parentKey}
            </p>
          </div>

          <button
            class="mono text-muted hover:text-slate-200 text-lg transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
            onclick="closeChildModal()"
          >
            ✕
          </button>

        </div>

        <div class="p-6 space-y-4">

          ${children.length === 0

        ? `
              <div class="mono text-center py-8 text-muted text-sm">
                <div class="text-3xl mb-3">📭</div>
                <div>No child tickets found</div>
              </div>
            `

        : children.map(c => `

              <div class="bg-surface2 border border-purple/10 rounded-xl p-4 space-y-2">

                <div class="flex items-center justify-between">

                  <div class="flex items-center gap-2">

                    <span class="mono text-yellow text-xs font-bold">
                      ${c.issue_key}
                    </span>

                    ${c.child_key ? `
                      <span class="mono text-[0.6rem] px-2 py-0.5 rounded-full bg-yellow/10 border border-yellow/20 text-yellow">
                        ${c.child_key}
                      </span>
                    ` : ""}

                  </div>

                  <span class="mono text-xs px-2.5 py-0.5 rounded-full border ${c.status === "Completed"
            ? 'text-green border-green/20 bg-green/5'
            : 'text-yellow border-yellow/20 bg-yellow/5'
          }">

                    ${c.status === "Completed"
            ? "✔ Completed"
            : "● Open"}

                  </span>

                </div>

                <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">

                  <div>
                    <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block">
                      Name
                    </span>

                    <span>${c.name || "-"}</span>
                  </div>

                  <div>
                    <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block">
                      Email
                    </span>

                    <span>${c.email || "-"}</span>
                  </div>

                  <div class="col-span-2">
                    <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block">
                      Summary
                    </span>

                    <span>${c.summary || "-"}</span>
                  </div>

                  <div class="col-span-2">
                    <span class="mono text-[0.6rem] text-muted uppercase tracking-widest block">
                      Description
                    </span>

                    <span class="text-slate-300 leading-relaxed">
                      ${c.description || "-"}
                    </span>
                  </div>

                </div>
                <div class="pt-2 flex justify-end">

  <button
    class="bg-green-500/10 hover:bg-green-500/20 border border-green-400/20 text-green-300 text-[0.65rem] font-bold py-1.5 px-3 rounded-lg mono transition-all"
    onclick="detachChildTicket('${c.issue_key}')"
  >
    ➕ Create New Ticket
  </button>

</div>

              </div>

            `).join("")
      }

        </div>

      </div>
    `;

    document.body.appendChild(modal);

  } catch (err) {

    console.error(
      "❌ openChildTickets failed:",
      err
    );
  }
}


// ─────────────────────────────────────────────
// CLOSE CHILD MODAL
// ─────────────────────────────────────────────
function closeChildModal() {

  const modal =
    document.getElementById("childModal");

  if (modal) modal.remove();
}


// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────
async function deleteTicket(id) {

  try {

    if (!id) return;

    const res = await apiRequest(
      `/tickets/${id}`,
      "DELETE"
    );

    if (res?.error) {

      console.error(
        "❌ Delete failed:",
        res.message
      );

      return;
    }

    loadTickets();

  } catch (err) {

    console.error(
      "❌ Delete error:",
      err
    );
  }
}

let mergeTarget = null;
let mergeSources = new Set();



async function openMergeModal(targetKey) {

  mergeTarget = targetKey;

  const res = await apiRequest("/tickets");

  const allTickets =
    Array.isArray(res) ? res :
      Array.isArray(res?.tickets) ? res.tickets :
        Array.isArray(res?.data) ? res.data : [];

  const parents = allTickets.filter(t =>
    !t.parent_ticket_key &&
    !t.child_key &&
    t.issue_key !== targetKey
  );

  const old = document.getElementById("mergeModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "mergeModal";
  modal.className =
    "fixed inset-0 bg-black/70 flex items-center justify-center z-50";

  modal.innerHTML = `
    <div class="bg-surface border border-purple/15 rounded-2xl w-[520px] p-6 shadow-2xl">

      <h2 class="text-purple font-bold mb-2">
        Merge into ${targetKey}
      </h2>

      <p class="text-xs text-muted mb-5">
        Select ONE source ticket to merge
      </p>

      <!-- DROPDOWN -->
      <div class="mb-6">

        <label class="text-[0.65rem] text-muted uppercase tracking-widest block mb-2">
          Source Ticket
        </label>

        <select
          id="mergeSourceSelect"
          class="w-full bg-surface2 border border-purple/15 text-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple/40"
        >
          <option value="">
            -- Select source ticket --
          </option>

          ${parents.map(p => `
            <option value="${p.issue_key}">
              ${p.issue_key} — ${p.summary || "No summary"}
            </option>
          `).join("")}

        </select>

      </div>

      <!-- BUTTONS -->
      <div class="flex gap-2">

        <button
          onclick="closeMergeModal()"
          class="flex-1 bg-surface2 py-2 rounded-xl text-sm"
        >
          Cancel
        </button>

        <button
          onclick="executeMergeFinal()"
          class="flex-1 bg-purple/20 text-purple py-2 rounded-xl text-sm font-bold"
        >
          Merge
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);
}

function toggleSource(key, checkbox) {
  if (checkbox.checked) {
    mergeSources.add(key);
  } else {
    mergeSources.delete(key);
  }
}

async function executeMergeFinal() {

  const source = document.getElementById("mergeSourceSelect")?.value;

  if (!mergeTarget) {
    alert("No target selected");
    return;
  }

  if (!source) {
    alert("Select a source ticket");
    return;
  }

  try {

    const res = await apiRequest("/tickets/merge", "POST", {
      target_parent_key: mergeTarget,
      source_parent_keys: [source]   // still array for backend compatibility
    });

    console.log("Merge result:", res);

    mergeTarget = null;

    closeMergeModal();
    loadTickets();

  } catch (err) {
    console.error("Merge failed:", err);
  }
}

function closeMergeModal() {
  document.getElementById("mergeModal")?.remove();
}


window.openChildTickets = openChildTickets;
window.deleteTicket = deleteTicket;
window.updateStatus = updateStatus;
window.executeMerge = executeMergeFinal;
window.detachChildTicket = detachChildTicket;


// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener(
  "DOMContentLoaded",
  loadTickets
);