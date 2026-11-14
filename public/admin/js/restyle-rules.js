// restyle-rules.js
// Zet de BESTAANDE opbouw van een pagina om naar de nieuwe opmaak "Studio".
//
// WAT BLIJFT: de volgorde, de hoofdstukken en álle tekst. Er wordt geen enkel
// woord herschreven, toegevoegd of weggehaald, en dat wordt per pagina
// gecontroleerd (verifyRestyle onderaan).
//
// WAT VERANDERT: kleuren, lettertype, achtergronden en de vorm van onderdelen:
//   - tegels → gekleurde blokken, opsomming → lijst met vierkante tekens
//   - elk hoofdstuk een lijn erboven; alleen bijzondere onderdelen (reviews,
//     kaarten, vragen, de afsluiting) krijgen een gekleurd vlak
//   - kolommen krijgen een gekleurde lijn erboven in plaats van een kader
//   - een lange tekst met tussenkoppen wordt gesplitst in koppen + tekst
//   - lege tussenruimtes en scheidingslijnen vervallen
// De kleuren komen uit de drie kleuren van het logo (groen, blauw, rood).

import { newId } from "./block-registry.js";
import { renderBlocks, collectMediaIds } from "../../js/render.js";

export const STUDIO = {
  navy: "#123A6B", ink: "#1A2433", red: "#CF3A2E", green: "#8FA800", greenLight: "#B9CF3F",
  paper: "#FBF6E9", paper2: "#F3EBD6", greenSoft: "#E6EDBE", blueSoft: "#D9E4F2",
};
/** Kleuren voor Instellingen → Kleuren (koppen/voettekst, knoppen/links, achtergrond). */
export const STUDIO_COLORS = { primary: STUDIO.navy, accent: STUDIO.red, bg: STUDIO.paper };

// ---------- tekst → pictogramlijst / splitsen ----------
function parse(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  return doc.body;
}

function listFromHtml(html) {
  const body = parse(html);
  const kids = [...body.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
  if (kids.length !== 1 || kids[0].tagName !== "UL") return null;
  const lis = [...kids[0].children];
  if (!lis.length || lis.some((li) => li.tagName !== "LI" || li.children.length)) return null;
  return lis.map((li) => ({ text: li.textContent.trim() }));
}

function textToBlocks(block) {
  const body = parse(block.html);
  const kids = [...body.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
  const isHeading = (n) => /^H[1-4]$/.test(n.tagName || "") && !n.children.length;
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const html = run.map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join("");
    const items = listFromHtml(html);
    if (items) out.push({ id: newId(), type: "list", icon: "square", columns: items.length >= 6 ? 2 : 1, items });
    else out.push({ ...block, id: newId(), html });
    run = [];
  };
  kids.forEach((n) => {
    if (isHeading(n)) {
      flush();
      out.push({ id: newId(), type: "heading", text: n.textContent.trim(), level: Number(n.tagName[1]), align: block.align || "left" });
    } else run.push(n);
  });
  flush();
  if (out.length === 1 && out[0].type === "text") { out[0].id = block.id; }
  return out;
}

// ---------- per blok ----------
function cardColumns(n) { return n <= 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : n === 4 ? 2 : 3; }

function transformOne(b) {
  switch (b.type) {
    case "tiles":
      return [{ id: b.id, type: "cards", columns: cardColumns((b.items || []).length), variant: "blocks", imageRatio: "auto",
        items: (b.items || []).map((i) => ({ mediaId: null, title: i.title || "", text: i.text || "", link: i.link || null, linkText: "" })), ...(b.style ? { style: b.style } : {}) }];
    case "faq": return [{ ...b, variant: "lines", firstOpen: false }];
    case "quote": return [{ ...b, variant: "big" }];
    case "image": return [{ ...b, radius: b.radius || "sm" }];
    case "gallery": return [{ ...b, ratio: b.ratio || "4:3", gap: b.gap ?? 16, lightbox: b.lightbox !== false }];
    case "contact-form":
      return [b.style ? b : { ...b, style: { bg: "color", bgColor: STUDIO.paper2, boxed: true, radius: 8, padTop: 36, padBottom: 36, width: "narrow" } }];
    case "text": return textToBlocks(b);
    case "columns": return [{ ...b, items: (b.items || []).map((c) => ({ ...c, blocks: transformList(c?.blocks || []) })) }];
    case "group": return [{ ...b, blocks: transformList(b.blocks || []) }];
    default: return [b];
  }
}

function transformList(list) {
  const out = [];
  list.forEach((b) => out.push(...transformOne(b)));
  // opeenvolgende knoppen → één knoppenrij
  const merged = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i].type === "button" && out[i + 1]?.type === "button") {
      const items = [];
      const first = out[i];
      while (out[i]?.type === "button") { items.push({ text: out[i].text, link: out[i].link || null, style: out[i].style || "solid" }); i++; }
      i--;
      merged.push({ id: newId(), type: "button-group", align: first.align || "left", size: "md", items });
    } else merged.push(out[i]);
  }
  return merged;
}

