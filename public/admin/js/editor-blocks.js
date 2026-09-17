// editor-blocks.js
// Voor elk bloktype: (1) een fabrieksfunctie die een leeg blok aanmaakt, en
// (2) een functie die de bewerk-UI voor dat blok bouwt. `patch(fields)`
// past het blok direct aan (het blok-object wordt bijgewerkt "by reference"
// zodat de rest van de editor niet opnieuw hoeft te renderen bij elke
// toetsaanslag) en plant een autosave in.

import { buildRichToolbar } from "./rich-toolbar.js";
import { openMediaPicker, fetchMediaMap, openCropTool } from "./media-picker.js";
import { openLinkPicker } from "./link-picker.js";
import { renderBlocks, collectMediaIds } from "../../js/render.js";

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
  columns: { label: "Kolommen", group: "Layout", factory: () => ({ id: newId(), type: "columns", columns: 2, items: [{ blocks: [] }, { blocks: [] }] }) },
  divider: { label: "Scheidingslijn", group: "Layout", factory: () => ({ id: newId(), type: "divider" }) },
  spacer: { label: "Ruimte", group: "Layout", factory: () => ({ id: newId(), type: "spacer", height: 40 }) },
};

// Alleen op de homepage bruikbaar (niet in het "+ Blok"-menu op gewone pagina's).
export const HOME_ONLY_BLOCKS = {
  hero: { label: "Hero (bovenaan homepage)", group: "Homepage", factory: () => ({ id: newId(), type: "hero", eyebrow: "", title: "Welkom", lead: "", imageMediaId: null, imageAlt: "", buttonText: "", buttonLink: null }) },
  tiles: { label: "Tegels (samenvattingskaarten)", group: "Homepage", factory: () => ({ id: newId(), type: "tiles", items: [{ title: "Titel", text: "Korte omschrijving.", link: null }] }) },
};

function showCropSuccessHint(nearEl) {
  const hint = document.createElement("span");
  hint.textContent = " ✓ Bijgesneden";
  hint.style.cssText = "color:var(--color-success);font-size:var(--fs-sm);font-weight:600;margin-left:8px;animation:save-status-pop 260ms ease;";
  nearEl.insertAdjacentElement("afterend", hint);
  setTimeout(() => hint.remove(), 2200);
}

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

/**
 * Bouwt een live "zo ziet dit blok er straks uit"-voorbeeld, in de echte
 * kleuren/lettertypes van de website. `getSnapshot()` moet de actuele
 * blokdata teruggeven; roep `preview.refresh()` aan na elke wijziging.
 */
function livePreview(getSnapshot) {
  const wrap = document.createElement("div");
  wrap.className = "site-preview";
  const label = document.createElement("span");
  label.className = "site-preview-label";
  label.textContent = "Zo ziet dit eruit op de website";
  const target = document.createElement("div");
  wrap.appendChild(label);
  wrap.appendChild(target);

  let debounceTimer;
  async function renderNow() {
    const snapshot = getSnapshot();
    const mediaMap = await fetchMediaMap(collectMediaIds([snapshot]));
    renderBlocks([snapshot], target, mediaMap);
  }
  renderNow();

  return {
    el: wrap,
    refresh() { clearTimeout(debounceTimer); debounceTimer = setTimeout(renderNow, 300); },
  };
}

// ---------- Individuele editors ----------

function editText(block, patch) {
  const wrap = document.createElement("div");
  const editable = document.createElement("div");
  // "site-preview" hier direct op het tekstvak: bewerken IS het voorbeeld,
  // geen los, dubbel voorbeeldvakje nodig voor dit bloktype.
  editable.className = "rich-text-editable site-preview";
  editable.contentEditable = "true";
  editable.innerHTML = block.html || "";
  const toolbar = buildRichToolbar(editable, (html) => patch({ html }));
  wrap.appendChild(toolbar);
  wrap.appendChild(editable);
  return wrap;
}

function editHeading(block, patch) {
  const wrap = document.createElement("div");
  const level = Math.min(6, Math.max(1, block.level || 2));

  const headingWrap = document.createElement("div");
  headingWrap.className = "site-preview";
  const heading = document.createElement(`h${level}`);
  heading.contentEditable = "true";
  heading.style.margin = "0";
  heading.style.outline = "none";
  heading.style.textAlign = block.align || "left";
  heading.textContent = block.text || "";
  heading.addEventListener("input", () => patch({ text: heading.textContent }));
  heading.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  });
  headingWrap.appendChild(heading);
  wrap.appendChild(headingWrap);

  wrap.appendChild(field("Kopniveau", selectInput(String(level), [1,2,3,4,5,6].map((n) => ({ value: String(n), label: `H${n}` })), (v) => patch({ level: Number(v) }))));
  wrap.appendChild(field("Uitlijning", selectInput(block.align || "left", [
    { value: "left", label: "Links" }, { value: "center", label: "Centreren" }, { value: "right", label: "Rechts" },
  ], (v) => { heading.style.textAlign = v; patch({ align: v }); })));
  return wrap;
}

