// settings.js
import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { openMediaPicker } from "./media-picker.js";
import { db } from "../../public/js/firebase-init.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let socialLinks = [];
let logoUrl = "";
let trustBadgeUrl = "";
let trustBadgeAlt = "";

async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("settings", admin);

  const snap = await getDoc(doc(db, "settings", "site"));
  const data = snap.exists() ? snap.data() : {};

  document.getElementById("s-siteName").value = data.siteName || "Christine ten Kate";
  document.getElementById("s-logoText").value = data.logoText || "Christine <span>ten Kate</span>";
  document.getElementById("s-footerText").value = data.footerText || "";
  document.getElementById("s-address").value = data.address || "";
  document.getElementById("s-phone").value = data.phone || "";
  document.getElementById("s-mobilePhone").value = data.mobilePhone || "";
  document.getElementById("s-email").value = data.email || "";
  document.getElementById("s-kvk").value = data.kvk || "";
  socialLinks = data.socialLinks || [];
  logoUrl = data.logoUrl || "";
  trustBadgeUrl = data.trustBadgeUrl || "";
  trustBadgeAlt = data.trustBadgeAlt || "";

  renderLogoPreview();
  renderBadgePreview();
  document.getElementById("pick-logo-btn").addEventListener("click", async () => {
    const media = await openMediaPicker({ accept: "image" });
    if (media) { logoUrl = media.url; renderLogoPreview(); }
  });
  document.getElementById("pick-badge-btn").addEventListener("click", async () => {
    const media = await openMediaPicker({ accept: "image" });
    if (media) { trustBadgeUrl = media.url; trustBadgeAlt = media.alt || "Keurmerk"; renderBadgePreview(); }
  });

  renderSocialLinks();
  document.getElementById("add-social-btn").addEventListener("click", () => {
    socialLinks.push({ label: "Facebook", url: "" });
    renderSocialLinks();
  });
  document.getElementById("save-settings-btn").addEventListener("click", save);
}

function renderLogoPreview() {
  const wrap = document.getElementById("logo-preview-wrap");
  wrap.innerHTML = logoUrl ? `<img src="${logoUrl}" style="height:50px;margin-bottom:8px;">` : `<p style="font-size:var(--fs-sm);color:var(--color-ink-soft);">Nog geen logo gekozen — de logo-tekst wordt gebruikt.</p>`;
}

function renderBadgePreview() {
  const wrap = document.getElementById("badge-preview-wrap");
  wrap.innerHTML = trustBadgeUrl ? `<img src="${trustBadgeUrl}" style="height:70px;margin-bottom:8px;">` : `<p style="font-size:var(--fs-sm);color:var(--color-ink-soft);">Geen badge ingesteld.</p>`;
}

function renderSocialLinks() {
  const wrap = document.getElementById("social-links-list");
  wrap.innerHTML = "";
  socialLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
    row.innerHTML = `
      <input type="text" value="${link.label}" placeholder="Label (bijv. Facebook)" style="flex:1;padding:6px;border:1px solid var(--color-line);border-radius:4px;">
      <input type="text" value="${link.url}" placeholder="https://…" style="flex:2;padding:6px;border:1px solid var(--color-line);border-radius:4px;">
      <button type="button" class="btn-admin btn-admin--danger">✕</button>
    `;
    const [labelInput, urlInput] = row.querySelectorAll("input");
    labelInput.addEventListener("input", () => { link.label = labelInput.value; });
    urlInput.addEventListener("input", () => { link.url = urlInput.value; });
    row.querySelector("button").addEventListener("click", () => { socialLinks.splice(index, 1); renderSocialLinks(); });
    wrap.appendChild(row);
  });
}

async function save() {
  try {
    await setDoc(doc(db, "settings", "site"), {
      siteName: document.getElementById("s-siteName").value.trim(),
      logoText: document.getElementById("s-logoText").value.trim(),
      footerText: document.getElementById("s-footerText").value.trim(),
      address: document.getElementById("s-address").value.trim(),
      phone: document.getElementById("s-phone").value.trim(),
      mobilePhone: document.getElementById("s-mobilePhone").value.trim(),
      email: document.getElementById("s-email").value.trim(),
      kvk: document.getElementById("s-kvk").value.trim(),
      logoUrl,
      trustBadgeUrl,
      trustBadgeAlt,
      socialLinks,
    });
    showToast("Instellingen opgeslagen.");
  } catch (err) {
    console.error(err);
    showToast("Opslaan mislukt.", true);
  }
}

boot();
