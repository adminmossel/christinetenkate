// render.js
// Zet een array van "blocks" (de opbouw van een pagina, opgeslagen in
// Firestore) om naar echte, veilige HTML. Wordt gebruikt door zowel de
// publieke site als het canvas van de editor, zodat editor en live pagina
// altijd exact hetzelfde resultaat tonen.
//
// NIEUW in versie 2:
//  - Elk blok wordt verpakt in een <div class="blk"> die de stijl van het
//    blok toepast (achtergrond, kleuren, ruimte, breedte, rand, ...).
//    Die stijl staat in `block.style` (zie styleToCss hieronder).
//  - Een hele pagina kan een eigen thema hebben (`page.theme`): achtergrond,
//    kleuren, lettertype, header/footer verbergen (zie applyPageTheme).
//  - Veel nieuwe bloktypes (zie RENDERERS onderaan).
//
// BELANGRIJK over media: een blok bevat NOOIT de foto-data zelf, alleen een
// verwijzing (`mediaId`) naar een document in de collectie "media". Daarom
// heeft renderBlocks een `mediaMap` nodig: { [mediaId]: mediaDocument },
// vooraf opgehaald met collectMediaIds() + fetchMediaMap().
//
// Vereist dat DOMPurify globaal beschikbaar is (window.DOMPurify).

// ============================================================
// Kleine hulpfuncties
// ============================================================

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    node.setAttribute(key, value);
  }
  return node;
}

function txt(tag, className, text) {
  const node = el(tag, className);
  node.textContent = text || "";
  return node;
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const num = (v, fallback) => (typeof v === "number" && !Number.isNaN(v) ? v : fallback);
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

// Iemand die een externe link intypt, vergeet weleens "https://".
export function normalizeExternalUrl(value) {
  const v = (value || "").trim();
  if (!v) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith("//")) return v;
  return `https://${v}`;
}

function resolveLink(link) {
  if (!link || !link.value) return "#";
  switch (link.type) {
    case "page": return `/${link.value.replace(/^\//, "")}`;
    case "email": return `mailto:${link.value}`;
    case "phone": return `tel:${link.value.replace(/\s+/g, "")}`;
    case "anchor": return `#${link.value.replace(/^#/, "")}`;
    case "file": return `media:${link.value}`;
    case "external": return normalizeExternalUrl(link.value);
    default: return link.value;
  }
}

function applyLink(node, link, mediaMap) {
  if (!link || !link.value) return;
  if (link.type === "file") {
    const media = mediaMap[link.value];
    if (!media) { node.removeAttribute("href"); return; }
    node.setAttribute("href", media.url);
    node.setAttribute("download", media.name || "bestand");
    return;
  }
  node.setAttribute("href", resolveLink(link));
  if (link.newTab) { node.setAttribute("target", "_blank"); node.setAttribute("rel", "noopener"); }
}

function sanitize(html) {
  const config = {
    ALLOWED_TAGS: ["b","strong","i","em","u","s","strike","sup","sub","a","br","p","h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","hr","span"],
    ALLOWED_ATTR: ["href","target","rel","style"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|media):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  };
  if (window.DOMPurify) return window.DOMPurify.sanitize(html, config);
  const p = document.createElement("p");
  p.textContent = html.replace(/<[^>]*>/g, "");
  return p.outerHTML;
}
export { sanitize as sanitizeRichText };

function resolveMediaLinksInPlace(container, mediaMap) {
  container.querySelectorAll('a[href^="media:"]').forEach((a) => {
    const id = a.getAttribute("href").slice("media:".length);
    const media = mediaMap[id];
    if (media) {
      a.setAttribute("href", media.url);
      a.setAttribute("download", media.name || "bestand");
      a.removeAttribute("target");
    } else {
      a.removeAttribute("href");
      a.title = "Dit bestand is niet meer beschikbaar.";
    }
  });
}

// ============================================================
// Pictogrammen (24x24, lijn-stijl). Gebruikt door lijsten, voordelen,
// infoboxen, contactgegevens én de componentencatalogus in de editor.
// ============================================================

export const ICON_PATHS = {
  check: "M20 6L9 17l-5-5",
  arrow: "M5 12h14M12 5l7 7-7 7",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  heart: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
  award: "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12",
  smile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  warning: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
};
export const ICON_OPTIONS = ["check","arrow","star","heart","users","book","clock","mail","phone","pin","shield","home","chat","calendar","award","leaf","smile","sparkle"];

export function iconSvg(name, extraClass = "") {
  const d = ICON_PATHS[name] || ICON_PATHS.check;
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// ============================================================
// Stijl van een blok / pagina  (de kern van "alles is aanpasbaar")
// ============================================================
//
// style = {
//   bg: "none" | "color" | "gradient" | "image",
//   bgColor, bgColor2, bgAngle,               // kleur / verloop
//   bgImage (mediaId), overlayColor, overlayOpacity (0-100), bgFixed, bgPosition,
//   mode: "auto" | "dark" | "light",          // tekstkleur-modus
//   textColor, headingColor, accentColor, cardColor, font,
//   padTop, padBottom (px), width: "narrow"|"normal"|"wide"|"full",
//   boxed (als kaart), radius (px), borderWidth, borderColor, shadow,
//   textAlign, hideMobile, hideDesktop, anchor
// }

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent)$/i;
export function isCssColor(v) { return typeof v === "string" && COLOR_RE.test(v.trim()); }