// ---------- hoofdstukken ----------
const NARROW_OK = new Set(["heading", "text", "list", "quote", "faq", "callout", "button", "button-group", "image", "table", "file"]);
const RULE_COLORS = [STUDIO.red, STUDIO.green, STUDIO.navy];

/** Kolommen: een gekleurde lijn erboven (rood, groen, blauw) i.p.v. een kader. */
function decorateColumns(block) {
  if (block.type !== "columns") return;
  (block.items || []).forEach((col, i) => {
    const blocks = col.blocks || [];
    if (!blocks.length || blocks.some((b) => b.type === "group")) return;
    col.blocks = [{ id: newId(), type: "group", blocks, style: { ruleTop: true, ruleWidth: 6, ruleColor: RULE_COLORS[i % 3] } }];
  });
}

function sectionStyle(kind, narrow) {
  const base = {
    intro: { bg: "color", bgColor: STUDIO.greenSoft, padTop: 72, padBottom: 64 },
    plain: { ruleTop: true, ruleWidth: 2, ruleColor: STUDIO.navy, padTop: 72, padBottom: 24 },
    cards: { bg: "color", bgColor: STUDIO.paper2, padTop: 72, padBottom: 80 },
    faq: { bg: "color", bgColor: STUDIO.blueSoft, padTop: 72, padBottom: 72 },
    reviews: { bg: "color", bgColor: STUDIO.navy, accentColor: STUDIO.greenLight, padTop: 80, padBottom: 80 },
  }[kind];
  const style = { ...base };
  if (narrow) style.width = "narrow";
  return style;
}

export function restyleBlocks(blocks) {
  const flat = transformList(JSON.parse(JSON.stringify(blocks || [])));
  const content = flat.filter((b) => b.type !== "spacer" && b.type !== "divider");

  // 1. indelen in hoofdstukken (nieuw hoofdstuk bij elke H2; reviews staan op zichzelf)
  const sections = [];
  let cur = null;
  content.forEach((b, idx) => {
    if (b.type === "hero") { sections.push({ hero: b, last: idx === content.length - 1 }); cur = null; return; }
    if (b.type === "reviews") { sections.push({ blocks: [b] }); cur = null; return; }
    const startsNew = b.type === "heading" && (b.level === 2 || (b.level === 1 && cur && cur.blocks.some((x) => x.type !== "heading")));
    if (!cur || startsNew) { cur = { blocks: [] }; sections.push(cur); }
    cur.blocks.push(b);
  });

  // 2. opmaak per hoofdstuk
  const out = [];
  sections.forEach((s, i) => {
    if (s.hero) {
      const hero = s.hero;
      if (!hero.style) {
        hero.style = i === 0
          ? { bg: "color", bgColor: STUDIO.greenSoft, padTop: 72, padBottom: 72 }
          : s.last
            ? { bg: "color", bgColor: STUDIO.red, accentColor: STUDIO.paper, padTop: 80, padBottom: 80 }
            : { bg: "color", bgColor: STUDIO.paper2, padTop: 64, padBottom: 64 };
      }
      out.push(hero);
      return;
    }
    s.blocks.forEach(decorateColumns);
    const types = s.blocks.map((b) => b.type);
    const hasCards = types.includes("cards");
    const kind = out.length === 0 && !hasCards ? "intro" : types.includes("reviews") ? "reviews" : types.includes("cards") ? "cards" : types.includes("faq") ? "faq" : "plain";
    out.push({ id: newId(), type: "group", blocks: s.blocks, style: sectionStyle(kind, types.every((t) => NARROW_OK.has(t))) });
  });
  return out;
}

/** Paginathema voor Studio. Wat de pagina al zelf heeft ingesteld, blijft staan. */
export function restyleTheme(theme) {
  return {
    bg: "color", bgColor: STUDIO.paper, font: "studio", look: "studio",
    textColor: STUDIO.ink, headingColor: STUDIO.navy, accentColor: STUDIO.red,
    ...(theme || {}),
  };
}

// ---------- controle: is alles echt hetzelfde gebleven? ----------
function fingerprint(blocks) {
  const box = document.createElement("div");
  renderBlocks(blocks, box, {}, {});
  return {
    text: box.textContent.replace(/\s+/g, ""),
    hrefs: [...box.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    media: [...collectMediaIds(blocks)].sort().join("|"),
  };
}

/** Vergelijkt zichtbare tekst (in volgorde), alle links en alle gekoppelde afbeeldingen. */
export function verifyRestyle(before, after) {
  const a = fingerprint(before), b = fingerprint(after);
  if (a.text !== b.text) {
    let i = 0;
    while (i < a.text.length && a.text[i] === b.text[i]) i++;
    return { ok: false, reason: `tekst verschilt bij “…${a.text.slice(Math.max(0, i - 20), i + 20)}…”` };
  }
  if (JSON.stringify(a.hrefs) !== JSON.stringify(b.hrefs)) return { ok: false, reason: "links verschillen" };
  if (a.media !== b.media) return { ok: false, reason: "afbeeldingen verschillen" };
  return { ok: true };
}
