// messages.js
import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { db } from "../../js/firebase-init.js";
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("messages", admin);
  await loadMessages();
}

async function loadMessages() {
  const list = document.getElementById("messages-list");
  try {
    const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = "<p>Nog geen berichten ontvangen.</p>"; return; }

    list.innerHTML = "";
    snap.docs.forEach((d) => {
      const m = d.data();
      const row = document.createElement("div");
      row.style.cssText = "border-bottom:1px solid var(--color-line);padding:12px 0;";
      const date = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString("nl-NL") : "";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <strong>${m.name} ${m.read ? "" : "<span class=\"status-pill status-pill--draft\">nieuw</span>"}</strong>
          <span style="font-size:var(--fs-sm);color:var(--color-ink-soft);">${date}</span>
        </div>
        <p style="margin:6px 0;"><a href="mailto:${m.email}">${m.email}</a> — verstuurd via pagina <code>${m.page || "?"}</code></p>
        <p>${(m.message || "").replace(/</g, "&lt;")}</p>
        <div style="display:flex;gap:8px;">
          <button class="btn-admin" data-read>${m.read ? "Markeer als ongelezen" : "Markeer als gelezen"}</button>
          <button class="btn-admin btn-admin--danger" data-delete>Verwijderen</button>
        </div>
      `;
      row.querySelector("[data-read]").addEventListener("click", async () => {
        await updateDoc(doc(db, "submissions", d.id), { read: !m.read });
        loadMessages();
      });
      row.querySelector("[data-delete]").addEventListener("click", async () => {
        if (!confirm("Dit bericht verwijderen?")) return;
        await deleteDoc(doc(db, "submissions", d.id));
        showToast("Bericht verwijderd.");
        loadMessages();
      });
      list.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p>Kon berichten niet laden.</p>";
  }
}

boot();
