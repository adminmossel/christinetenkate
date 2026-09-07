// render.js
// Zet een array van "blocks" (de opbouw van een pagina, opgeslagen in
// Firestore) om naar echte, veilige HTML. Wordt gebruikt door zowel de
// publieke site als de voorbeeldweergave in het admin-paneel, zodat preview
// en live pagina altijd exact hetzelfde resultaat tonen.
//
// BELANGRIJK over media: een blok bevat NOOIT de foto/bestand-data zelf,
// alleen een verwijzing (`mediaId`) naar een document in de Firestore-
// collectie "media" (waar de data wél staat, zie admin/js/media-picker.js).
// Dat is bewust zo: Firestore-documenten mogen max. ~1 MB zijn, en een
// pagina met meerdere foto's zou die grens al snel raken als de foto's zelf
// in de pagina-tekst zouden staan. `renderBlocks` heeft daarom een
// `mediaMap` nodig — een object `{ [mediaId]: mediaDocument }` dat van
// tevoren is opgehaald (zie `collectMediaIds` + `fetchMediaMap`, gebruikt
// door app.js en editor-core.js).
//
// Vereist dat DOMPurify globaal beschikbaar is (geladen via <script> tag,
// zie index.html/editor.html) — dat is de bibliotheek die
// tekst-HTML opschoont zodat een bezoeker nooit kwaadaardige scripts via
// een tekstblok kan uitvoeren.

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    node.setAttribute(key, value);
  }
  return node;
}

// Links van het type "file" verwijzen naar een mediaId, niet naar een kant-
// en-klare URL — die moet dus altijd via mediaMap opgezocht worden. Alle
// andere linktypes zijn wel direct om te zetten naar een href.
function resolveLink(link) {
  if (!link || !link.value) return "#";
  switch (link.type) {
    case "page": return `/${link.value.replace(/^\//, "")}`;
    case "email": return `mailto:${link.value}`;
    case "phone": return `tel:${link.value.replace(/\s+/g, "")}`;
    case "anchor": return `#${link.value.replace(/^#/, "")}`;
    case "file": return `media:${link.value}`; // wordt hieronder altijd nog vertaald
    case "external":
    default: return link.value;
  }
}

/**
 * Zet <a href> en target/rel op `node` voor een link-object. Lost het
 * speciale "file"-linktype op via mediaMap (en voegt een download-attribuut
 * toe — nodig omdat browsers een rechtstreekse navigatie naar een
 * data:-URL blokkeren, downloads zijn wel toegestaan).
 */
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
    ALLOWED_TAGS: ["b","strong","i","em","u","s","strike","sup","sub","a","br","p","ul","ol","li","blockquote","hr","span"],
    ALLOWED_ATTR: ["href","target","rel","style"],
    // Staat naast de gebruikelijke veilige schema's (http, https, mailto,
    // tel) ook ons eigen "media:<id>"-schema toe, dat hieronder na het
    // sanitizen wordt vertaald naar een echte downloadlink.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|media):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  };
  if (window.DOMPurify) return window.DOMPurify.sanitize(html, config);
  const p = document.createElement("p");
  p.textContent = html.replace(/<[^>]*>/g, "");
  return p.outerHTML;
}

/** Vertaalt <a href="media:xyz"> links (ingevoegd via de rijke-tekst-editor) naar echte downloadlinks. */
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

function renderTextBlock(block, mediaMap) {
  const wrap = el("div", `block-text align-${block.align || "left"}`);
  wrap.innerHTML = sanitize(block.html || "");
  resolveMediaLinksInPlace(wrap, mediaMap);
  return wrap;
}

function renderHeadingBlock(block) {
  const level = Math.min(6, Math.max(1, block.level || 2));
  const heading = el(`h${level}`, `block-heading align-${block.align || "left"}`);
  heading.textContent = block.text || "";
  if (block.anchorId) heading.id = block.anchorId;
  return heading;
}

