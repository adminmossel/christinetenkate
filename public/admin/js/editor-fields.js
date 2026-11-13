// editor-fields.js
// Bouwt bewerkvelden (tekst, kleur, afbeelding, herhaalbare lijsten, ...) uit
// een schema (zie block-registry.js). Wordt gebruikt voor:
//   - het tabblad "Inhoud" van elk component
//   - het tabblad "Stijl" (achtergrond, kleuren, ruimte, ...) van elk component
//   - het paginathema (achtergrond/kleuren van een hele pagina)
//
// Elk veld wijzigt direct het object (`obj[key] = waarde`) en roept daarna
// `onChange(key)` aan. De aanroeper bepaalt wat er dan gebeurt (opslaan, canvas verversen).

import { ICON_PATHS, ICON_OPTIONS, FONT_SETS } from "../../js/render.js";
import { buildRichToolbar } from "./rich-toolbar.js";

function h(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function setOrDelete(obj, key, value) {
  if (value === "" || value === undefined || value === null) delete obj[key];
  else obj[key] = value;
}

function wrapField(def, control) {
  const f = h("div", `fld fld--${def.type}`);
  if (def.label && def.type !== "toggle") f.appendChild(h("label", "fld__label", def.label));
  f.appendChild(control);
  return f;
}

// ------------------------------------------------------------
// Losse controls. Ieder geeft { el, set(value) } terug.
// ------------------------------------------------------------

function textControl(def, obj, change) {
  const input = document.createElement(def.type === "textarea" ? "textarea" : "input");
  if (def.type === "textarea") input.rows = def.rows || 3; else input.type = "text";
  input.placeholder = def.placeholder || "";
  input.value = obj[def.key] ?? "";
  input.addEventListener("input", () => { obj[def.key] = input.value; change(def.key); });
  return { el: input, set: (v) => { if (document.activeElement !== input) input.value = v ?? ""; } };
}

function richControl(def, obj, change) {
  const wrap = h("div", "fld-rich");
  const editable = h("div", "rich-text-editable site-preview");
  editable.contentEditable = "true";
  editable.innerHTML = obj[def.key] || "";
  const toolbar = buildRichToolbar(editable, (html) => { obj[def.key] = html; change(def.key); });
  wrap.append(toolbar, editable);
  return { el: wrap, set: (v) => { if (!editable.contains(document.activeElement)) editable.innerHTML = v || ""; } };
}

function selectControl(def, obj, change) {
  const sel = document.createElement("select");
  sel.innerHTML = def.options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  const set = (v) => { sel.value = String(v ?? def.options[0].value); };
  set(obj[def.key]);
  sel.addEventListener("change", () => { setOrDelete(obj, def.key, def.number ? Number(sel.value) : sel.value); change(def.key); });
  return { el: sel, set };
}

function segmentedControl(def, obj, change) {
  const row = h("div", "seg");
  const btns = def.options.map((o) => {
    const b = h("button", "seg__btn", o.label);
    b.type = "button";
    b.addEventListener("click", () => { setOrDelete(obj, def.key, o.value); sync(); change(def.key); });
    row.appendChild(b);
    return [o.value, b];
  });
  const sync = () => btns.forEach(([v, b]) => b.classList.toggle("is-active", String(v) === String(obj[def.key] ?? def.options[0].value) || (v === "" && obj[def.key] === undefined)));
  sync();
  return { el: row, set: sync };
}

function rangeControl(def, obj, change) {
  const wrap = h("div", "rng");
  const input = document.createElement("input");
  input.type = "range"; input.min = def.min; input.max = def.max; input.step = def.step || 1;
  const out = h("span", "rng__val");
  const fallback = def.fallback ?? def.min;
  const draw = () => {
    const v = obj[def.key];
    input.value = v ?? fallback;
    out.textContent = v === undefined && def.resettable ? "standaard" : `${v ?? fallback}${def.unit || ""}`;
  };
  input.addEventListener("input", () => { obj[def.key] = Number(input.value); out.textContent = `${input.value}${def.unit || ""}`; change(def.key); });
  wrap.append(input, out);
  if (def.resettable) {
    const reset = h("button", "rng__reset", "↺");
    reset.type = "button"; reset.title = "Terug naar standaard";
    reset.addEventListener("click", () => { delete obj[def.key]; draw(); change(def.key); });
    wrap.appendChild(reset);
  }
  draw();
  return { el: wrap, set: draw };
}

function toggleControl(def, obj, change) {
  const label = h("label", "tgl");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!obj[def.key];
  input.addEventListener("change", () => { if (input.checked) obj[def.key] = true; else if (def.keepFalse) obj[def.key] = false; else delete obj[def.key]; change(def.key); });
  label.append(input, h("span", "tgl__track"), h("span", "tgl__text", def.label));
  return { el: label, set: (v) => { input.checked = !!v; } };
}

function colorControl(def, obj, change, ctx) {
  const wrap = h("div", "clr");
  const sw = h("div", "clr__swatches");
  const native = document.createElement("input");
  native.type = "color"; native.className = "clr__native"; native.title = "Eigen kleur kiezen";
  const hex = document.createElement("input");
  hex.type = "text"; hex.className = "clr__hex"; hex.placeholder = "geen";
  const clear = h("button", "clr__clear", "✕"); clear.type = "button"; clear.title = "Kleur wissen";

  const apply = (v) => { setOrDelete(obj, def.key, v); draw(); change(def.key); };
  const draw = () => {
    const v = obj[def.key] || "";
    hex.value = v;
    if (/^#[0-9a-f]{6}$/i.test(v)) native.value = v;
    clear.style.visibility = v ? "visible" : "hidden";
    [...sw.children].forEach((b) => b.classList.toggle("is-active", b.dataset.color?.toLowerCase() === v.toLowerCase()));
  };
  (ctx.palette || []).forEach((c) => {
    const b = h("button", "clr__sw"); b.type = "button"; b.dataset.color = c.value; b.title = c.name;
    b.style.background = c.value;
    b.addEventListener("click", () => apply(c.value));
    sw.appendChild(b);
  });
  native.addEventListener("input", () => apply(native.value));
  hex.addEventListener("change", () => { const v = hex.value.trim(); apply(/^#?[0-9a-f]{3,8}$/i.test(v) ? (v.startsWith("#") ? v : `#${v}`) : ""); });
  clear.addEventListener("click", () => apply(""));
  wrap.append(sw, native, hex, clear);
  draw();
  return { el: wrap, set: draw };
}

function mediaControl(def, obj, change, ctx) {
  const wrap = h("div", "med");
  const thumb = h("div", "med__thumb");
  const actions = h("div", "med__actions");
  const pick = h("button", "btn-admin", "Kiezen"); pick.type = "button";
  const crop = h("button", "btn-admin", "✂ Bijsnijden"); crop.type = "button";
  const remove = h("button", "btn-admin btn-admin--danger", "Verwijderen"); remove.type = "button";
  const draw = async () => {
    const id = obj[def.key];
    pick.textContent = id ? "Wijzigen" : "Kiezen";
    crop.style.display = id && def.crop ? "" : "none";
    remove.style.display = id ? "" : "none";
    if (!id) { thumb.innerHTML = `<span>Geen ${def.accept === "any" ? "bestand" : "afbeelding"}</span>`; return; }
    const map = await ctx.fetchMediaMap([id]);
    const m = map[id];
    if (!m) { thumb.innerHTML = "<span>Niet gevonden</span>"; return; }
    thumb.innerHTML = def.accept === "any" ? `<span>📄 ${m.name || "bestand"}</span>` : `<img src="${m.url}" alt="">`;
  };
  pick.addEventListener("click", async () => {
    const m = await ctx.openMediaPicker({ accept: def.accept || "image" });
    if (m) { obj[def.key] = m.id; draw(); change(def.key, { rebuild: true }); }
  });
  crop.addEventListener("click", async () => {
    const map = await ctx.fetchMediaMap([obj[def.key]]);
    const cur = map[obj[def.key]];
    if (!cur) return;
    const out = await ctx.openCropTool(cur.url, cur.name);
    if (out) { obj[def.key] = out.id; draw(); change(def.key); }
  });
  remove.addEventListener("click", () => { delete obj[def.key]; draw(); change(def.key); });
  actions.append(pick, crop, remove);
  thumb.addEventListener("click", () => pick.click());
  wrap.append(thumb, actions);
  draw();
  return { el: wrap, set: draw };
}

function linkControl(def, obj, change, ctx) {
  const btn = h("button", "btn-admin fld-link"); btn.type = "button";
  const label = () => {
    const l = obj[def.key];
    if (!l || !l.value) return "＋ Link instellen";
    return l.type === "file" ? "🔗 Bestand gekoppeld" : `🔗 ${l.value}`;
  };
  btn.textContent = label();
  btn.addEventListener("click", async () => {
    const link = await ctx.openLinkPicker(obj[def.key] || null);
    if (link !== undefined) { obj[def.key] = link; btn.textContent = label(); change(def.key); }
  });
  return { el: btn, set: () => { btn.textContent = label(); } };
}

function iconControl(def, obj, change) {
  const grid = h("div", "icons");
  ICON_OPTIONS.forEach((name) => {
    const b = h("button", "icons__btn"); b.type = "button"; b.title = name;
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON_PATHS[name]}"/></svg>`;
    b.addEventListener("click", () => { obj[def.key] = name; sync(); change(def.key); });
    b.dataset.name = name;
    grid.appendChild(b);
  });
  const sync = () => [...grid.children].forEach((b) => b.classList.toggle("is-active", b.dataset.name === (obj[def.key] || "sparkle")));
  sync();
  return { el: grid, set: sync };
}

function itemsControl(def, obj, change, ctx) {
  const wrap = h("div", "rep");
  const list = h("div", "rep__list");
  const open = new Set();
  obj[def.key] = obj[def.key] || [];

  const move = (i, j) => { const a = obj[def.key]; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; change(def.key, { rebuild: true }); draw(); };

  function draw() {
    list.innerHTML = "";
    obj[def.key].forEach((item, i) => {
      const row = h("div", `rep__item${open.has(i) ? " is-open" : ""}`);
      const head = h("div", "rep__head");
      const title = h("span", "rep__title");
      const titleText = () => {
        const v = item[def.itemLabel];
        return typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : `${def.label.replace(/s$/, "")} ${i + 1}`;
      };
      title.textContent = titleText();
      const thumbKey = def.fields.find((f) => f.type === "media")?.key;
      if (thumbKey && item[thumbKey]) {
        const t = h("img", "rep__thumb");
        ctx.fetchMediaMap([item[thumbKey]]).then((m) => { if (m[item[thumbKey]]) t.src = m[item[thumbKey]].url; });
        head.appendChild(t);
      }
      head.appendChild(title);
      const acts = h("span", "rep__acts");
      [["↑", "Omhoog", () => move(i, i - 1)], ["↓", "Omlaag", () => move(i, i + 1)],
        ["⎘", "Dupliceren", () => { obj[def.key].splice(i + 1, 0, JSON.parse(JSON.stringify(item))); open.clear(); open.add(i + 1); change(def.key, { rebuild: true }); draw(); }],
        ["🗑", "Verwijderen", () => { obj[def.key].splice(i, 1); open.clear(); change(def.key, { rebuild: true }); draw(); }]].forEach(([sym, tip, fn]) => {
        const b = h("button", "", sym); b.type = "button"; b.title = tip;
        b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
        acts.appendChild(b);
      });
      head.appendChild(acts);
      head.addEventListener("click", () => { open.has(i) ? open.delete(i) : open.add(i); draw(); });
      row.appendChild(head);
      if (open.has(i)) {
        const body = h("div", "rep__body");
        body.appendChild(buildFields(def.fields, item, (key, meta) => { title.textContent = titleText(); change(def.key, meta); }, ctx, obj));
        row.appendChild(body);
      }
      list.appendChild(row);
    });
  }
  const add = h("button", "btn-admin rep__add", `＋ ${def.label.replace(/s$/, "")} toevoegen`);
  add.type = "button";
  add.addEventListener("click", () => {
    obj[def.key].push(def.factory());
    open.clear(); open.add(obj[def.key].length - 1);
    change(def.key, { rebuild: true });
    draw();
  });
  draw();
  wrap.append(list, add);
  return { el: wrap, set: () => draw() };
}

const CONTROLS = {
  text: textControl, textarea: textControl, rich: richControl, select: selectControl, segmented: segmentedControl,
  range: rangeControl, toggle: toggleControl, color: colorControl, media: mediaControl, link: linkControl, icon: iconControl, items: itemsControl,
};

/**
 * Bouwt alle velden van een schema.
 * @param {Array} schema   lijst veld-definities
 * @param {Object} obj     het object dat bewerkt wordt (blok, stijl, item, thema)
 * @param {Function} onChange (key, meta) → na elke wijziging
 * @param {Object} ctx     { palette, fetchMediaMap, openMediaPicker, openLinkPicker, openCropTool }
 * @param {Object} parent  ouder-object (voor showIf in herhaalbare lijsten)
 */
export function buildFields(schema, obj, onChange, ctx, parent = obj) {
  const root = h("div", "flds");
  const controls = {};
  const rows = [];
  const updateVisibility = () => rows.forEach(({ def, el }) => { el.hidden = def.showIf ? !def.showIf(obj, parent) : false; });

  schema.forEach((def) => {
    if (def.type === "help") { root.appendChild(h("p", "fld-help", def.text)); return; }
    const make = CONTROLS[def.type];
    if (!make) return;
    const ctl = make(def, obj, (key, meta) => { updateVisibility(); onChange(key, meta); }, ctx);
    controls[def.key] = ctl;
    const row = def.type === "toggle" ? (() => { const f = h("div", "fld fld--toggle"); f.appendChild(ctl.el); return f; })() : wrapField(def, ctl.el);
    rows.push({ def, el: row });
    root.appendChild(row);
  });
  updateVisibility();
  root.__controls = controls;
  return root;
}

// ------------------------------------------------------------
// Schema's voor stijl (blok én pagina)
// ------------------------------------------------------------

const isBg = (v) => (s) => s.bg === v;
const SEGBG = [{ value: "none", label: "Geen" }, { value: "color", label: "Kleur" }, { value: "gradient", label: "Verloop" }, { value: "image", label: "Foto" }];

const BACKGROUND = [
  { type: "segmented", key: "bg", label: "Achtergrond", options: SEGBG },
  { type: "color", key: "bgColor", label: "Kleur", showIf: (s) => s.bg === "color" || s.bg === "gradient" },
  { type: "color", key: "bgColor2", label: "Tweede kleur", showIf: isBg("gradient") },
  { type: "range", key: "bgAngle", label: "Richting van het verloop", min: 0, max: 360, step: 5, unit: "°", fallback: 135, showIf: isBg("gradient") },
  { type: "media", key: "bgImage", label: "Achtergrondfoto", accept: "image", showIf: isBg("image") },
  { type: "range", key: "overlayOpacity", label: "Donkere sluier over de foto", min: 0, max: 90, unit: "%", fallback: 0, showIf: isBg("image") },
  { type: "color", key: "overlayColor", label: "Kleur van de sluier", showIf: (s) => s.bg === "image" && s.overlayOpacity > 0 },
  { type: "segmented", key: "bgPosition", label: "Positie van de foto", options: [{ value: "top", label: "Boven" }, { value: "center", label: "Midden" }, { value: "bottom", label: "Onder" }], showIf: isBg("image") },
  { type: "toggle", key: "bgFixed", label: "Foto blijft staan bij scrollen (parallax)", showIf: isBg("image") },
];

const COLORS = [
  { type: "segmented", key: "mode", label: "Tekst op deze achtergrond", options: [{ value: "auto", label: "Automatisch" }, { value: "light", label: "Donkere tekst" }, { value: "dark", label: "Lichte tekst" }] },
  { type: "color", key: "textColor", label: "Tekstkleur" },
  { type: "color", key: "headingColor", label: "Kleur van koppen" },
  { type: "color", key: "accentColor", label: "Accentkleur (knoppen, links, pictogrammen)" },
  { type: "color", key: "cardColor", label: "Kleur van kaartjes" },
  { type: "select", key: "font", label: "Lettertype", options: Object.entries(FONT_SETS).map(([value, v]) => ({ value, label: v.label })) },
];

const SPACING = [
  { type: "range", key: "padTop", label: "Ruimte boven", min: 0, max: 240, step: 4, unit: "px", resettable: true, fallback: 24 },
  { type: "range", key: "padBottom", label: "Ruimte onder", min: 0, max: 240, step: 4, unit: "px", resettable: true, fallback: 24 },
  { type: "segmented", key: "width", label: "Breedte van de inhoud", options: [{ value: "narrow", label: "Smal" }, { value: "normal", label: "Normaal" }, { value: "wide", label: "Breed" }, { value: "full", label: "Volledig" }] },
  { type: "segmented", key: "textAlign", label: "Tekst uitlijnen", options: [{ value: "", label: "Standaard" }, { value: "left", label: "Links" }, { value: "center", label: "Midden" }, { value: "right", label: "Rechts" }] },
];

const SHAPE = [
  { type: "toggle", key: "boxed", label: "Tonen als afgeronde kaart (ingesprongen)" },
  { type: "range", key: "radius", label: "Hoekafronding", min: 0, max: 60, unit: "px", resettable: true, fallback: 22 },
  { type: "range", key: "borderWidth", label: "Rand", min: 0, max: 8, unit: "px", fallback: 0 },
  { type: "color", key: "borderColor", label: "Randkleur", showIf: (s) => s.borderWidth > 0 },
  { type: "select", key: "shadow", label: "Schaduw", options: [{ value: "", label: "Geen" }, { value: "soft", label: "Zacht" }, { value: "md", label: "Middel" }, { value: "lg", label: "Groot" }] },
];

const VISIBILITY = [
  { type: "toggle", key: "hideMobile", label: "Verbergen op mobiel" },
  { type: "toggle", key: "hideDesktop", label: "Verbergen op computer/tablet" },
  { type: "text", key: "anchor", label: "Anker-ID (voor een link naar deze sectie)", placeholder: "bijv. contact" },
];

export const BLOCK_STYLE_SECTIONS = [
  { id: "bg", title: "Achtergrond", fields: BACKGROUND },
  { id: "colors", title: "Kleuren & lettertype", fields: COLORS },
  { id: "space", title: "Ruimte & breedte", fields: SPACING },
  { id: "shape", title: "Kaart, rand & schaduw", fields: SHAPE },
  { id: "vis", title: "Zichtbaarheid & anker", fields: VISIBILITY },
];

export const PAGE_STYLE_SECTIONS = [
  { id: "bg", title: "Achtergrond van de pagina", fields: BACKGROUND },
  { id: "colors", title: "Kleuren & lettertype", fields: COLORS },
  { id: "chrome", title: "Weergave", fields: [
    { type: "toggle", key: "hideHeader", label: "Menubalk (header) verbergen op deze pagina" },
    { type: "toggle", key: "hideFooter", label: "Voettekst (footer) verbergen op deze pagina" },
  ] },
];

/** Bouwt een lijst uitklapbare secties met velden (voor stijl en paginathema). */
export function buildSections(sections, obj, onChange, ctx) {
  const root = h("div", "secs");
  sections.forEach((sec, idx) => {
    const box = h("div", `sec${idx === 0 ? " is-open" : ""}`);
    const head = h("button", "sec__head");
    head.type = "button";
    head.innerHTML = `<span>${sec.title}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    head.addEventListener("click", () => box.classList.toggle("is-open"));
    const body = h("div", "sec__body");
    body.appendChild(buildFields(sec.fields, obj, onChange, ctx));
    box.append(head, body);
    root.appendChild(box);
  });
  return root;
}
