// editor-blocks.js
// Voor elk bloktype: (1) een fabrieksfunctie die een leeg blok aanmaakt, en
// (2) een functie die de bewerk-UI voor dat blok bouwt. `patch(fields)`
// past het blok direct aan (het blok-object wordt bijgewerkt "by reference"
// zodat de rest van de editor niet opnieuw hoeft te renderen bij elke
// toetsaanslag) en plant een autosave in.

import { buildRichToolbar } from "./rich-toolbar.js";
import { openMediaPicker, fetchMediaMap } from "./media-picker.js";
import { openLinkPicker } from "./link-picker.js";

let blockIdCounter = 0;
function newId() { return `b${Date.now()}${blockIdCounter++}`; }

export const BLOCK_LIBRARY = {
  text: { label: "Tekst", group: "Inhoud", factory: () => ({ id: newId(), type: "text", html: "<p>Nieuwe tekst…</p>", align: "left" }) },
  heading: { label: "Titel / kop", group: "Inhoud", factory: () => ({ id: newId(), type: "heading", level: 2, text: "Nieuwe titel", align: "left" }) },
  quote: { label: "Quote", group: "Inhoud", factory: () => ({ id: newId(), type: "quote", text: "Een mooi citaat…", cite: "" }) },
  image: { label: "Afbeelding", group: "Media", factory: () => ({ id: newId(), type: "image", mediaId: null, alt: "", caption: "", align: "center", widthPercent: 100 }) },
  gallery: { label: "Galerij", group: "Media", factory: () => ({ id: newId(), type: "gallery", images: [] }) },
  file: { label: "Bestand / download", group: "Media", factory: () => ({ id: newId(), type: "file", mediaId: null, label: "Bekijk het document" }) },
  embed: { label: "Video / embed", group: "Media", factory: () => ({ id: newId(), type: "embed", url: "", title: "" }) },
  button: { label: "Knop", group: "Interactie", factory: () => ({ id: newId(), type: "button", text: "Klik hier", link: null, align: "left", style: "solid" }) },
  "contact-form": { label: "Contactformulier", group: "Interactie", factory: () => ({ id: newId(), type: "contact-form", buttonText: "Versturen" }) },
  faq: { label: "Vraag & antwoord (FAQ)", group: "Interactie", factory: () => ({ id: newId(), type: "faq", items: [{ question: "Een veelgestelde vraag?", answer: "Het antwoord hierop." }] }) },
  columns: { label: "Kolommen", group: "Layout", factory: () => ({ id: newId(), type: "columns", columns: 2, items: [[], []] }) },
  divider: { label: "Scheidingslijn", group: "Layout", factory: () => ({ id: newId(), type: "divider" }) },
  spacer: { label: "Ruimte", group: "Layout", factory: () => ({ id: newId(), type: "spacer", height: 40 }) },
};

// Alleen op de homepage bruikbaar (niet in het "+ Blok"-menu op gewone pagina's).
export const HOME_ONLY_BLOCKS = {
  hero: { label: "Hero (bovenaan homepage)", group: "Homepage", factory: () => ({ id: newId(), type: "hero", eyebrow: "", title: "Welkom", lead: "", imageMediaId: null, imageAlt: "", buttonText: "", buttonLink: null }) },
  tiles: { label: "Tegels (samenvattingskaarten)", group: "Homepage", factory: () => ({ id: newId(), type: "tiles", items: [{ title: "Titel", text: "Korte omschrijving.", link: null }] }) },
};

function field(labelText, inputEl) {
  const wrap = document.createElement("div");
  wrap.className = "admin-field";
  const label = document.createElement("label");
  label.textContent = labelText;
  wrap.appendChild(label);
  wrap.appendChild(inputEl);
  return wrap;
}