function renderImageBlock(block, mediaMap) {
  const media = mediaMap[block.mediaId];
  const figure = el("figure", `block-image align-${block.align || "center"}`);
  if (!media) { figure.innerHTML = `<p class="state-message">Afbeelding niet gevonden.</p>`; return figure; }
  if (block.widthPercent) figure.style.maxWidth = `${block.widthPercent}%`;
  let imgHolder = figure;
  if (block.link && block.link.value) {
    const a = el("a");
    applyLink(a, block.link, mediaMap);
    figure.appendChild(a);
    imgHolder = a;
  }
  const img = el("img", null, {
    src: media.url,
    alt: block.alt || media.alt || "",
    loading: "lazy",
    width: media.width || null,
    height: media.height || null,
  });
  imgHolder.appendChild(img);
  if (block.caption) {
    const cap = el("figcaption");
    cap.textContent = block.caption;
    figure.appendChild(cap);
  }
  return figure;
}

function renderGalleryBlock(block, mediaMap) {
  const grid = el("div", "block-gallery");
  (block.images || []).forEach((entry) => {
    const media = mediaMap[entry.mediaId];
    if (!media) return;
    const img = el("img", null, { src: media.url, alt: entry.alt || media.alt || "", loading: "lazy" });
    grid.appendChild(img);
  });
  return grid;
}

function renderButtonBlock(block, mediaMap) {
  const wrap = el("div", `block-button align-${block.align || "left"}`);
  const a = el("a", `btn ${block.style === "outline" ? "btn--outline" : ""}`.trim());
  applyLink(a, block.link, mediaMap);
  a.textContent = block.text || "Klik hier";
  wrap.appendChild(a);
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
  if (!media) {
    const p = document.createElement("p");
    p.className = "state-message";
    p.textContent = "Bestand niet gevonden.";
    return p;
  }
  const a = el("a", "block-file", { href: media.url, download: media.name || "bestand" });
  const icon = el("span", "block-file__icon");
  icon.textContent = "📄";
  const textWrap = el("span");
  const name = el("span", "block-file__name");
  name.textContent = block.label || media.name || "Bekijk het document";
  const meta = el("span", "block-file__meta");
  meta.textContent = [media.contentType, formatFileSize(media.size)].filter(Boolean).join(" · ");
  textWrap.appendChild(name);
  textWrap.appendChild(meta);
  a.appendChild(icon);
  a.appendChild(textWrap);
  return a;
}

function renderQuoteBlock(block) {
  const quote = el("blockquote", "block-quote");
  const p = document.createElement("p");
  p.textContent = block.text || "";
  quote.appendChild(p);
  if (block.cite) {
    const cite = el("cite");
    cite.textContent = block.cite;
    quote.appendChild(cite);
  }
  return quote;
}

function renderDividerBlock() {
  return el("hr", "block-divider");
}

function renderSpacerBlock(block) {
  const spacer = el("div", "block-spacer");
  spacer.style.height = `${block.height || 40}px`;
  return spacer;
}

function renderColumnsBlock(block, mediaMap) {
  const wrap = el("div", "block-columns", { "data-columns": block.columns || 2 });
  (block.items || []).forEach((column) => {
    const col = el("div", "block-column");
    renderBlocks(column?.blocks || [], col, mediaMap);
    wrap.appendChild(col);
  });
  return wrap;
}

function renderEmbedBlock(block) {
  const wrap = el("div", "block-embed");
  const iframe = el("iframe", null, {
    src: block.url,
    title: block.title || "Ingesloten inhoud",
    allowfullscreen: "true",
    loading: "lazy",
  });
  wrap.appendChild(iframe);
  return wrap;
}

function renderFaqBlock(block) {
  const wrap = el("div", "block-faq");
  (block.items || []).forEach((item) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = item.question || "";
    const answer = document.createElement("div");
    answer.textContent = item.answer || "";
    details.appendChild(summary);
    details.appendChild(answer);
    wrap.appendChild(details);
  });
  return wrap;
}

function renderHeroBlock(block, mediaMap) {
  const section = el("section", "hero");
  const inner = el("div", "hero__inner");
  const textCol = el("div", "hero__text");
  if (block.eyebrow) {
    const eyebrow = el("p", "hero__eyebrow");
    eyebrow.textContent = block.eyebrow;
    textCol.appendChild(eyebrow);
  }
  const title = el("h1", "hero__title");
  title.textContent = block.title || "";
  textCol.appendChild(title);
  if (block.lead) {
    const lead = el("p", "hero__lead");
    lead.textContent = block.lead;
    textCol.appendChild(lead);
  }
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
    const img = el("img", null, { src: media.url, alt: block.imageAlt || media.alt || "" });
    imgWrap.appendChild(img);
    inner.appendChild(imgWrap);
  }
  section.appendChild(inner);
  return section;
}

