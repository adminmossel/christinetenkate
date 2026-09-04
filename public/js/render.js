// render.js
// Zet een array van "blocks" (de opbouw van een pagina, opgeslagen in
// Firestore) om naar echte, veilige HTML. Wordt gebruikt door zowel de
// publieke site als de voorbeeldweergave in het admin-paneel, zodat preview
// en live pagina altijd exact hetzelfde resultaat tonen.
//
// Vereist dat DOMPurify globaal beschikbaar is (geladen via <script> tag,
// zie index.html) — dat is de bibliotheek die tekst-HTML opschoont zodat
// een bezoeker nooit kwaadaardige scripts via een tekstblok kan uitvoeren.

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    node.setAttribute(key, value);
  }
  return node;
}

function resolveLink(link) {
  // link = { type: 'page'|'external'|'email'|'phone'|'file'|'anchor', value, newTab }
  if (!link || !link.value) return "#";
  switch (link.type) {
    case "page": return `/${link.value.replace(/^\//, "")}`;
    case "email": return `mailto:${link.value}`;
    case "phone": return `tel:${link.value.replace(/\s+/g, "")}`;
    case "anchor": return `#${link.value.replace(/^#/, "")}`;
    case "file":
    case "external":
    default: return link.value;
  }
}

function sanitize(html) {
  if (window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["b","strong","i","em","u","s","strike","sup","sub","a","br","p","ul","ol","li","blockquote","hr","span"],
      ALLOWED_ATTR: ["href","target","rel","style"],
    });
  }
  // Noodoplossing als DOMPurify niet geladen kon worden: platte tekst tonen
  // in plaats van HTML te renderen (veilig, maar zonder opmaak).
  const p = document.createElement("p");
  p.textContent = html.replace(/<[^>]*>/g, "");
  return p.outerHTML;
}

function renderTextBlock(block) {
  const wrap = el("div", `block-text align-${block.align || "left"}`);
  wrap.innerHTML = sanitize(block.html || "");
  return wrap;
}

function renderHeadingBlock(block) {
  const level = Math.min(6, Math.max(1, block.level || 2));
  const heading = el(`h${level}`, `block-heading align-${block.align || "left"}`);
  heading.textContent = block.text || "";
  if (block.anchorId) heading.id = block.anchorId;
  return heading;
}

function renderImageBlock(block) {
  const figure = el("figure", `block-image align-${block.align || "center"}`);
  if (block.widthPercent) figure.style.maxWidth = `${block.widthPercent}%`;
  let imgHolder = figure;
  if (block.link && block.link.value) {
    const a = el("a", null, { href: resolveLink(block.link), target: block.link.newTab ? "_blank" : null, rel: block.link.newTab ? "noopener" : null });
    figure.appendChild(a);
    imgHolder = a;
  }
  const img = el("img", null, {
    src: block.url,
    alt: block.alt || "",
    loading: "lazy",
    width: block.naturalWidth || null,
    height: block.naturalHeight || null,
  });
  imgHolder.appendChild(img);
  if (block.caption) {
    const cap = el("figcaption");
    cap.textContent = block.caption;
    figure.appendChild(cap);
  }
  return figure;
}

function renderGalleryBlock(block) {
  const grid = el("div", "block-gallery");
  (block.images || []).forEach((image) => {
    const img = el("img", null, { src: image.url, alt: image.alt || "", loading: "lazy" });
    grid.appendChild(img);
  });
  return grid;
}

function renderButtonBlock(block) {
  const wrap = el("div", `block-button align-${block.align || "left"}`);
  const a = el("a", `btn ${block.style === "outline" ? "btn--outline" : ""}`.trim(), {
    href: resolveLink(block.link),
    target: block.link?.newTab ? "_blank" : null,
    rel: block.link?.newTab ? "noopener" : null,
  });
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

function renderFileBlock(block) {
  const a = el("a", "block-file", { href: block.url, target: "_blank", rel: "noopener" });
  const icon = el("span", "block-file__icon");
  icon.textContent = "📄";
  const textWrap = el("span");
  const name = el("span", "block-file__name");
  name.textContent = block.label || block.name || "Bekijk het document";
  const meta = el("span", "block-file__meta");
  meta.textContent = [block.fileType, formatFileSize(block.size)].filter(Boolean).join(" · ");
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

function renderColumnsBlock(block) {
  const wrap = el("div", "block-columns", { "data-columns": block.columns || 2 });
  (block.items || []).forEach((columnBlocks) => {
    const col = el("div", "block-column");
    renderBlocks(columnBlocks || [], col);
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
    answer.innerHTML = sanitize(item.answer || "");
    details.appendChild(summary);
    details.appendChild(answer);
    wrap.appendChild(details);
  });
  return wrap;
}

function renderHeroBlock(block) {
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
    const a = el("a", "btn", { href: resolveLink(block.buttonLink) });
    a.textContent = block.buttonText;
    textCol.appendChild(a);
  }
  inner.appendChild(textCol);
  if (block.imageUrl) {
    const imgWrap = el("div", "hero__image");
    const img = el("img", null, { src: block.imageUrl, alt: block.imageAlt || "" });
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

function renderTilesBlock(block) {
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
      const a = el("a", null, { href: resolveLink(item.link) });
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

export function renderBlocks(blocks, container) {
  container.innerHTML = "";
  (blocks || []).forEach((block) => {
    const renderer = RENDERERS[block.type];
    if (!renderer) return;
    try {
      container.appendChild(renderer(block));
    } catch (err) {
      console.error("Kon blok niet renderen:", block, err);
    }
  });
}

export { resolveLink };