function editQuote(block, patch) {
  const wrap = document.createElement("div");
  const preview = livePreview(() => ({ ...block }));
  wrap.appendChild(preview.el);

  const ta = document.createElement("textarea");
  ta.rows = 3; ta.value = block.text || "";
  ta.addEventListener("input", () => { patch({ text: ta.value }); preview.refresh(); });
  wrap.appendChild(field("Citaat", ta));
  const citeInput = textInput(block.cite, (v) => { patch({ cite: v }); preview.refresh(); }, "bijv. naam van de spreker");
  wrap.appendChild(field("Bron (optioneel)", citeInput));
  return wrap;
}


function editImage(block, patch) {
  const wrap = document.createElement("div");
  const preview = livePreview(() => ({ ...block }));
  wrap.appendChild(preview.el);

  wrap.appendChild(imagePreviewAndPicker(block.mediaId, (media) => {
    patch({ mediaId: media.id, alt: block.alt || media.alt || "" });
    preview.refresh();
  }));

  const cropBtn = document.createElement("button");
  cropBtn.type = "button";
  cropBtn.className = "btn-admin";
  cropBtn.style.marginBottom = "12px";
  cropBtn.textContent = "✂ Bijsnijden";
  cropBtn.addEventListener("click", async () => {
    if (!block.mediaId) { alert("Kies eerst een afbeelding."); return; }
    const map = await fetchMediaMap([block.mediaId]);
    const current = map[block.mediaId];
    if (!current) return;
    const cropped = await openCropTool(current.url, current.name);
    if (cropped) {
      patch({ mediaId: cropped.id, alt: block.alt || "" });
      preview.refresh();
      showCropSuccessHint(cropBtn);
    }
  });
  wrap.appendChild(cropBtn);

  wrap.appendChild(field("Alt-tekst (voor screenreaders en SEO)", textInput(block.alt, (v) => { patch({ alt: v }); preview.refresh(); })));
  wrap.appendChild(field("Bijschrift (optioneel)", textInput(block.caption, (v) => { patch({ caption: v }); preview.refresh(); })));
  wrap.appendChild(field("Uitlijning", selectInput(block.align || "center", [
    { value: "left", label: "Links (tekst loopt eromheen)" },
    { value: "center", label: "Centreren" },
    { value: "right", label: "Rechts (tekst loopt eromheen)" },
  ], (v) => { patch({ align: v }); preview.refresh(); })));
  const widthLabel = document.createElement("label");
  widthLabel.textContent = `Breedte: ${block.widthPercent || 100}%`;
  const widthInput = document.createElement("input");
  widthInput.type = "range"; widthInput.min = "20"; widthInput.max = "100"; widthInput.value = block.widthPercent || 100;
  widthInput.addEventListener("input", () => {
    widthLabel.textContent = `Breedte: ${widthInput.value}%`;
    patch({ widthPercent: Number(widthInput.value) });
    preview.refresh();
  });
  const widthField = document.createElement("div");
  widthField.className = "admin-field";
  widthField.appendChild(widthLabel);
  widthField.appendChild(widthInput);
  wrap.appendChild(widthField);
  wrap.appendChild(linkButton(block.link, (link) => { patch({ link }); preview.refresh(); }));
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
  const preview = livePreview(() => ({ ...block }));
  wrap.appendChild(preview.el);

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
      preview.refresh();
    }
  });
  wrap.appendChild(field("Bestand", trigger));
  wrap.appendChild(field("Knoptekst", textInput(block.label, (v) => { patch({ label: v }); preview.refresh(); }, "Bekijk het document")));
  return wrap;
}