function textInput(value, onInput, placeholder = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.placeholder = placeholder;
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function selectInput(value, options, onChange) {
  const select = document.createElement("select");
  select.innerHTML = options.map((o) => `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("");
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function linkButton(currentLink, onSet) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-admin";
  const label = (link) => {
    if (!link || !link.value) return "Link instellen";
    return link.type === "file" ? "Link: bestand ingesteld" : `Link: ${link.value}`;
  };
  btn.textContent = label(currentLink);
  btn.addEventListener("click", async () => {
    const link = await openLinkPicker(currentLink);
    if (link !== undefined) {
      onSet(link);
      currentLink = link;
      btn.textContent = label(link);
    }
  });
  return btn;
}

/**
 * Toont een voorbeeld van de huidige afbeelding (opgezocht via mediaId) en
 * een knop om een andere te kiezen/uploaden. `onPick` krijgt het volledige
 * media-object (met `.id`) — de aanroeper slaat daarvan alleen `.id` op
 * (als `mediaId`), nooit de foto-data zelf.
 */
function imagePreviewAndPicker(mediaId, onPick) {
  const wrap = document.createElement("div");
  const trigger = document.createElement("div");
  trigger.className = "media-picker-trigger";

  function draw(url) {
    trigger.innerHTML = url
      ? `<img src="${url}" class="media-picker-preview">`
      : `<p>Klik om een afbeelding te kiezen of te uploaden</p>`;
  }
  draw(null);
  if (mediaId) {
    fetchMediaMap([mediaId]).then((map) => { if (map[mediaId]) draw(map[mediaId].url); });
  }

  trigger.addEventListener("click", async () => {
    const media = await openMediaPicker({ accept: "image" });
    if (media) { draw(media.url); onPick(media); }
  });
  wrap.appendChild(trigger);
  return wrap;
}

// ---------- Individuele editors ----------

function editText(block, patch) {
  const wrap = document.createElement("div");
  const editable = document.createElement("div");
  editable.className = "rich-text-editable";
  editable.contentEditable = "true";
  editable.innerHTML = block.html || "";
  const toolbar = buildRichToolbar(editable, (html) => patch({ html }));
  wrap.appendChild(toolbar);
  wrap.appendChild(editable);
  return wrap;
}

function editHeading(block, patch) {
  const wrap = document.createElement("div");
  wrap.appendChild(field("Titeltekst", textInput(block.text, (v) => patch({ text: v }))));
  wrap.appendChild(field("Kopniveau", selectInput(String(block.level || 2), [1,2,3,4,5,6].map((n) => ({ value: String(n), label: `H${n}` })), (v) => patch({ level: Number(v) }))));
  wrap.appendChild(field("Uitlijning", selectInput(block.align || "left", [
    { value: "left", label: "Links" }, { value: "center", label: "Centreren" }, { value: "right", label: "Rechts" },
  ], (v) => patch({ align: v }))));
  return wrap;
}

function editQuote(block, patch) {
  const wrap = document.createElement("div");
  const ta = document.createElement("textarea");
  ta.rows = 3; ta.value = block.text || "";
  ta.addEventListener("input", () => patch({ text: ta.value }));
  wrap.appendChild(field("Citaat", ta));
  wrap.appendChild(field("Bron (optioneel)", textInput(block.cite, (v) => patch({ cite: v }), "bijv. naam van de spreker")));
  return wrap;
}


function editImage(block, patch) {
  const wrap = document.createElement("div");
  wrap.appendChild(imagePreviewAndPicker(block.mediaId, (media) => {
    patch({ mediaId: media.id, alt: block.alt || media.alt || "" });
  }));
  wrap.appendChild(field("Alt-tekst (voor screenreaders en SEO)", textInput(block.alt, (v) => patch({ alt: v }))));
  wrap.appendChild(field("Bijschrift (optioneel)", textInput(block.caption, (v) => patch({ caption: v }))));
  wrap.appendChild(field("Uitlijning", selectInput(block.align || "center", [
    { value: "left", label: "Links (tekst loopt eromheen)" },
    { value: "center", label: "Centreren" },
    { value: "right", label: "Rechts (tekst loopt eromheen)" },
  ], (v) => patch({ align: v }))));
  const widthInput = document.createElement("input");
  widthInput.type = "range"; widthInput.min = "20"; widthInput.max = "100"; widthInput.value = block.widthPercent || 100;
  widthInput.addEventListener("input", () => patch({ widthPercent: Number(widthInput.value) }));
  wrap.appendChild(field("Breedte (%)", widthInput));
  wrap.appendChild(linkButton(block.link, (link) => patch({ link })));
  return wrap;
}

function editGallery(block, patch) {
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(90px,1fr))";
  grid.style.gap = "6px";
  grid.style.marginBottom = "8px";

  // Lokale cache van mediaId -> url, alleen voor het tonen van
  // voorbeeldjes in de editor. Wordt niet opgeslagen — in Firestore staat
  // alleen { mediaId, alt } per afbeelding.
  const previewCache = {};

  function renderGrid() {
    grid.innerHTML = "";
    (block.images || []).forEach((img, idx) => {
      const cell = document.createElement("div");
      cell.style.position = "relative";
      const url = previewCache[img.mediaId];
      cell.innerHTML = url
        ? `<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;">`
        : `<div style="width:100%;aspect-ratio:1;background:var(--color-bg-soft);border-radius:4px;"></div>`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.style.cssText = "position:absolute;top:2px;right:2px;background:#B3432B;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;";
      removeBtn.addEventListener("click", () => {
        block.images.splice(idx, 1);
        patch({ images: block.images });
        renderGrid();
      });
      cell.appendChild(removeBtn);
      grid.appendChild(cell);
    });
  }

  const existingIds = (block.images || []).map((i) => i.mediaId).filter(Boolean);
  if (existingIds.length) {
    fetchMediaMap(existingIds).then((map) => {
      Object.entries(map).forEach(([id, media]) => { previewCache[id] = media.url; });
      renderGrid();
    });
  }
  renderGrid();

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-admin";
  addBtn.textContent = "+ Afbeelding toevoegen";
  addBtn.addEventListener("click", async () => {
    const media = await openMediaPicker({ accept: "image" });
    if (media) {
      previewCache[media.id] = media.url;
      block.images = block.images || [];
      block.images.push({ mediaId: media.id, alt: media.alt || "" });
      patch({ images: block.images });
      renderGrid();
    }
  });

  wrap.appendChild(grid);
  wrap.appendChild(addBtn);
  return wrap;
}