function renderContactFormBlock(block) {
  const wrap = el("form", "block-contact-form", { "data-contact-form": "true", novalidate: "true" });
  const nameField = el("div", "form-field");
  nameField.innerHTML = `<label for="cf-name">Naam</label><input id="cf-name" name="name" type="text" required autocomplete="name">`;
  const emailField = el("div", "form-field");
  emailField.innerHTML = `<label for="cf-email">E-mailadres</label><input id="cf-email" name="email" type="email" required autocomplete="email">`;
  const messageField = el("div", "form-field");
  messageField.innerHTML = `<label for="cf-message">Bericht</label><textarea id="cf-message" name="message" rows="5" required></textarea>`;
  const honeypot = el("input", null, { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  honeypot.style.position = "absolute";
  honeypot.style.left = "-9999px";
  const submit = el("button", "btn", { type: "submit" });
  submit.textContent = block.buttonText || "Versturen";
  const status = el("p", "form-status", { role: "status" });
  wrap.appendChild(nameField);
  wrap.appendChild(emailField);
  wrap.appendChild(messageField);
  wrap.appendChild(honeypot);
  wrap.appendChild(submit);
  wrap.appendChild(status);
  return wrap;
}

function renderTilesBlock(block, mediaMap) {
  const grid = el("div", "tile-grid");
  (block.items || []).forEach((item) => {
    const tile = el("div", "tile");
    const h3 = document.createElement("h3");
    h3.textContent = item.title || "";
    const p = document.createElement("p");
    p.textContent = item.text || "";
    tile.appendChild(h3);
    tile.appendChild(p);
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

const RENDERERS = {
  hero: renderHeroBlock,
  tiles: renderTilesBlock,
  text: renderTextBlock,
  "contact-form": renderContactFormBlock,
  heading: renderHeadingBlock,
  image: renderImageBlock,
  gallery: renderGalleryBlock,
  button: renderButtonBlock,
  file: renderFileBlock,
  quote: renderQuoteBlock,
  divider: renderDividerBlock,
  spacer: renderSpacerBlock,
  columns: renderColumnsBlock,
  embed: renderEmbedBlock,
  faq: renderFaqBlock,
};

/**
 * @param {Array} blocks
 * @param {HTMLElement} container
 * @param {Object} mediaMap - { [mediaId]: {url, name, contentType, size, alt, width, height} }, van tevoren opgehaald met fetchMediaMap()
 */
export function renderBlocks(blocks, container, mediaMap = {}) {
  container.innerHTML = "";
  (blocks || []).forEach((block) => {
    const renderer = RENDERERS[block.type];
    if (!renderer) return;
    try {
      container.appendChild(renderer(block, mediaMap));
    } catch (err) {
      console.error("Kon blok niet renderen:", block, err);
    }
  });
}

/** Verzamelt recursief alle mediaId's waar een blokken-array naar verwijst (incl. binnen kolommen en rijke tekst). */
export function collectMediaIds(blocks, ids = new Set()) {
  (blocks || []).forEach((block) => {
    if (block.mediaId) ids.add(block.mediaId);
    if (block.imageMediaId) ids.add(block.imageMediaId);
    if (block.link?.type === "file" && block.link.value) ids.add(block.link.value);
    if (block.buttonLink?.type === "file" && block.buttonLink.value) ids.add(block.buttonLink.value);
    if (Array.isArray(block.images)) block.images.forEach((img) => { if (img.mediaId) ids.add(img.mediaId); });
    if (block.type === "tiles" && Array.isArray(block.items)) {
      block.items.forEach((item) => { if (item.link?.type === "file" && item.link.value) ids.add(item.link.value); });
    }
    if (block.type === "columns" && Array.isArray(block.items)) {
      block.items.forEach((column) => collectMediaIds(column?.blocks, ids));
    }
    if (block.type === "text" && block.html) {
      const matches = block.html.matchAll(/href="media:([^"]+)"/g);
      for (const m of matches) ids.add(m[1]);
    }
  });
  return ids;
}

export { resolveLink };