/** Zet een gewone YouTube/Vimeo-kijklink automatisch om naar de vereiste embed-URL. */
function normalizeEmbedUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.replace("/", "")}`;
    }
    if (u.hostname.includes("vimeo.com") && !u.pathname.includes("/video/") && !u.hostname.includes("player.")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return url; // nog geen geldige URL (bijv. tijdens het typen) — gewoon laten staan
  }
}

/**
 * Staat alleen echte, veilige webadressen toe (https/http). Voorkomt dat
 * iemand per ongeluk (of expres) een "javascript:"- of "data:"-adres in een
 * embed-blok zet, wat een beveiligingsrisico zou zijn.
 */
function isSafeEmbedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function editEmbed(block, patch) {
  const wrap = document.createElement("div");
  const preview = livePreview(() => ({ ...block }));
  wrap.appendChild(preview.el);

  const urlInput = textInput(block.url, (v) => {
    const normalized = normalizeEmbedUrl(v);
    if (v.trim() && !isSafeEmbedUrl(normalized)) {
      urlInput.style.borderColor = "var(--color-error)";
      note.textContent = "Dit lijkt geen geldig, veilig webadres (moet met https:// of http:// beginnen) — niet opgeslagen.";
      note.style.color = "var(--color-error)";
      return;
    }
    urlInput.style.borderColor = "";
    note.style.color = "var(--color-ink-soft)";
    note.textContent = "Een gewone YouTube- of Vimeo-link wordt automatisch omgezet naar de juiste insluit-vorm.";
    patch({ url: normalized });
    if (normalized !== v) urlInput.value = normalized; // laat direct zien dat 'ie is omgezet
    preview.refresh();
  }, "Plak hier gewoon een normale YouTube- of Vimeo-link");
  wrap.appendChild(field("Video-URL", urlInput));
  wrap.appendChild(field("Titel (voor toegankelijkheid)", textInput(block.title, (v) => { patch({ title: v }); preview.refresh(); })));
  const note = document.createElement("p");
  note.style.cssText = "font-size:var(--fs-sm);color:var(--color-ink-soft);";
  note.textContent = "Een gewone YouTube- of Vimeo-link wordt automatisch omgezet naar de juiste insluit-vorm.";
  wrap.appendChild(note);
  return wrap;
}

function editButton(block, patch) {
  const wrap = document.createElement("div");
  const preview = livePreview(() => ({ ...block }));
  wrap.appendChild(preview.el);

  wrap.appendChild(field("Knoptekst", textInput(block.text, (v) => { patch({ text: v }); preview.refresh(); })));
  wrap.appendChild(field("Stijl", selectInput(block.style || "solid", [
    { value: "solid", label: "Gevuld" }, { value: "outline", label: "Omlijnd" },
  ], (v) => { patch({ style: v }); preview.refresh(); })));
  wrap.appendChild(field("Uitlijning", selectInput(block.align || "left", [
    { value: "left", label: "Links" }, { value: "center", label: "Centreren" }, { value: "right", label: "Rechts" },
  ], (v) => { patch({ align: v }); preview.refresh(); })));
  wrap.appendChild(linkButton(block.link, (link) => { patch({ link }); preview.refresh(); }));
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
    while (items.length < n) items.push({ blocks: [] });
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
    // Let op: Firestore ondersteunt geen "array binnen een array" — daarom
    // is elke kolom een object { blocks: [...] } in plaats van rechtstreeks
    // een array.
    if (!block.items[activeCol]) block.items[activeCol] = { blocks: [] };
    renderNestedBlocks(body, block.items[activeCol].blocks, (updated) => { block.items[activeCol].blocks = updated; patch({ items: block.items }); });
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
  const preview = livePreview(() => ({ ...block }));
  wrap.appendChild(preview.el);

  wrap.appendChild(field("Kleine tekst boven de titel (optioneel)", textInput(block.eyebrow, (v) => { patch({ eyebrow: v }); preview.refresh(); })));
  wrap.appendChild(field("Titel", textInput(block.title, (v) => { patch({ title: v }); preview.refresh(); })));
  const lead = document.createElement("textarea");
  lead.rows = 3; lead.value = block.lead || "";
  lead.addEventListener("input", () => { patch({ lead: lead.value }); preview.refresh(); });
  wrap.appendChild(field("Introductietekst", lead));
  wrap.appendChild(imagePreviewAndPicker(block.imageMediaId, (media) => { patch({ imageMediaId: media.id, imageAlt: block.imageAlt || media.alt || "" }); preview.refresh(); }));
  wrap.appendChild(field("Alt-tekst afbeelding", textInput(block.imageAlt, (v) => { patch({ imageAlt: v }); preview.refresh(); })));
  wrap.appendChild(field("Knoptekst (optioneel)", textInput(block.buttonText, (v) => { patch({ buttonText: v }); preview.refresh(); })));
  wrap.appendChild(linkButton(block.buttonLink, (link) => { patch({ buttonLink: link }); preview.refresh(); }));
  return wrap;
}

function editTiles(block, patch) {
  const wrap = document.createElement("div");
  const preview = livePreview(() => ({ ...block, items: (block.items || []).map((i) => ({ ...i })) }));
  wrap.appendChild(preview.el);

  const list = document.createElement("div");

  function renderList() {
    list.innerHTML = "";
    (block.items || []).forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "column-editor";
      row.style.marginBottom = "8px";
      row.appendChild(field("Titel", textInput(item.title, (v) => { item.title = v; patch({ items: block.items }); preview.refresh(); })));
      const text = document.createElement("textarea");
      text.rows = 2; text.value = item.text || "";
      text.addEventListener("input", () => { item.text = text.value; patch({ items: block.items }); preview.refresh(); });
      row.appendChild(field("Tekst", text));
      row.appendChild(linkButton(item.link, (link) => { item.link = link; patch({ items: block.items }); preview.refresh(); }));
      const removeBtn = document.createElement("button");
      removeBtn.type = "button"; removeBtn.className = "btn-admin btn-admin--danger";
      removeBtn.textContent = "Tegel verwijderen"; removeBtn.style.marginTop = "6px";
      removeBtn.addEventListener("click", () => { block.items.splice(idx, 1); patch({ items: block.items }); renderList(); preview.refresh(); });
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
    preview.refresh();
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