function editFile(block, patch) {
  const wrap = document.createElement("div");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "btn-admin";
  trigger.textContent = "Kies bestand uit mediabibliotheek";
  if (block.mediaId) {
    fetchMediaMap([block.mediaId]).then((map) => {
      if (map[block.mediaId]) trigger.textContent = `Bestand: ${map[block.mediaId].name}`;
    });
  }
  trigger.addEventListener("click", async () => {
    const media = await openMediaPicker({ accept: "any" });
    if (media) {
      patch({ mediaId: media.id });
      trigger.textContent = `Bestand: ${media.name}`;
    }
  });
  wrap.appendChild(field("Bestand", trigger));
  wrap.appendChild(field("Knoptekst", textInput(block.label, (v) => patch({ label: v }), "Bekijk het document")));
  return wrap;
}

function editEmbed(block, patch) {
  const wrap = document.createElement("div");
  wrap.appendChild(field("Embed-URL (bijv. YouTube 'insluiten'-link)", textInput(block.url, (v) => patch({ url: v }), "https://www.youtube.com/embed/…")));
  wrap.appendChild(field("Titel (voor toegankelijkheid)", textInput(block.title, (v) => patch({ title: v }))));
  const note = document.createElement("p");
  note.style.cssText = "font-size:var(--fs-sm);color:var(--color-ink-soft);";
  note.textContent = "Let op: gebruik de officiële 'insluiten'/'embed'-link van het platform (bijv. YouTube of Vimeo), geen willekeurige HTML-code — dat is veiliger.";
  wrap.appendChild(note);
  return wrap;
}

