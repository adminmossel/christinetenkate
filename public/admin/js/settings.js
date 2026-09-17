// settings.js
import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { openMediaPicker } from "./media-picker.js";
import { db } from "../../js/firebase-init.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let socialLinks = [];
let logoUrl = "";
let trustBadgeUrl = "";
let trustBadgeAlt = "";
let colorHistory = [];
let currentSavedColors = null;

const DEFAULT_COLORS = { primary: "#2F4A3E", accent: "#E2963F", bg: "#FBF9F4" };
const MAX_COLOR_HISTORY = 8;

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

  const colors = { ...DEFAULT_COLORS, ...(data.colors || {}) };
  currentSavedColors = colors;
  colorHistory = data.colorHistory || [];
  document.getElementById("c-primary").value = colors.primary;
  document.getElementById("c-accent").value = colors.accent;
  document.getElementById("c-bg").value = colors.bg;
  renderColorHistory();
  document.getElementById("reset-colors-btn").addEventListener("click", async () => {
    document.getElementById("c-primary").value = DEFAULT_COLORS.primary;
    document.getElementById("c-accent").value = DEFAULT_COLORS.accent;
    document.getElementById("c-bg").value = DEFAULT_COLORS.bg;
    // Slaat meteen op — anders leek het net of het gereset was, terwijl de
    // oude kleur pas echt verdween na een aparte klik op "Opslaan".
    await save();
  });

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

function renderColorHistory() {
  const wrap = document.getElementById("color-history-list");
  if (!wrap) return;
  if (!colorHistory.length) {
    wrap.innerHTML = `<p style="font-size:var(--fs-sm);color:var(--color-ink-soft);">Nog geen eerdere kleurencombinaties.</p>`;
    return;
  }
  wrap.innerHTML = "";
  [...colorHistory].reverse().forEach((entry) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-line);";
    const date = entry.savedAt?.toDate ? entry.savedAt.toDate().toLocaleString("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    row.innerHTML = `
      <span style="display:flex;gap:3px;">
        <span style="width:18px;height:18px;border-radius:50%;background:${entry.primary};border:1px solid var(--color-line);"></span>
        <span style="width:18px;height:18px;border-radius:50%;background:${entry.accent};border:1px solid var(--color-line);"></span>
        <span style="width:18px;height:18px;border-radius:50%;background:${entry.bg};border:1px solid var(--color-line);"></span>
      </span>
      <span style="font-size:var(--fs-xs);color:var(--color-ink-soft);flex:1;">${date}</span>
    `;
    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "btn-admin";
    restoreBtn.textContent = "Herstel";
    restoreBtn.addEventListener("click", async () => {
      document.getElementById("c-primary").value = entry.primary;
      document.getElementById("c-accent").value = entry.accent;
      document.getElementById("c-bg").value = entry.bg;
      await save();
    });
    row.appendChild(restoreBtn);
    wrap.appendChild(row);
  });
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

/** Grove inschatting van helderheid (0 = zwart, 255 = wit) om te waarschuwen voor bijna-witte kleuren. */
function luminance(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

async function save() {
  const accent = document.getElementById("c-accent").value;
  const primary = document.getElementById("c-primary").value;
  const bg = document.getElementById("c-bg").value;
  const tooLight = [["Hoofdkleur", primary], ["Accentkleur", accent]].filter(([, hex]) => luminance(hex) > 235);
  if (tooLight.length && bg && luminance(bg) > 200) {
    const names = tooLight.map(([name]) => name).join(" en ");
    if (!confirm(`Let op: ${names} ${tooLight.length > 1 ? "zijn" : "is"} bijna wit — knoppen/tekst in die kleur worden dan onzichtbaar op de (ook lichte) achtergrond. Toch opslaan?`)) {
      return;
    }
  }
  try {
    const newColors = {
      primary: document.getElementById("c-primary").value,
      accent: document.getElementById("c-accent").value,
      bg: document.getElementById("c-bg").value,
    };
    // De net verlaten kleurencombinatie bewaren in de geschiedenis, zodat
    // je 'm later kunt terugzetten — maar alleen als er ook echt iets
    // veranderd is (anders zou elke losse "Opslaan" een nieuw punt geven).
    if (currentSavedColors && (
      currentSavedColors.primary !== newColors.primary ||
      currentSavedColors.accent !== newColors.accent ||
      currentSavedColors.bg !== newColors.bg
    )) {
      colorHistory = [...colorHistory, { ...currentSavedColors, savedAt: new Date() }].slice(-MAX_COLOR_HISTORY);
    }
    currentSavedColors = newColors;

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
      colors: newColors,
      colorHistory,
    });
    renderColorHistory();
    showToast("Instellingen opgeslagen.");
  } catch (err) {
    console.error(err);
    showToast("Opslaan mislukt.", true);
  }
}

boot();