function toRgb(color) {
  if (!isCssColor(color)) return null;
  const c = color.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g);
  return m && m.length >= 3 && /^rgb/i.test(c) ? [Number(m[0]), Number(m[1]), Number(m[2])] : null;
}
export function luminance(color) {
  const rgb = toRgb(color);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function withAlpha(color, a) {
  const rgb = toRgb(color) || [0, 0, 0];
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

export const FONT_SETS = {
  default: { label: "Standaard (Fraunces + Work Sans)" },
  classic: { label: "Klassiek (Playfair Display + Source Sans)", display: "'Playfair Display', Georgia, serif", body: "'Source Sans 3', 'Segoe UI', sans-serif", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Source+Sans+3:wght@400;600&display=swap" },
  modern: { label: "Modern (Poppins)", display: "'Poppins', sans-serif", body: "'Poppins', sans-serif", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" },
  friendly: { label: "Vriendelijk (Nunito)", display: "'Nunito', sans-serif", body: "'Nunito', sans-serif", href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" },
  elegant: { label: "Elegant (Cormorant + Montserrat)", display: "'Cormorant Garamond', Georgia, serif", body: "'Montserrat', sans-serif", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Montserrat:wght@400;500;600&display=swap" },
  clean: { label: "Strak (Inter)", display: "'Inter', sans-serif", body: "'Inter', sans-serif", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" },
};

function loadFont(key) {
  const set = FONT_SETS[key];
  if (!set || !set.href) return;
  const id = `font-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id; link.rel = "stylesheet"; link.href = set.href;
  document.head.appendChild(link);
}

const SHADOWS = { soft: "var(--shadow-soft)", md: "var(--shadow-md)", lg: "var(--shadow-lg)" };

/** Vertaalt een stijl-object naar css-eigenschappen, css-variabelen en klassen. */
export function styleToCss(s = {}, mediaMap = {}) {
  const css = {};
  const vars = {};
  const classes = [];
  let darkBase = null; // kleur waaruit bepaald wordt of de achtergrond donker is

  const bg = s.bg || "none";
  if (bg === "color" && isCssColor(s.bgColor)) {
    css["background-color"] = s.bgColor;
    darkBase = s.bgColor;
  } else if (bg === "gradient" && isCssColor(s.bgColor) && isCssColor(s.bgColor2)) {
    css["background-image"] = `linear-gradient(${num(s.bgAngle, 135)}deg, ${s.bgColor}, ${s.bgColor2})`;
    darkBase = s.bgColor;
  } else if (bg === "image") {
    const media = mediaMap[s.bgImage];
    if (media && media.url) {
      const op = clamp(num(s.overlayOpacity, 0), 0, 100) / 100;
      const oc = isCssColor(s.overlayColor) ? s.overlayColor : "#000000";
      const layers = [];
      if (op > 0) layers.push(`linear-gradient(${withAlpha(oc, op)}, ${withAlpha(oc, op)})`);
      layers.push(`url("${String(media.url).replace(/"/g, "%22")}")`);
      css["background-image"] = layers.join(",");
      css["background-size"] = "cover";
      css["background-position"] = pick(s.bgPosition, ["top", "center", "bottom", "left", "right"], "center");
      css["background-repeat"] = "no-repeat";
      if (s.bgFixed) css["background-attachment"] = "fixed";
      if (op >= 0.4) darkBase = oc;
    }
  }

  let mode = s.mode || "auto";
  if (mode === "auto") mode = darkBase && luminance(darkBase) < 0.4 ? "dark" : "none";
  if (mode === "dark") classes.push("blk--dark");
  if (mode === "light") classes.push("blk--light");

  if (isCssColor(s.textColor)) {
    vars["--color-ink"] = s.textColor;
    vars["--color-ink-soft"] = `color-mix(in srgb, ${s.textColor} 78%, transparent)`;
    vars["color"] = s.textColor;
  }
  if (isCssColor(s.headingColor)) vars["--color-primary"] = s.headingColor;
  if (isCssColor(s.accentColor)) {
    vars["--color-accent"] = s.accentColor;
    vars["--color-accent-soft"] = `color-mix(in srgb, ${s.accentColor} 30%, transparent)`;
    vars["--on-accent"] = luminance(s.accentColor) > 0.55 ? "#1F2E27" : "#FFFFFF";
  }
  if (isCssColor(s.cardColor)) vars["--card-bg"] = s.cardColor;

  if (s.font && s.font !== "default" && FONT_SETS[s.font]) {
    loadFont(s.font);
    vars["--font-display"] = FONT_SETS[s.font].display;
    vars["--font-body"] = FONT_SETS[s.font].body;
  }

  if (typeof s.padTop === "number") vars["--blk-pt"] = `${clamp(s.padTop, 0, 400)}px`;
  if (typeof s.padBottom === "number") vars["--blk-pb"] = `${clamp(s.padBottom, 0, 400)}px`;
  if (s.width && s.width !== "normal") classes.push(`blk--w-${pick(s.width, ["narrow", "wide", "full"], "normal")}`);
  if (s.boxed) classes.push("blk--boxed");
  if (typeof s.radius === "number") vars["--blk-radius"] = `${clamp(s.radius, 0, 80)}px`;
  if (num(s.borderWidth, 0) > 0) css["border"] = `${clamp(s.borderWidth, 0, 12)}px solid ${isCssColor(s.borderColor) ? s.borderColor : "var(--color-line)"}`;
  if (SHADOWS[s.shadow]) css["box-shadow"] = SHADOWS[s.shadow];
  if (["left", "center", "right"].includes(s.textAlign)) css["text-align"] = s.textAlign;
  if (s.hideMobile) classes.push("blk--hide-m");
  if (s.hideDesktop) classes.push("blk--hide-d");
  return { css, vars, classes };
}

export function applyStyleTo(node, s, mediaMap) {
  const { css, vars, classes } = styleToCss(s || {}, mediaMap || {});
  Object.entries(css).forEach(([k, v]) => node.style.setProperty(k, v));
  Object.entries(vars).forEach(([k, v]) => { if (v) node.style.setProperty(k, v); });
  classes.forEach((c) => node.classList.add(c));
}

/**
 * Past het thema van een hele pagina toe.
 *  - achtergrond + lettertype → <body> (zodat ook de ruimte rond de blokken meedoet)
 *  - kleuren + donker/licht → <main id="page-content"> (zodat header/footer hun eigen,
 *    leesbare kleuren houden)
 *  - header/footer verbergen → via klasse op <body>
 */
export function applyPageTheme(theme, mediaMap = {}, doc = document) {
  const body = doc.body;
  const main = doc.getElementById("page-content");
  ["background-color", "background-image", "background-size", "background-position", "background-repeat", "background-attachment", "--font-display", "--font-body"].forEach((p) => body.style.removeProperty(p));
  body.classList.remove("page--no-header", "page--no-footer");
  if (main) {
    [...main.style].forEach((p) => main.style.removeProperty(p));
    main.classList.remove("blk--dark", "blk--light");
  }
  if (!theme) return;
  const { css, vars, classes } = styleToCss(theme, mediaMap);
  Object.entries(css).forEach(([k, v]) => { if (k.startsWith("background")) body.style.setProperty(k, v); });
  ["--font-display", "--font-body"].forEach((k) => { if (vars[k]) body.style.setProperty(k, vars[k]); });
  if (main) {
    Object.entries(vars).forEach(([k, v]) => { if (v && !k.startsWith("--font") && !k.startsWith("--blk")) main.style.setProperty(k, v); });
    classes.filter((c) => c === "blk--dark" || c === "blk--light").forEach((c) => main.classList.add(c));
  }
  if (theme.hideHeader) body.classList.add("page--no-header");
  if (theme.hideFooter) body.classList.add("page--no-footer");
}

// ============================================================
// Renderers per bloktype
// ============================================================

// In de editor markeren we tekstvelden die direct op het canvas bewerkt kunnen worden.
function setField(node, opts, field) {
  if (opts && opts.editor) node.dataset.field = field;
  return node;
}

function paragraphs(text, className = "") {
  const frag = document.createDocumentFragment();
  String(text || "").split(/\n{2,}/).filter((p) => p.trim()).forEach((p) => {
    frag.appendChild(txt("p", `pl ${className}`.trim(), p.trim()));
  });
  return frag;
}

function btnClass(style, size, block) {
  const s = pick(style, ["solid", "outline", "soft", "link"], "solid");
  const parts = ["btn"];
  if (s !== "solid") parts.push(`btn--${s}`);
  if (size === "sm") parts.push("btn--sm");
  if (size === "lg") parts.push("btn--lg");
  if (block) parts.push("btn--block");
  return parts.join(" ");
}

function renderTextBlock(block, mediaMap, opts) {
  const wrap = el("div", `block-text align-${block.align || "left"}`);
  wrap.innerHTML = sanitize(block.html || "");
  resolveMediaLinksInPlace(wrap, mediaMap);
  if (opts && opts.editor) wrap.dataset.richField = "html";
  return wrap;
}

function renderHeadingBlock(block, _m, opts) {
  const level = clamp(block.level || 2, 1, 6);
  const heading = el(`h${level}`, `block-heading align-${block.align || "left"}`);
  heading.textContent = block.text || "";
  setField(heading, opts, "text");
  if (block.anchorId) heading.id = block.anchorId;
  if (!block.eyebrow) return heading;
  const wrap = el("div", `block-heading-wrap align-${block.align || "left"}`);
  wrap.appendChild(txt("p", "eyebrow", block.eyebrow));
  wrap.appendChild(heading);
  return wrap;
}

function renderImageBlock(block, mediaMap) {
  const media = mediaMap[block.mediaId];
  const figure = el("figure", `block-image align-${block.align || "center"}`);
  if (!media) { figure.innerHTML = `<p class="state-message">Afbeelding niet gevonden.</p>`; return figure; }
  if (block.widthPercent) figure.style.maxWidth = `${block.widthPercent}%`;
  let holder = figure;
  if (block.link && block.link.value) {
    const a = el("a");
    applyLink(a, block.link, mediaMap);
    figure.appendChild(a);
    holder = a;
  }
  const img = el("img", null, { src: media.url, alt: block.alt || media.alt || "", loading: "lazy", width: media.width || null, height: media.height || null });
  if (block.ratio && block.ratio !== "auto") { img.style.aspectRatio = block.ratio.replace(":", "/"); img.style.objectFit = "cover"; }
  const radius = { none: "0", sm: "6px", md: "14px", lg: "28px", round: "999px" }[block.radius];
  if (radius !== undefined) img.style.borderRadius = radius;
  holder.appendChild(img);
  if (block.caption) figure.appendChild(txt("figcaption", "", block.caption));
  return figure;
}

function openLightbox(src, alt) {
  const overlay = el("div", "lightbox");
  overlay.appendChild(el("img", null, { src, alt: alt || "" }));
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

function renderGalleryBlock(block, mediaMap, opts) {
  const grid = el("div", "block-gallery");
  grid.style.setProperty("--cols", String(clamp(block.columns || 3, 1, 6)));
  if (block.ratio && block.ratio !== "auto") grid.style.setProperty("--ratio", block.ratio.replace(":", "/"));
  if (block.gap !== undefined) grid.style.setProperty("--gap", `${clamp(block.gap, 0, 60)}px`);
  (block.images || []).forEach((entry) => {
    const media = mediaMap[entry.mediaId];
    if (!media) return;
    const img = el("img", null, { src: media.url, alt: entry.alt || media.alt || "", loading: "lazy" });
    if (block.lightbox !== false && !(opts && opts.editor)) {
      img.classList.add("is-zoomable");
      img.addEventListener("click", () => openLightbox(media.url, img.alt));
    }
    grid.appendChild(img);
  });
  return grid;
}

function renderCarouselBlock(block, mediaMap) {
  const wrap = el("div", "carousel");
  const track = el("div", "carousel__track");
  (block.images || []).forEach((entry) => {
    const media = mediaMap[entry.mediaId];
    if (!media) return;
    const fig = el("figure", "carousel__slide");
    fig.appendChild(el("img", null, { src: media.url, alt: entry.alt || media.alt || "", loading: "lazy" }));
    if (entry.caption) fig.appendChild(txt("figcaption", "", entry.caption));
    track.appendChild(fig);
  });
  wrap.appendChild(track);
  ["prev", "next"].forEach((dir) => {
    const b = el("button", `carousel__btn carousel__btn--${dir}`, { type: "button", "aria-label": dir === "prev" ? "Vorige" : "Volgende" });
    b.textContent = dir === "prev" ? "‹" : "›";
    b.addEventListener("click", () => track.scrollBy({ left: (dir === "prev" ? -1 : 1) * track.clientWidth * 0.9, behavior: "smooth" }));
    wrap.appendChild(b);
  });
  return wrap;
}

function renderButtonBlock(block, mediaMap) {
  const wrap = el("div", `block-button align-${block.align || "left"}`);
  const a = el("a", btnClass(block.style, block.size, block.fullWidth));
  applyLink(a, block.link, mediaMap);
  a.textContent = block.text || "Klik hier";
  wrap.appendChild(a);
  return wrap;
}

function renderButtonGroupBlock(block, mediaMap) {
  const wrap = el("div", `button-group align-${block.align || "left"}`);
  (block.items || []).forEach((item) => {
    const a = el("a", btnClass(item.style, block.size));
    applyLink(a, item.link, mediaMap);
    a.textContent = item.text || "Knop";
    wrap.appendChild(a);
  });
  return wrap;
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function renderFileBlock(block, mediaMap) {
  const media = mediaMap[block.mediaId];
  if (!media) return txt("p", "state-message", "Bestand niet gevonden.");
  const a = el("a", "block-file", { href: media.url, download: media.name || "bestand" });
  a.appendChild(txt("span", "block-file__icon", "📄"));
  const t = el("span");
  t.appendChild(txt("span", "block-file__name", block.label || media.name || "Bekijk het document"));
  t.appendChild(txt("span", "block-file__meta", [media.contentType, formatFileSize(media.size)].filter(Boolean).join(" · ")));
  a.appendChild(t);
  return a;
}

function renderQuoteBlock(block, _m, opts) {
  const quote = el("blockquote", `block-quote block-quote--${pick(block.variant, ["classic", "big", "plain"], "classic")}`);
  quote.appendChild(setField(txt("p", "", block.text), opts, "text"));
  if (block.cite) quote.appendChild(txt("cite", "", block.cite));
  return quote;
}

function renderDividerBlock(block) {
  const v = pick(block.variant, ["line", "dashed", "dots", "ornament"], "line");
  const hr = el("div", `block-divider block-divider--${v}`, { role: "separator" });
  if (v === "ornament") hr.innerHTML = "<span>✦</span>";
  if (isCssColor(block.color)) hr.style.setProperty("--divider-color", block.color);
  if (block.width) hr.style.setProperty("--divider-w", `${clamp(block.width, 5, 100)}%`);
  return hr;
}

function renderSpacerBlock(block) {
  const spacer = el("div", "block-spacer");
  spacer.style.height = `${block.height || 40}px`;
  return spacer;
}

function renderNestedList(listEl, blocks, mediaMap, opts, parentId, slot) {
  renderBlocks(blocks || [], listEl, mediaMap, opts, { nested: true, parentId, slot });
}

function renderColumnsBlock(block, mediaMap, opts) {
  const n = clamp(block.columns || 2, 1, 4);
  const wrap = el("div", "block-columns", { "data-columns": n });
  const ratio = pick(block.ratio, ["equal", "1-2", "2-1", "1-3", "3-1"], "equal");
  if (ratio !== "equal") wrap.dataset.ratio = ratio;
  wrap.dataset.valign = pick(block.valign, ["top", "center", "bottom", "stretch"], "top");
  if (block.gap !== undefined) wrap.style.setProperty("--col-gap", `${clamp(block.gap, 0, 100)}px`);
  if (block.reverseMobile) wrap.classList.add("is-reverse-m");
  for (let i = 0; i < n; i++) {
    const col = el("div", "block-column");
    renderNestedList(col, block.items?.[i]?.blocks, mediaMap, opts, block.id, i);
    wrap.appendChild(col);
  }
  return wrap;
}

function renderGroupBlock(block, mediaMap, opts) {
  const wrap = el("div", "block-group");
  renderNestedList(wrap, block.blocks, mediaMap, opts, block.id, 0);
  return wrap;
}

/** Zet gewone YouTube/Vimeo-links om naar de insluit-vorm; alleen http(s) is toegestaan. */
export function embedSrc(url) {
  if (!url) return "";
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.replace("/", "")}`;
    if (u.hostname.includes("vimeo.com") && !u.pathname.includes("/video/") && !u.hostname.includes("player.")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch { return ""; }
}

function renderEmbedBlock(block) {
  const wrap = el("div", "block-embed");
  if (block.ratio) wrap.style.setProperty("--embed-ratio", block.ratio.replace(":", "/"));
  const src = embedSrc(block.url);
  if (!src) return wrap;
  wrap.appendChild(el("iframe", null, { src, title: block.title || "Ingesloten inhoud", allowfullscreen: "true", loading: "lazy" }));
  return wrap;
}

function renderMapBlock(block) {
  const wrap = el("div", "block-embed block-map");
  if (!block.address) return wrap;
  wrap.style.setProperty("--map-h", `${clamp(block.height || 380, 200, 800)}px`);
  const src = `https://www.google.com/maps?q=${encodeURIComponent(block.address)}&z=${clamp(block.zoom || 14, 5, 19)}&output=embed`;
  wrap.appendChild(el("iframe", null, { src, title: block.title || "Kaart", loading: "lazy", referrerpolicy: "no-referrer-when-downgrade" }));
  return wrap;
}

function renderFaqBlock(block) {
  const wrap = el("div", `block-faq block-faq--${pick(block.variant, ["lines", "cards"], "lines")}`);
  (block.items || []).forEach((item, i) => {
    const details = document.createElement("details");
    if (block.firstOpen && i === 0) details.open = true;
    details.appendChild(txt("summary", "", item.question));
    details.appendChild(txt("div", "pl", item.answer));
    wrap.appendChild(details);
  });
  return wrap;
}

function renderTabsBlock(block) {
  const wrap = el("div", "block-tabs");
  const list = el("div", "block-tabs__list", { role: "tablist" });
  const panels = el("div", "block-tabs__panels");
  const activate = (idx) => {
    [...list.children].forEach((b, i) => { b.classList.toggle("is-active", i === idx); b.setAttribute("aria-selected", String(i === idx)); });
    [...panels.children].forEach((p, i) => { p.hidden = i !== idx; });
  };
  (block.items || []).forEach((item, i) => {
    const b = el("button", "block-tabs__tab", { type: "button", role: "tab" });
    b.textContent = item.title || `Tab ${i + 1}`;
    b.addEventListener("click", () => activate(i));
    list.appendChild(b);
    const p = el("div", "block-tabs__panel", { role: "tabpanel" });
    p.appendChild(paragraphs(item.text));
    panels.appendChild(p);
  });
  wrap.appendChild(list);
  wrap.appendChild(panels);
  activate(0);
  return wrap;
}

function renderHeroBlock(block, mediaMap, opts) {
  const section = el("section", `hero${block.imageSide === "left" ? " hero--image-left" : ""}`);
  const inner = el("div", "hero__inner");
  const textCol = el("div", "hero__text");
  if (block.eyebrow) textCol.appendChild(txt("p", "hero__eyebrow", block.eyebrow));
  textCol.appendChild(setField(txt("h1", "hero__title", block.title), opts, "title"));
  if (block.lead) textCol.appendChild(setField(txt("p", "hero__lead pl", block.lead), opts, "lead"));
  if (block.buttonText && block.buttonLink) {
    const a = el("a", "btn");
    applyLink(a, block.buttonLink, mediaMap);
    a.textContent = block.buttonText;
    textCol.appendChild(a);
  }
  inner.appendChild(textCol);
  const media = mediaMap[block.imageMediaId];
  if (media) {
    const imgWrap = el("div", "hero__image");
    imgWrap.appendChild(el("img", null, { src: media.url, alt: block.imageAlt || media.alt || "" }));
    inner.appendChild(imgWrap);
  } else {
    section.classList.add("hero--no-image");
  }
  section.appendChild(inner);
  return section;
}

function actionButtons(block, mediaMap) {
  const actions = el("div", "button-group");
  [["buttonText", "buttonLink", ""], ["button2Text", "button2Link", "outline"]].forEach(([t, l, style]) => {
    if (block[t] && block[l]) {
      const a = el("a", btnClass(style, "lg"));
      applyLink(a, block[l], mediaMap);
      a.textContent = block[t];
      actions.appendChild(a);
    }
  });
  return actions;
}

function renderBannerBlock(block, mediaMap, opts) {
  const section = el("section", `banner banner--h-${pick(block.align, ["left", "center", "right"], "center")} banner--v-${pick(block.valign, ["top", "center", "bottom"], "center")}`);
  section.style.minHeight = `${clamp(block.minHeight || 460, 200, 900)}px`;
  const media = mediaMap[block.mediaId];
  if (media) {
    const op = clamp(num(block.overlay, 45), 0, 100) / 100;
    const oc = isCssColor(block.overlayColor) ? block.overlayColor : "#000000";
    section.style.backgroundImage = `linear-gradient(${withAlpha(oc, op)}, ${withAlpha(oc, op)}), url("${String(media.url).replace(/"/g, "%22")}")`;
  }
  const inner = el("div", "banner__inner");
  if (block.eyebrow) inner.appendChild(txt("p", "banner__eyebrow", block.eyebrow));
  inner.appendChild(setField(txt("h2", "banner__title", block.title), opts, "title"));
  if (block.lead) inner.appendChild(setField(txt("p", "banner__lead pl", block.lead), opts, "lead"));
  const actions = actionButtons(block, mediaMap);
  if (actions.children.length) inner.appendChild(actions);
  section.appendChild(inner);
  return section;
}

function renderCtaBlock(block, mediaMap, opts) {
  const wrap = el("div", `cta align-${pick(block.align, ["left", "center"], "center")}`);
  wrap.appendChild(setField(txt("h2", "cta__title", block.title), opts, "title"));
  if (block.text) wrap.appendChild(setField(txt("p", "cta__text pl", block.text), opts, "text"));
  const actions = actionButtons(block, mediaMap);
  if (actions.children.length) wrap.appendChild(actions);
  return wrap;
}

function renderImageTextBlock(block, mediaMap, opts) {
  const wrap = el("div", `image-text image-text--${block.imageSide === "right" ? "right" : "left"} image-text--v-${pick(block.valign, ["top", "center"], "center")}`);
  const media = mediaMap[block.mediaId];
  const fig = el("div", "image-text__media");
  if (media) {
    const img = el("img", null, { src: media.url, alt: block.alt || media.alt || "", loading: "lazy" });
    if (block.ratio && block.ratio !== "auto") { img.style.aspectRatio = block.ratio.replace(":", "/"); img.style.objectFit = "cover"; }
    fig.appendChild(img);
  } else {
    fig.appendChild(txt("div", "image-text__placeholder", "Kies een afbeelding"));
  }
  const body = el("div", "image-text__body");
  if (block.eyebrow) body.appendChild(txt("p", "eyebrow", block.eyebrow));
  if (block.title) body.appendChild(setField(txt("h2", "", block.title), opts, "title"));
  body.appendChild(paragraphs(block.text));
  if (block.buttonText && block.buttonLink) {
    const a = el("a", btnClass(block.buttonStyle, "md"));
    applyLink(a, block.buttonLink, mediaMap);
    a.textContent = block.buttonText;
    body.appendChild(a);
  }
  wrap.appendChild(fig);
  wrap.appendChild(body);
  return wrap;
}

function cardGrid(className, cols) {
  const grid = el("div", className);
  grid.style.setProperty("--cols", String(clamp(cols || 3, 1, 4)));
  return grid;
}

function renderCardsBlock(block, mediaMap) {
  const grid = cardGrid(`cards cards--${pick(block.variant, ["raised", "outline", "flat"], "raised")}`, block.columns);
  (block.items || []).forEach((item) => {
    const card = el("div", "card");
    const media = mediaMap[item.mediaId];
    if (media) {
      const img = el("img", "card__img", { src: media.url, alt: item.alt || media.alt || "", loading: "lazy" });
      if (block.imageRatio && block.imageRatio !== "auto") img.style.aspectRatio = block.imageRatio.replace(":", "/");
      card.appendChild(img);
    }
    const body = el("div", "card__body");
    if (item.title) body.appendChild(txt("h3", "", item.title));
    if (item.text) body.appendChild(paragraphs(item.text));
    if (item.link && item.link.value) {
      const a = el("a", "card__link");
      applyLink(a, item.link, mediaMap);
      a.textContent = item.linkText || "Lees verder";
      body.appendChild(a);
    }
    card.appendChild(body);
    grid.appendChild(card);
  });
  return grid;
}

function renderFeaturesBlock(block) {
  const grid = cardGrid(`features features--${pick(block.align, ["left", "center"], "left")}`, block.columns);
  (block.items || []).forEach((item) => {
    const f = el("div", "feature");
    const ic = el("span", "feature__icon");
    ic.innerHTML = iconSvg(item.icon || "sparkle");
    f.appendChild(ic);
    if (item.title) f.appendChild(txt("h3", "", item.title));
    if (item.text) f.appendChild(paragraphs(item.text));
    grid.appendChild(f);
  });
  return grid;
}

function renderTeamBlock(block, mediaMap) {
  const grid = cardGrid(`team team--${block.round === false ? "square" : "round"}`, block.columns);
  (block.items || []).forEach((item) => {
    const p = el("div", "person");
    const media = mediaMap[item.mediaId];
    p.appendChild(media ? el("img", "person__photo", { src: media.url, alt: item.name || "", loading: "lazy" }) : txt("div", "person__photo person__photo--empty", (item.name || "?").charAt(0)));
    p.appendChild(txt("h3", "", item.name));
    if (item.role) p.appendChild(txt("p", "person__role", item.role));
    if (item.text) p.appendChild(paragraphs(item.text));
    grid.appendChild(p);
  });
  return grid;
}

function renderPricingBlock(block, mediaMap) {
  const grid = cardGrid("pricing", block.columns);
  (block.items || []).forEach((item) => {
    const c = el("div", `price-card${item.highlight ? " price-card--highlight" : ""}`);
    if (item.highlight && item.badge) c.appendChild(txt("span", "price-card__badge", item.badge));
    c.appendChild(txt("h3", "", item.name));
    const price = el("p", "price-card__price");
    price.appendChild(txt("span", "price-card__amount", item.price));
    if (item.period) price.appendChild(txt("span", "price-card__period", item.period));
    c.appendChild(price);
    const ul = el("ul", "price-card__features");
    String(item.features || "").split("\n").filter((l) => l.trim()).forEach((l) => {
      const li = el("li");
      li.innerHTML = iconSvg("check");
      li.appendChild(txt("span", "", l.trim()));
      ul.appendChild(li);
    });
    c.appendChild(ul);
    if (item.buttonText && item.link) {
      const a = el("a", btnClass(item.highlight ? "solid" : "outline", "md", true));
      applyLink(a, item.link, mediaMap);
      a.textContent = item.buttonText;
      c.appendChild(a);
    }
    grid.appendChild(c);
  });
  return grid;
}

function renderLogosBlock(block, mediaMap) {
  const wrap = el("div", `logos${block.grayscale ? " logos--gray" : ""}`);
  if (block.title) wrap.appendChild(txt("p", "logos__title eyebrow", block.title));
  const row = el("div", "logos__row");
  (block.images || []).forEach((entry) => {
    const media = mediaMap[entry.mediaId];
    if (!media) return;
    const img = el("img", null, { src: media.url, alt: entry.alt || media.alt || "", loading: "lazy" });
    if (entry.link && entry.link.value) {
      const a = el("a");
      applyLink(a, entry.link, mediaMap);
      a.appendChild(img);
      row.appendChild(a);
    } else row.appendChild(img);
  });
  wrap.appendChild(row);
  return wrap;
}

function countUp(node, target) {
  const decimals = (String(target).split(".")[1] || "").length;
  const start = performance.now();
  const dur = 1400;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = (target * eased).toFixed(decimals).replace(".", ",");
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderStatsBlock(block, _m, opts) {
  const grid = cardGrid("stats", block.columns || Math.min(4, (block.items || []).length || 3));
  (block.items || []).forEach((item) => {
    const s = el("div", "stat");
    const value = el("span", "stat__value");
    const n = txt("span", "", item.value || "");
    value.append(txt("span", "", item.prefix || ""), n, txt("span", "", item.suffix || ""));
    const numeric = /^\d+([.,]\d+)?$/.test(String(item.value || ""));
    if (block.animate && numeric && !(opts && opts.editor) && "IntersectionObserver" in window) {
      const target = parseFloat(String(item.value).replace(",", "."));
      n.textContent = "0";
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { io.disconnect(); countUp(n, target); }
      });
      io.observe(value);
    }
    s.appendChild(value);
    s.appendChild(txt("span", "stat__label", item.label));
    grid.appendChild(s);
  });
  return grid;
}

function renderTimelineBlock(block) {
  const ol = el("ol", "timeline");
  (block.items || []).forEach((item) => {
    const li = el("li", "timeline__item");
    if (item.date) li.appendChild(txt("span", "timeline__date", item.date));
    if (item.title) li.appendChild(txt("h3", "", item.title));
    if (item.text) li.appendChild(paragraphs(item.text));
    ol.appendChild(li);
  });
  return ol;
}

function renderStepsBlock(block) {
  const wrap = cardGrid("steps", block.columns || Math.min(4, (block.items || []).length || 3));
  (block.items || []).forEach((item, i) => {
    const step = el("div", "step");
    step.appendChild(txt("span", "step__num", String(i + 1)));
    if (item.title) step.appendChild(txt("h3", "", item.title));
    if (item.text) step.appendChild(paragraphs(item.text));
    wrap.appendChild(step);
  });
  return wrap;
}

function renderTableBlock(block) {
  const wrap = el("div", `block-table${block.striped ? " is-striped" : ""}`);
  const table = el("table");
  const cols = clamp(block.columns || 3, 2, 4);
  (block.rows || []).forEach((row, i) => {
    const tr = el("tr");
    for (let c = 1; c <= cols; c++) tr.appendChild(txt(i === 0 && block.header !== false ? "th" : "td", "", row[`c${c}`]));
    table.appendChild(tr);
  });
  wrap.appendChild(table);
  return wrap;
}

function renderListBlock(block) {
  const ul = el("ul", `block-list block-list--cols-${clamp(block.columns || 1, 1, 3)}`);
  (block.items || []).forEach((item, i) => {
    const li = el("li");
    const ic = el("span", "block-list__icon");
    if (block.icon === "number") ic.textContent = String(i + 1);
    else if (block.icon === "dot") ic.textContent = "•";
    else ic.innerHTML = iconSvg(block.icon || "check");
    li.appendChild(ic);
    li.appendChild(txt("span", "block-list__text", item.text));
    ul.appendChild(li);
  });
  return ul;
}

function renderCalloutBlock(block, _m, opts) {
  const variant = pick(block.variant, ["info", "tip", "warning", "success"], "info");
  const wrap = el("div", `callout callout--${variant}`);
  const ic = el("span", "callout__icon");
  ic.innerHTML = iconSvg({ info: "info", tip: "sparkle", warning: "warning", success: "check" }[variant]);
  const body = el("div", "callout__body");
  if (block.title) body.appendChild(setField(txt("strong", "callout__title", block.title), opts, "title"));
  body.appendChild(paragraphs(block.text));
  wrap.appendChild(ic);
  wrap.appendChild(body);
  return wrap;
}

function renderHoursBlock(block) {
  const wrap = el("div", "hours");
  if (block.title) wrap.appendChild(txt("h3", "", block.title));
  const dl = el("dl");
  (block.items || []).forEach((item) => {
    dl.appendChild(txt("dt", "", item.day));
    dl.appendChild(txt("dd", "", item.time));
  });
  wrap.appendChild(dl);
  if (block.note) wrap.appendChild(txt("p", "hours__note", block.note));
  return wrap;
}

function renderContactCardBlock(block) {
  const wrap = el("div", "contact-card");
  if (block.title) wrap.appendChild(txt("h3", "", block.title));
  const rows = [
    ["pin", block.address, null],
    ["phone", block.phone, block.phone ? `tel:${block.phone.replace(/[^\d+]/g, "")}` : null],
    ["mail", block.email, block.email ? `mailto:${block.email}` : null],
    ["home", block.website, block.website ? normalizeExternalUrl(block.website) : null],
  ];
  rows.forEach(([icon, value, href]) => {
    if (!value) return;
    const row = el("div", "contact-card__row");
    const ic = el("span", "contact-card__icon");
    ic.innerHTML = iconSvg(icon);
    row.appendChild(ic);
    if (href) { const a = el("a", "pl", { href }); a.textContent = value; row.appendChild(a); }
    else row.appendChild(txt("span", "pl", value));
    wrap.appendChild(row);
  });
  return wrap;
}

export const SOCIAL_NETWORKS = {
  facebook: { label: "Facebook", short: "f" }, instagram: { label: "Instagram", short: "ig" },
  linkedin: { label: "LinkedIn", short: "in" }, youtube: { label: "YouTube", short: "yt" },
  tiktok: { label: "TikTok", short: "tt" }, x: { label: "X", short: "x" },
  whatsapp: { label: "WhatsApp", short: "wa" }, website: { label: "Website", short: "www" },
};

function renderSocialBlock(block) {
  const ul = el("ul", `social align-${block.align || "left"}`);
  (block.items || []).forEach((item) => {
    if (!item.url) return;
    const net = SOCIAL_NETWORKS[item.network] || SOCIAL_NETWORKS.website;
    const li = el("li");
    const a = el("a", "social__link", { href: normalizeExternalUrl(item.url), target: "_blank", rel: "noopener", "aria-label": net.label });
    a.textContent = net.short;
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}

function renderContactFormBlock(block) {
  const uid = (block.id || "x").replace(/[^a-z0-9]/gi, "");
  const wrap = el("form", "block-contact-form", { "data-contact-form": "true", novalidate: "true" });
  if (block.title) wrap.appendChild(txt("h3", "", block.title));
  if (block.intro) wrap.appendChild(paragraphs(block.intro));
  const field = (label, name, controlHtml) => {
    const f = el("div", "form-field");
    f.innerHTML = `<label for="cf-${name}-${uid}">${label}</label>${controlHtml}`;
    return f;
  };
  wrap.appendChild(field("Naam", "name", `<input id="cf-name-${uid}" name="name" type="text" required autocomplete="name">`));
  wrap.appendChild(field("E-mailadres", "email", `<input id="cf-email-${uid}" name="email" type="email" required autocomplete="email">`));
  wrap.appendChild(field("Bericht", "message", `<textarea id="cf-message-${uid}" name="message" rows="5" required></textarea>`));
  const honeypot = el("input", null, { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  honeypot.style.position = "absolute";
  honeypot.style.left = "-9999px";
  const submit = el("button", "btn", { type: "submit" });
  submit.textContent = block.buttonText || "Versturen";
  wrap.appendChild(honeypot);
  wrap.appendChild(submit);
  wrap.appendChild(el("p", "form-status", { role: "status" }));
  return wrap;
}

function renderTilesBlock(block, mediaMap) {
  const grid = el("div", "tile-grid");
  (block.items || []).forEach((item) => {
    const tile = el("div", "tile");
    tile.appendChild(txt("h3", "", item.title));
    tile.appendChild(txt("p", "", item.text));
    if (item.link && item.link.value) {
      const a = el("a");
      applyLink(a, item.link, mediaMap);
      a.textContent = "Lees verder";
      tile.appendChild(a);
    }
    grid.appendChild(tile);
  });
  return grid;
}

function renderReviewsBlock(block) {
  const wrap = el("div", "block-reviews");
  if (block.title) wrap.appendChild(txt("h2", "block-reviews__title", block.title));
  const grid = el("div", "review-grid");
  (block.items || []).forEach((item) => {
    const card = el("figure", "review-card");
    const rating = clamp(item.rating || 5, 1, 5);
    const stars = txt("div", "review-card__stars", "★".repeat(rating) + "☆".repeat(5 - rating));
    stars.setAttribute("aria-hidden", "true");
    card.appendChild(stars);
    card.appendChild(txt("blockquote", "", item.text));
    if (item.name) {
      const cap = document.createElement("figcaption");
      cap.appendChild(txt("strong", "", item.name));
      if (item.role) cap.appendChild(txt("span", "", ` — ${item.role}`));
      card.appendChild(cap);
    }
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

const RENDERERS = {
  // inhoud
  text: renderTextBlock, heading: renderHeadingBlock, quote: renderQuoteBlock,
  list: renderListBlock, callout: renderCalloutBlock, table: renderTableBlock,
  // secties
  hero: renderHeroBlock, banner: renderBannerBlock, cta: renderCtaBlock, "image-text": renderImageTextBlock,
  // media
  image: renderImageBlock, gallery: renderGalleryBlock, carousel: renderCarouselBlock,
  file: renderFileBlock, embed: renderEmbedBlock, map: renderMapBlock, logos: renderLogosBlock,
  // kaarten & lijsten
  cards: renderCardsBlock, tiles: renderTilesBlock, features: renderFeaturesBlock, team: renderTeamBlock,
  pricing: renderPricingBlock, stats: renderStatsBlock, timeline: renderTimelineBlock, steps: renderStepsBlock,
  reviews: renderReviewsBlock, faq: renderFaqBlock, tabs: renderTabsBlock,
  // interactie
  button: renderButtonBlock, "button-group": renderButtonGroupBlock, "contact-form": renderContactFormBlock,
  // info
  hours: renderHoursBlock, "contact-card": renderContactCardBlock, social: renderSocialBlock,
  // layout
  columns: renderColumnsBlock, group: renderGroupBlock, divider: renderDividerBlock, spacer: renderSpacerBlock,
};

// ============================================================
// Publieke API
// ============================================================

/** Rendert één blok, verpakt in de stijl-wrapper. */
export function renderBlockNode(block, mediaMap = {}, opts = {}, nested = false) {
  const renderer = RENDERERS[block.type];
  const wrap = el("div", `blk blk--${block.type}${nested ? " blk--nested" : ""}`);
  if (opts.editor) {
    wrap.dataset.bid = block.id;
    if (block.hidden) wrap.classList.add("blk--is-hidden");
  }
  let content = null;
  if (renderer) {
    try { content = renderer(block, mediaMap, opts); } catch (err) { console.error("Kon blok niet renderen:", block, err); }
  }
  if (!content) {
    if (!opts.editor) return null;
    content = txt("p", "state-message", `Onbekend of leeg blok: ${block.type}`);
  }
  const inner = el("div", "blk__inner");
  inner.appendChild(content);
  wrap.appendChild(inner);
  const s = block.style || {};
  applyStyleTo(wrap, s, mediaMap);
  if (s.anchor) wrap.id = String(s.anchor).replace(/[^a-z0-9_-]/gi, "");
  return wrap;
}

/**
 * @param {Array} blocks
 * @param {HTMLElement} container
 * @param {Object} mediaMap - { [mediaId]: {url, name, ...} }
 * @param {Object} opts - { editor: true } voegt data-attributen toe voor de editor
 */
export function renderBlocks(blocks, container, mediaMap = {}, opts = {}, ctx = { nested: false, parentId: "root", slot: 0 }) {
  container.innerHTML = "";
  if (opts.editor) {
    container.dataset.container = ctx.parentId;
    container.dataset.slot = String(ctx.slot);
  }
  (blocks || []).forEach((block) => {
    if (block.hidden && !opts.editor) return;
    const node = renderBlockNode(block, mediaMap, opts, ctx.nested);
    if (node) container.appendChild(node);
  });
  if (opts.editor && ctx.nested && !(blocks || []).length) {
    container.appendChild(txt("div", "drop-hint", "Sleep hier een component naartoe"));
  }
}

/** Verzamelt recursief alle mediaId's (blokken, stijlen, links, kolommen, rijke tekst). */
export function collectMediaIds(blocks, ids = new Set()) {
  const MEDIA_KEYS = ["mediaId", "imageMediaId", "bgImage"];
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== "object") return;
    if (v.type === "file" && typeof v.value === "string" && !v.id) ids.add(v.value);
    for (const [k, val] of Object.entries(v)) {
      if (MEDIA_KEYS.includes(k) && typeof val === "string" && val) ids.add(val);
      else if (typeof val === "string" && val.includes('href="media:')) {
        for (const m of val.matchAll(/href="media:([^"]+)"/g)) ids.add(m[1]);
      } else walk(val);
    }
  };
  walk(blocks);
  return ids;
}

/** Media-id's van een hele pagina (blokken + paginathema). */
export function collectPageMediaIds(page) {
  const ids = collectMediaIds(page.blocks || []);
  if (page.theme && page.theme.bgImage) ids.add(page.theme.bgImage);
  return ids;
}

export { resolveLink };