function editButton(block, patch) {
  const wrap = document.createElement("div");
  wrap.appendChild(field("Knoptekst", textInput(block.text, (v) => patch({ text: v }))));
  wrap.appendChild(field("Stijl", selectInput(block.style || "solid", [
    { value: "solid", label: "Gevuld" }, { value: "outline", label: "Omlijnd" },
  ], (v) => patch({ style: v }))));
  wrap.appendChild(field("Uitlijning", selectInput(block.align || "left", [
    { value: "left", label: "Links" }, { value: "center", label: "Centreren" }, { value: "right", label: "Rechts" },
  ], (v) => patch({ align: v }))));
  wrap.appendChild(linkButton(block.link, (link) => patch({ link })));
  return wrap;
}

function editContactForm(block, patch) {
  const wrap = document.createElement("div");
  wrap.appendChild(field("Knoptekst", textInput(block.buttonText, (v) => patch({ buttonText: v }))));
  const note = document.createElement("p");
  note.style.cssText = "font-size:var(--fs-sm);color:var(--color-ink-soft);";
  note.textContent = "Verstuurde berichten zijn te lezen onder 'Berichten' in het menu links.";
  wrap.appendChild(note);
  return wrap;
}

function editFaq(block, patch) {
  const wrap = document.createElement("div");
  const list = document.createElement("div");

  function renderList() {
    list.innerHTML = "";
    (block.items || []).forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "column-editor";
      row.style.marginBottom = "8px";
      const q = textInput(item.question, (v) => { item.question = v; patch({ items: block.items }); }, "Vraag");
      const a = document.createElement("textarea");
      a.rows = 2; a.value = item.answer || "";
      a.addEventListener("input", () => { item.answer = a.value; patch({ items: block.items }); });
      const removeBtn = document.createElement("button");
      removeBtn.type = "button"; removeBtn.className = "btn-admin btn-admin--danger";
      removeBtn.textContent = "Vraag verwijderen"; removeBtn.style.marginTop = "6px";
      removeBtn.addEventListener("click", () => { block.items.splice(idx, 1); patch({ items: block.items }); renderList(); });
      row.appendChild(field("Vraag", q));
      row.appendChild(field("Antwoord", a));
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }
  renderList();

  const addBtn = document.createElement("button");
  addBtn.type = "button"; addBtn.className = "btn-admin"; addBtn.textContent = "+ Vraag toevoegen";
  addBtn.addEventListener("click", () => {
    block.items = block.items || [];
    block.items.push({ question: "Nieuwe vraag?", answer: "" });
    patch({ items: block.items });
    renderList();
  });

  wrap.appendChild(list);
  wrap.appendChild(addBtn);
  return wrap;
}

function editColumns(block, patch, renderNestedBlocks) {
  const wrap = document.createElement("div");
  wrap.appendChild(field("Aantal kolommen", selectInput(String(block.columns || 2), [
    { value: "2", label: "2 kolommen" }, { value: "3", label: "3 kolommen" },
  ], (v) => {
    const n = Number(v);
    const items = block.items || [];
    while (items.length < n) items.push([]);
    patch({ columns: n, items: items.slice(0, n) });
    renderTabs();
  })));

  const tabs = document.createElement("div");
  tabs.className = "column-tabs";
  const body = document.createElement("div");
  body.className = "column-editor";
  let activeCol = 0;

  function renderTabs() {
    tabs.innerHTML = "";
    for (let i = 0; i < (block.columns || 2); i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `Kolom ${i + 1}`;
      btn.className = i === activeCol ? "is-active" : "";
      btn.addEventListener("click", () => { activeCol = i; renderTabs(); renderBody(); });
      tabs.appendChild(btn);
    }
  }
  function renderBody() {
    body.innerHTML = "";
    block.items = block.items || [];
    if (!block.items[activeCol]) block.items[activeCol] = [];
    renderNestedBlocks(body, block.items[activeCol], (updated) => { block.items[activeCol] = updated; patch({ items: block.items }); });
  }
  renderTabs();
  renderBody();

  wrap.appendChild(tabs);
  wrap.appendChild(body);
  return wrap;
}

