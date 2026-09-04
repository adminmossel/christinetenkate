// rich-toolbar.js
// Bouwt een opmaak-werkbalk boven een "contenteditable" tekstveld. Gebruikt
// de ingebouwde browerfunctie document.execCommand(). Deze functie is
// formeel verouderd ("deprecated") maar wordt in 2026 nog altijd door alle
// gangbare browsers ondersteund voor precies dit soort eenvoudige
// teksteditors; het is de meest simpele en betrouwbare aanpak zonder een
// zware externe bibliotheek toe te voegen. Mocht een browser een functie
// ooit niet meer ondersteunen, dan blijft de rest van de werkbalk gewoon
// werken — het is geen alles-of-niets-afhankelijkheid.

import { openLinkPicker } from "./link-picker.js";
import { resolveLink } from "../../public/js/render.js";

const SPECIAL_CHARS = ["€", "©", "®", "™", "°", "§", "•", "…", "–", "—", "½", "¼", "¾", "→", "✓"];

function cmd(command, value = null) {
  document.execCommand(command, false, value);
}

function makeButton(label, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = title;
  btn.textContent = label;
  btn.addEventListener("mousedown", (e) => e.preventDefault()); // voorkomt verlies van tekstselectie
  btn.addEventListener("click", onClick);
  return btn;
}

function divider() {
  const d = document.createElement("span");
  d.className = "divider";
  return d;
}

/**
 * @param {HTMLElement} editable - het contenteditable element
 * @param {Function} onChange - aangeroepen na elke wijziging (html)
 * @returns {HTMLElement} de werkbalk, plaats deze vóór het editable element
 */
