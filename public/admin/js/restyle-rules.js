// restyle-rules.js
// Zet de BESTAANDE opbouw van een pagina om naar de nieuwe opmaak, zonder ook
// maar één woord te veranderen. Er wordt uitsluitend:
//   - gestyled (achtergrondbanden, kaarten, afrondingen, schaduwen, breedtes);
//   - van component gewisseld waarbij dezelfde tekst blijft staan
//     (tegels → kaarten, losse opsomming → pictogramlijst, citaat → groot citaat);
//   - gegroepeerd (elk hoofdstuk komt in een eigen "vak" met een achtergrond);
//   - gesplitst (een lange tekst met tussenkoppen wordt koppen + tekstblokken).
// Er wordt NIETS toegevoegd, herschreven of weggehaald, behalve lege
// tussenruimtes en scheidingslijnen (die worden vervangen door de banden).
//
// De controle of de tekst echt gelijk is, gebeurt in restyle.js (op de
// daadwerkelijke weergave), en een pagina wordt alleen omgezet als die klopt.

import { newId } from "./block-registry.js";
import { renderBlocks, collectMediaIds } from "../../js/render.js";

// ---------- kleur-hulpjes ----------
const clamp8 = (n) => Math.max(0, Math.min(255, Math.round(n)));
function rgb(hex) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const h = (v) => clamp8(v).toString(16).padStart(2, "0");
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

/** Palet uit de site-instellingen (of de standaardkleuren). */
export function buildPalette(colors = {}) {
  const primary = colors.primary || "#2F4A3E";
  const accent = colors.accent || "#E2963F";
  const bg = colors.bg || "#FBF9F4";
  return {
    primary, accent, bg,
    white: "#FFFFFF",
    soft: mix(bg, "#FFFFFF", 0.35),         // rustige, lichte band
    wash1: mix(accent, "#FFFFFF", 0.82),    // zachte kleurwas voor de kop van de pagina
    wash2: mix(bg, "#FFFFFF", 0.5),
  };
}

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
    if (items) out.push({ id: newId(), type: "list", icon: "check", columns: items.length >= 6 ? 2 : 1, items });
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
      return [{ id: b.id, type: "cards", columns: cardColumns((b.items || []).length), variant: "raised", imageRatio: "auto",
        items: (b.items || []).map((i) => ({ mediaId: null, title: i.title || "", text: i.text || "", link: i.link || null, linkText: "" })), ...(b.style ? { style: b.style } : {}) }];
    case "faq": return [{ ...b, variant: "cards", firstOpen: false }];
    case "quote": return [{ ...b, variant: "big" }];
    case "image": return [{ ...b, radius: b.radius || "md" }];
    case "gallery": return [{ ...b, ratio: b.ratio || "4:3", gap: b.gap ?? 16, lightbox: b.lightbox !== false }];
    case "contact-form":
      return [b.style ? b : { ...b, style: { bg: "color", bgColor: "#FFFFFF", boxed: true, radius: 22, shadow: "md", padTop: 32, padBottom: 32, width: "narrow" } }];
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

// ---------- hoofdstukken → banden ----------
const NARROW_OK = new Set(["heading", "text", "list", "quote", "faq", "callout", "button", "button-group", "image", "table", "file"]);

function wrapColumnCards(block, cardBg) {
  if (block.type !== "columns") return;
  (block.items || []).forEach((col) => {
    const blocks = col.blocks || [];
    if (!blocks.length || blocks.some((b) => b.type === "group")) return;
    col.blocks = [{ id: newId(), type: "group", blocks, style: { bg: "color", bgColor: cardBg, radius: 18, shadow: "soft", padTop: 24, padBottom: 24 } }];
  });
}

export function restyleBlocks(blocks, pal) {
  const flat = transformList(JSON.parse(JSON.stringify(blocks || [])));
  const content = flat.filter((b) => b.type !== "spacer" && b.type !== "divider");

  // 1. indelen in hoofdstukken
  const sections = [];
  let cur = null;
  content.forEach((b, idx) => {
    if (b.type === "hero") { sections.push({ hero: b, last: idx === content.length - 1 }); cur = null; return; }
    const startsNew = b.type === "heading" && (b.level === 2 || (b.level === 1 && cur && cur.blocks.length > 0 && cur.blocks.some((x) => x.type !== "heading")));
    if (!cur || startsNew) { cur = { blocks: [] }; sections.push(cur); }
    cur.blocks.push(b);
  });

  // 2. elk hoofdstuk een band
  let bandIndex = 0;
  const out = [];
  sections.forEach((s, i) => {
    if (s.hero) {
      const hero = s.hero;
      if (!hero.style) {
        hero.style = i === 0
          ? { bg: "gradient", bgColor: pal.wash1, bgColor2: pal.wash2, bgAngle: 135, padTop: 64, padBottom: 64 }
          : s.last
            ? { bg: "color", bgColor: pal.primary, padTop: 64, padBottom: 64 }
            : { bg: "color", bgColor: pal.soft, padTop: 56, padBottom: 56 };
      }
      out.push(hero);
      return;
    }
    const isFirst = out.length === 0;
    const band = isFirst ? "intro" : bandIndex % 2 === 0 ? "white" : "soft";
    if (!isFirst) bandIndex++;
    const bgColor = band === "white" ? pal.white : pal.soft;
    const cardBg = band === "white" ? pal.soft : pal.white;
    s.blocks.forEach((b) => wrapColumnCards(b, cardBg));
    const narrow = s.blocks.every((b) => NARROW_OK.has(b.type));
    const style = band === "intro"
      ? { bg: "gradient", bgColor: pal.wash1, bgColor2: pal.wash2, bgAngle: 135, padTop: 56, padBottom: 48 }
      : { bg: "color", bgColor, padTop: 56, padBottom: 56 };
    if (narrow) style.width = "narrow";
    out.push({ id: newId(), type: "group", blocks: s.blocks, style });
  });
  return out;
}

/** Paginathema: alleen invullen als de pagina nog geen eigen thema heeft. */
export function restyleTheme(theme, pal) {
  if (theme && Object.keys(theme).length) return theme;
  return { bg: "color", bgColor: pal.soft };
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