function editSpacer(block, patch) {
  const wrap = document.createElement("div");
  const range = document.createElement("input");
  range.type = "range"; range.min = "10"; range.max = "200"; range.value = block.height || 40;
  range.addEventListener("input", () => patch({ height: Number(range.value) }));
  wrap.appendChild(field(`Hoogte: ${block.height || 40}px`, range));
  range.addEventListener("input", () => { wrap.querySelector("label").textContent = `Hoogte: ${range.value}px`; });
  return wrap;
}

function editHero(block, patch) {
  const wrap = document.createElement("div");
  wrap.appendChild(field("Kleine tekst boven de titel (optioneel)", textInput(block.eyebrow, (v) => patch({ eyebrow: v }))));
  wrap.appendChild(field("Titel", textInput(block.title, (v) => patch({ title: v }))));
  const lead = document.createElement("textarea");
  lead.rows = 3; lead.value = block.lead || "";
  lead.addEventListener("input", () => patch({ lead: lead.value }));
  wrap.appendChild(field("Introductietekst", lead));
  wrap.appendChild(imagePreviewAndPicker(block.imageMediaId, (media) => { patch({ imageMediaId: media.id, imageAlt: block.imageAlt || media.alt || "" }); }));
  wrap.appendChild(field("Alt-tekst afbeelding", textInput(block.imageAlt, (v) => patch({ imageAlt: v }))));
  wrap.appendChild(field("Knoptekst (optioneel)", textInput(block.buttonText, (v) => patch({ buttonText: v }))));
  wrap.appendChild(linkButton(block.buttonLink, (link) => patch({ buttonLink: link })));
  return wrap;
}

function editTiles(block, patch) {
  const wrap = document.createElement("div");
  const list = document.createElement("div");

  function renderList() {
    list.innerHTML = "";
    (block.items || []).forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "column-editor";
      row.style.marginBottom = "8px";
      row.appendChild(field("Titel", textInput(item.title, (v) => { item.title = v; patch({ items: block.items }); })));
      const text = document.createElement("textarea");
      text.rows = 2; text.value = item.text || "";
      text.addEventListener("input", () => { item.text = text.value; patch({ items: block.items }); });
      row.appendChild(field("Tekst", text));
      row.appendChild(linkButton(item.link, (link) => { item.link = link; patch({ items: block.items }); }));
      const removeBtn = document.createElement("button");
      removeBtn.type = "button"; removeBtn.className = "btn-admin btn-admin--danger";
      removeBtn.textContent = "Tegel verwijderen"; removeBtn.style.marginTop = "6px";
      removeBtn.addEventListener("click", () => { block.items.splice(idx, 1); patch({ items: block.items }); renderList(); });
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }
  renderList();

  const addBtn = document.createElement("button");
  addBtn.type = "button"; addBtn.className = "btn-admin"; addBtn.textContent = "+ Tegel toevoegen";
  addBtn.addEventListener("click", () => {
    block.items = block.items || [];
    block.items.push({ title: "Titel", text: "Omschrijving", link: null });
    patch({ items: block.items });
    renderList();
  });

  wrap.appendChild(list);
  wrap.appendChild(addBtn);
  return wrap;
}

const EDITORS = {
  text: editText,
  heading: editHeading,
  quote: editQuote,
  image: editImage,
  gallery: editGallery,
  file: editFile,
  embed: editEmbed,
  button: editButton,
  "contact-form": editContactForm,
  faq: editFaq,
  columns: editColumns,
  divider: () => { const p = document.createElement("p"); p.style.color = "var(--color-ink-soft)"; p.style.fontSize = "var(--fs-sm)"; p.textContent = "Een dunne scheidingslijn — geen instellingen nodig."; return p; },
  spacer: editSpacer,
  hero: editHero,
  tiles: editTiles,
};

export function buildBlockEditorUI(block, patch, renderNestedBlocks) {
  const builder = EDITORS[block.type];
  if (!builder) {
    const p = document.createElement("p");
    p.textContent = `Onbekend bloktype: ${block.type}`;
    return p;
  }
  return builder(block, patch, renderNestedBlocks);
}

export function allBlockTypeLabel(type) {
  return BLOCK_LIBRARY[type]?.label || HOME_ONLY_BLOCKS[type]?.label || type;
}