export function buildRichToolbar(editable, onChange) {
  const toolbar = document.createElement("div");
  toolbar.className = "rich-toolbar";

  const notifyChange = () => onChange(editable.innerHTML);

  // Kopniveaus / normale tekst
  const blockSelect = document.createElement("select");
  blockSelect.title = "Tekststijl";
  blockSelect.innerHTML = `
    <option value="P">Normale tekst</option>
    <option value="H1">Kop 1</option>
    <option value="H2">Kop 2</option>
    <option value="H3">Kop 3</option>
    <option value="H4">Kop 4</option>
    <option value="H5">Kop 5</option>
    <option value="H6">Kop 6</option>
    <option value="BLOCKQUOTE">Citaat</option>
  `;
  blockSelect.addEventListener("mousedown", () => editable.focus());
  blockSelect.addEventListener("change", () => { cmd("formatBlock", blockSelect.value); notifyChange(); });
  toolbar.appendChild(blockSelect);
  toolbar.appendChild(divider());

  // Vet, cursief, onderstrepen, doorhalen
  toolbar.appendChild(makeButton("B", "Vet", () => { cmd("bold"); notifyChange(); }));
  toolbar.appendChild(makeButton("I", "Cursief", () => { cmd("italic"); notifyChange(); }));
  toolbar.appendChild(makeButton("U", "Onderstrepen", () => { cmd("underline"); notifyChange(); }));
  toolbar.appendChild(makeButton("S", "Doorhalen", () => { cmd("strikeThrough"); notifyChange(); }));
  toolbar.appendChild(divider());

  // Tekstkleur en highlight
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.title = "Tekstkleur";
  colorInput.addEventListener("input", () => { cmd("foreColor", colorInput.value); notifyChange(); });
  toolbar.appendChild(colorInput);

  const highlightInput = document.createElement("input");
  highlightInput.type = "color";
  highlightInput.title = "Achtergrondkleur / highlight";
  highlightInput.value = "#fdf08a";
  highlightInput.addEventListener("input", () => { cmd("hiliteColor", highlightInput.value); notifyChange(); });
  toolbar.appendChild(highlightInput);

  // Lettergrootte
  const sizeSelect = document.createElement("select");
  sizeSelect.title = "Lettergrootte";
  sizeSelect.innerHTML = `
    <option value="2">Klein</option>
    <option value="3" selected>Normaal</option>
    <option value="4">Groter</option>
    <option value="5">Groot</option>
    <option value="6">Extra groot</option>
  `;
  sizeSelect.addEventListener("change", () => { cmd("fontSize", sizeSelect.value); notifyChange(); });
  toolbar.appendChild(sizeSelect);
  toolbar.appendChild(divider());

  // Uitlijning
  toolbar.appendChild(makeButton("≡L", "Links uitlijnen", () => { cmd("justifyLeft"); notifyChange(); }));
  toolbar.appendChild(makeButton("≡C", "Centreren", () => { cmd("justifyCenter"); notifyChange(); }));
  toolbar.appendChild(makeButton("≡R", "Rechts uitlijnen", () => { cmd("justifyRight"); notifyChange(); }));
  toolbar.appendChild(makeButton("≡J", "Uitvullen", () => { cmd("justifyFull"); notifyChange(); }));
  toolbar.appendChild(divider());

  // Lijsten en inspringen
  toolbar.appendChild(makeButton("• Lijst", "Ongenummerde lijst", () => { cmd("insertUnorderedList"); notifyChange(); }));
  toolbar.appendChild(makeButton("1. Lijst", "Genummerde lijst", () => { cmd("insertOrderedList"); notifyChange(); }));
  toolbar.appendChild(makeButton("⇥", "Inspringen", () => { cmd("indent"); notifyChange(); }));
  toolbar.appendChild(makeButton("⇤", "Inspringen verkleinen", () => { cmd("outdent"); notifyChange(); }));
  toolbar.appendChild(divider());

  // Super/subscript
  toolbar.appendChild(makeButton("x²", "Superscript", () => { cmd("superscript"); notifyChange(); }));
  toolbar.appendChild(makeButton("x₂", "Subscript", () => { cmd("subscript"); notifyChange(); }));
  toolbar.appendChild(divider());

  // Horizontale lijn
  toolbar.appendChild(makeButton("―", "Horizontale scheidingslijn", () => { cmd("insertHorizontalRule"); notifyChange(); }));

  // Link invoegen/verwijderen
  toolbar.appendChild(makeButton("🔗", "Link invoegen", async () => {
    const savedRange = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0) : null;
    const link = await openLinkPicker(null);
    if (link === undefined) return;
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    if (link === null) { cmd("unlink"); } else { cmd("createLink", resolveLink(link)); }
    notifyChange();
  }));
  toolbar.appendChild(makeButton("🔗✕", "Link verwijderen", () => { cmd("unlink"); notifyChange(); }));
  toolbar.appendChild(divider());

  // Speciale tekens
  const specialSelect = document.createElement("select");
  specialSelect.title = "Speciaal teken invoegen";
  specialSelect.innerHTML = `<option value="">Speciaal teken…</option>` + SPECIAL_CHARS.map((c) => `<option value="${c}">${c}</option>`).join("");
  specialSelect.addEventListener("mousedown", () => editable.focus());
  specialSelect.addEventListener("change", () => {
    if (specialSelect.value) { cmd("insertText", specialSelect.value); notifyChange(); }
    specialSelect.value = "";
  });
  toolbar.appendChild(specialSelect);
  toolbar.appendChild(divider());

  // Ongedaan maken / opnieuw
  toolbar.appendChild(makeButton("↶", "Ongedaan maken", () => { cmd("undo"); notifyChange(); }));
  toolbar.appendChild(makeButton("↷", "Opnieuw", () => { cmd("redo"); notifyChange(); }));

  editable.addEventListener("input", notifyChange);
  editable.addEventListener("paste", (e) => {
    // Plakken als platte tekst, zodat opmaak van bijv. Word niet de hele
    // pagina-stijl overhoop haalt. Oma kan achteraf alsnog opmaak toevoegen.
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  return toolbar;
}
