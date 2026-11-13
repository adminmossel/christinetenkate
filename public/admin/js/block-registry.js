// block-registry.js
// DE ENIGE PLEK waar een component wordt gedefinieerd voor de editor:
//   label, categorie, pictogram, zoekwoorden, beginwaarden (defaults) en
//   het "veldenschema" waaruit het bewerkpaneel automatisch wordt opgebouwd.
//
// Een nieuw component toevoegen = hier één regel/blok toevoegen + een
// renderfunctie in /js/render.js + (eventueel) CSS in /css/blocks.css.
//
// Veldtypes (zie editor-fields.js):
//   text, textarea, rich, select, segmented, range, toggle, color,
//   media, link, icon, items (herhaalbare lijst), help
// Optioneel per veld: showIf(obj, parent) → alleen tonen als dit waar is.

import { ICON_PATHS, ICON_OPTIONS, SOCIAL_NETWORKS } from "../../js/render.js";

let idCounter = 0;
export function newId() {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter}${Math.random().toString(36).slice(2, 5)}`;
}

// ---------- Pictogrammen voor de catalogus ----------
const EXTRA_ICONS = {
  text: "M4 7V4h16v3M9 20h6M12 4v16",
  image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  columns: "M3 3h18v18H3zM12 3v18",
  layout: "M3 3h18v18H3zM3 9h18M9 21V9",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  quote: "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  play: "M5 3l14 9-14 9z",
  button: "M3 8h18v8H3zM8 12h8",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  stats: "M18 20V10M12 20V4M6 20v-6",
  table: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18",
  timeline: "M12 2v20M7 6h5M12 12h5M7 18h5",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  layers: "M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  megaphone: "M3 11l18-8v18L3 13zM11.6 16.8a3 3 0 1 1-5.8-1.6",
  share: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98",
  tabs: "M3 8h18M3 4h6v4H3zM3 8v12h18V8",
  box: "M3 3h18v18H3z",
  minus: "M5 12h14",
  spacer: "M7 4v16M17 4v16M7 12h10",
  banner: "M3 5h18v14H3zM3 15l5-4 4 3 3-2 6 4",
  split: "M3 4h18v16H3zM12 4v16M5 8h4M5 12h4",
};
export function typeIconSvg(type, size = 20) {
  const def = BLOCKS[type];
  const d = EXTRA_ICONS[def?.icon] || ICON_PATHS[def?.icon] || EXTRA_ICONS.box;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// ---------- Veld-helpers (houden het schema kort) ----------
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const F = {
  text: (key, label, x = {}) => ({ type: "text", key, label, ...x }),
  area: (key, label, x = {}) => ({ type: "textarea", key, label, rows: 3, ...x }),
  rich: (key, label = "Tekst") => ({ type: "rich", key, label }),
  select: (key, label, options, x = {}) => ({ type: "select", key, label, options: opt(options), ...x }),
  seg: (key, label, options, x = {}) => ({ type: "segmented", key, label, options: opt(options), ...x }),
  range: (key, label, min, max, x = {}) => ({ type: "range", key, label, min, max, step: 1, ...x }),
  toggle: (key, label, x = {}) => ({ type: "toggle", key, label, ...x }),
  color: (key, label, x = {}) => ({ type: "color", key, label, ...x }),
  media: (key, label, x = {}) => ({ type: "media", key, label, accept: "image", ...x }),
  link: (key, label = "Link") => ({ type: "link", key, label }),
  icon: (key, label = "Pictogram") => ({ type: "icon", key, label }),
  items: (key, label, itemLabel, fields, factory, x = {}) => ({ type: "items", key, label, itemLabel, fields, factory, ...x }),
  help: (text) => ({ type: "help", text }),
};

const ALIGN = [["left", "Links"], ["center", "Midden"], ["right", "Rechts"]];
const RATIOS = [["auto", "Automatisch"], ["1:1", "Vierkant"], ["4:3", "4 : 3"], ["3:2", "3 : 2"], ["16:9", "16 : 9"], ["3:4", "Staand 3 : 4"]];
const COLS_1_4 = F.range("columns", "Aantal kolommen", 1, 4);
const BTN_STYLES = [["solid", "Gevuld"], ["outline", "Omlijnd"], ["soft", "Zacht"], ["link", "Tekstlink"]];

// ---------- De catalogus ----------
export const GROUPS = ["Tekst", "Secties", "Media", "Kaarten & lijsten", "Interactie", "Info", "Layout"];

export const BLOCKS = {
  // ===== Tekst =====
  heading: {
    label: "Titel", group: "Tekst", icon: "text", keywords: ["kop", "titel", "heading", "h1", "h2"],
    defaults: () => ({ level: 2, text: "Nieuwe titel", align: "left", eyebrow: "" }),
    fields: [F.text("text", "Titel"), F.select("level", "Niveau", [[1, "H1 — hoofdtitel"], [2, "H2 — grote kop"], [3, "H3"], [4, "H4"], [5, "H5"], [6, "H6"]], { number: true }),
      F.seg("align", "Uitlijning", ALIGN), F.text("eyebrow", "Kleine tekst erboven (optioneel)"), F.text("anchorId", "Anker-ID voor links binnen de pagina (optioneel)")],
  },
  text: {
    label: "Tekst", group: "Tekst", icon: "text", keywords: ["tekst", "paragraaf", "alinea", "text"],
    defaults: () => ({ html: "<p>Nieuwe tekst… Dubbelklik op het canvas om direct te typen.</p>", align: "left" }),
    fields: [F.rich("html"), F.seg("align", "Uitlijning", ALIGN)],
  },
  quote: {
    label: "Citaat", group: "Tekst", icon: "quote", keywords: ["quote", "citaat", "uitspraak"],
    defaults: () => ({ text: "Een mooi citaat…", cite: "", variant: "classic" }),
    fields: [F.area("text", "Citaat"), F.text("cite", "Bron (optioneel)"), F.select("variant", "Uiterlijk", [["classic", "Klassiek"], ["big", "Groot, gecentreerd"], ["plain", "Eenvoudig"]])],
  },
  list: {
    label: "Lijst met pictogrammen", group: "Tekst", icon: "list", keywords: ["lijst", "opsomming", "checklist", "bullets"],
    defaults: () => ({ icon: "check", columns: 1, items: [{ text: "Eerste punt" }, { text: "Tweede punt" }, { text: "Derde punt" }] }),
    fields: [F.items("items", "Punten", "text", [F.text("text", "Tekst")], () => ({ text: "Nieuw punt" })),
      F.select("icon", "Pictogram", [...ICON_OPTIONS.map((i) => [i, i]), ["number", "Nummers"], ["dot", "Bolletje"]]), F.range("columns", "Kolommen", 1, 3)],
  },
  callout: {
    label: "Infobox", group: "Tekst", icon: "info", keywords: ["info", "tip", "waarschuwing", "melding", "notitie", "callout"],
    defaults: () => ({ variant: "info", title: "Goed om te weten", text: "Hier staat een belangrijke mededeling." }),
    fields: [F.select("variant", "Soort", [["info", "Informatie"], ["tip", "Tip"], ["warning", "Let op"], ["success", "Gelukt / positief"]]), F.text("title", "Titel"), F.area("text", "Tekst")],
  },
  table: {
    label: "Tabel", group: "Tekst", icon: "table", keywords: ["tabel", "table", "rijen", "prijslijst"],
    defaults: () => ({ columns: 3, header: true, striped: true, rows: [{ c1: "Onderwerp", c2: "Omschrijving", c3: "Prijs" }, { c1: "Rij 1", c2: "…", c3: "€ 0" }, { c1: "Rij 2", c2: "…", c3: "€ 0" }] }),
    fields: [F.range("columns", "Kolommen", 2, 4), F.toggle("header", "Eerste rij is een kop"), F.toggle("striped", "Om-en-om gekleurde rijen"),
      F.items("rows", "Rijen", "c1", [F.text("c1", "Kolom 1"), F.text("c2", "Kolom 2"), F.text("c3", "Kolom 3", { showIf: (_i, p) => p.columns >= 3 }), F.text("c4", "Kolom 4", { showIf: (_i, p) => p.columns >= 4 })], () => ({ c1: "", c2: "", c3: "", c4: "" }))],
  },

  // ===== Secties =====
  hero: {
    label: "Hero (kop met afbeelding)", group: "Secties", icon: "split", keywords: ["hero", "header", "openingsbeeld", "welkom"],
    defaults: () => ({ eyebrow: "", title: "Welkom", lead: "Een korte introductie die de bezoeker verwelkomt.", imageMediaId: null, imageAlt: "", imageSide: "right", buttonText: "", buttonLink: null }),
    fields: [F.text("eyebrow", "Kleine tekst boven de titel"), F.text("title", "Titel"), F.area("lead", "Introductietekst"),
      F.media("imageMediaId", "Afbeelding"), F.text("imageAlt", "Alt-tekst afbeelding"), F.seg("imageSide", "Afbeelding staat", [["left", "Links"], ["right", "Rechts"]]),
      F.text("buttonText", "Knoptekst (optioneel)"), F.link("buttonLink", "Knop-link")],
  },
  banner: {
    label: "Banner met grote foto", group: "Secties", icon: "banner", keywords: ["banner", "cover", "foto", "achtergrond", "hero", "groot"],
    defaults: () => ({ mediaId: null, overlay: 45, overlayColor: "#000000", minHeight: 460, align: "center", valign: "center", eyebrow: "", title: "Een krachtige titel", lead: "Een korte ondersteunende tekst over de foto.", buttonText: "Meer informatie", buttonLink: null, button2Text: "", button2Link: null }),
    fields: [F.media("mediaId", "Achtergrondfoto"), F.range("overlay", "Donkerte over de foto (%)", 0, 90), F.color("overlayColor", "Kleur van de sluier"),
      F.range("minHeight", "Hoogte (px)", 240, 800, { step: 10 }), F.seg("align", "Tekst horizontaal", ALIGN), F.seg("valign", "Tekst verticaal", [["top", "Boven"], ["center", "Midden"], ["bottom", "Onder"]]),
      F.text("eyebrow", "Kleine tekst boven de titel"), F.text("title", "Titel"), F.area("lead", "Tekst"),
      F.text("buttonText", "Knop 1 — tekst"), F.link("buttonLink", "Knop 1 — link"), F.text("button2Text", "Knop 2 — tekst"), F.link("button2Link", "Knop 2 — link")],
  },
  cta: {
    label: "Call-to-action", group: "Secties", icon: "megaphone", keywords: ["cta", "actie", "oproep", "banner", "knop"],
    defaults: () => ({ title: "Klaar om contact op te nemen?", text: "Stuur een bericht en ik neem snel contact met je op.", align: "center", buttonText: "Neem contact op", buttonLink: null, button2Text: "", button2Link: null,
      style: { bg: "color", bgColor: "#2F4A3E", boxed: true, padTop: 48, padBottom: 48 } }),
    fields: [F.text("title", "Titel"), F.area("text", "Tekst"), F.seg("align", "Uitlijning", [["left", "Links"], ["center", "Midden"]]),
      F.text("buttonText", "Knop 1 — tekst"), F.link("buttonLink", "Knop 1 — link"), F.text("button2Text", "Knop 2 — tekst"), F.link("button2Link", "Knop 2 — link")],
  },
  "image-text": {
    label: "Afbeelding + tekst", group: "Secties", icon: "split", keywords: ["afbeelding tekst", "foto naast tekst", "uitgelicht", "split"],
    defaults: () => ({ mediaId: null, alt: "", imageSide: "left", valign: "center", ratio: "4:3", eyebrow: "", title: "Titel van deze sectie", text: "Vertel hier iets over dit onderwerp. Laat een lege regel tussen alinea's om een nieuwe alinea te beginnen.", buttonText: "", buttonLink: null, buttonStyle: "solid" }),
    fields: [F.media("mediaId", "Afbeelding"), F.text("alt", "Alt-tekst"), F.seg("imageSide", "Afbeelding staat", [["left", "Links"], ["right", "Rechts"]]), F.select("ratio", "Vorm afbeelding", RATIOS),
      F.seg("valign", "Verticaal", [["top", "Boven"], ["center", "Midden"]]), F.text("eyebrow", "Kleine tekst erboven"), F.text("title", "Titel"), F.area("text", "Tekst", { rows: 6 }),
      F.text("buttonText", "Knoptekst (optioneel)"), F.link("buttonLink", "Knop-link"), F.select("buttonStyle", "Knopstijl", BTN_STYLES)],
  },

  // ===== Media =====
  image: {
    label: "Afbeelding", group: "Media", icon: "image", keywords: ["afbeelding", "foto", "plaatje", "image"],
    defaults: () => ({ mediaId: null, alt: "", caption: "", align: "center", widthPercent: 100, ratio: "auto", radius: "md" }),
    fields: [F.media("mediaId", "Afbeelding", { crop: true }), F.text("alt", "Alt-tekst (screenreaders en SEO)"), F.text("caption", "Bijschrift"),
      F.seg("align", "Uitlijning", [["left", "Links"], ["center", "Midden"], ["right", "Rechts"]]), F.range("widthPercent", "Breedte (%)", 20, 100), F.select("ratio", "Vorm", RATIOS),
      F.select("radius", "Hoeken", [["none", "Scherp"], ["sm", "Licht afgerond"], ["md", "Afgerond"], ["lg", "Sterk afgerond"], ["round", "Rond / ovaal"]]), F.link("link", "Link bij klik (optioneel)")],
  },
  gallery: {
    label: "Galerij", group: "Media", icon: "grid", keywords: ["galerij", "fotos", "gallery", "raster"],
    defaults: () => ({ columns: 3, ratio: "4:3", gap: 16, lightbox: true, images: [] }),
    fields: [F.items("images", "Foto’s", "alt", [F.media("mediaId", "Foto"), F.text("alt", "Alt-tekst")], () => ({ mediaId: null, alt: "" })),
      F.range("columns", "Kolommen", 1, 6), F.select("ratio", "Vorm foto’s", RATIOS), F.range("gap", "Ruimte tussen foto’s (px)", 0, 48), F.toggle("lightbox", "Foto vergroten bij klikken")],
  },
  carousel: {
    label: "Fotoslider", group: "Media", icon: "image", keywords: ["slider", "carrousel", "carousel", "slideshow"],
    defaults: () => ({ images: [] }),
    fields: [F.items("images", "Dia’s", "alt", [F.media("mediaId", "Foto"), F.text("alt", "Alt-tekst"), F.text("caption", "Bijschrift")], () => ({ mediaId: null, alt: "", caption: "" }))],
  },
  file: {
    label: "Bestand / download", group: "Media", icon: "file", keywords: ["bestand", "download", "pdf", "document"],
    defaults: () => ({ mediaId: null, label: "Bekijk het document" }),
    fields: [F.media("mediaId", "Bestand", { accept: "any" }), F.text("label", "Knoptekst")],
  },
  embed: {
    label: "Video / embed", group: "Media", icon: "play", keywords: ["video", "youtube", "vimeo", "embed"],
    defaults: () => ({ url: "", title: "", ratio: "16:9" }),
    fields: [F.text("url", "Video-URL", { placeholder: "Plak een gewone YouTube- of Vimeo-link" }), F.text("title", "Titel (toegankelijkheid)"), F.select("ratio", "Vorm", [["16:9", "16 : 9"], ["4:3", "4 : 3"], ["1:1", "Vierkant"], ["21:9", "Breed 21 : 9"]])],
  },
  map: {
    label: "Kaart / route", group: "Media", icon: "pin", keywords: ["kaart", "map", "route", "adres", "google"],
    defaults: () => ({ address: "", zoom: 14, height: 380, title: "Kaart" }),
    fields: [F.text("address", "Adres of plaatsnaam", { placeholder: "bijv. Dorpsstraat 1, Zwolle" }), F.range("zoom", "Inzoomen", 8, 18), F.range("height", "Hoogte (px)", 200, 700, { step: 10 })],
  },
  logos: {
    label: "Logo-balk", group: "Media", icon: "award", keywords: ["logo", "partners", "keurmerk", "samenwerking"],
    defaults: () => ({ title: "Bekend van", grayscale: true, images: [] }),
    fields: [F.text("title", "Kopje (optioneel)"), F.toggle("grayscale", "Logo’s in grijstinten"),
      F.items("images", "Logo’s", "alt", [F.media("mediaId", "Logo"), F.text("alt", "Naam"), F.link("link", "Link (optioneel)")], () => ({ mediaId: null, alt: "", link: null }))],
  },

  // ===== Kaarten & lijsten =====
  cards: {
    label: "Kaarten", group: "Kaarten & lijsten", icon: "grid", keywords: ["kaarten", "cards", "tegels", "blokken", "diensten"],
    defaults: () => ({ columns: 3, variant: "raised", imageRatio: "16:10".replace(":", ":"), items: [{ mediaId: null, title: "Eerste kaart", text: "Korte omschrijving.", link: null, linkText: "" }, { mediaId: null, title: "Tweede kaart", text: "Korte omschrijving.", link: null, linkText: "" }, { mediaId: null, title: "Derde kaart", text: "Korte omschrijving.", link: null, linkText: "" }] }),
    fields: [F.items("items", "Kaarten", "title", [F.media("mediaId", "Afbeelding (optioneel)"), F.text("title", "Titel"), F.area("text", "Tekst"), F.link("link", "Link"), F.text("linkText", "Linktekst", { placeholder: "Lees verder" })], () => ({ mediaId: null, title: "Nieuwe kaart", text: "", link: null, linkText: "" })),
      F.range("columns", "Kaarten naast elkaar", 1, 4), F.select("variant", "Uiterlijk", [["raised", "Met schaduw"], ["outline", "Met rand"], ["flat", "Vlak"]]), F.select("imageRatio", "Vorm afbeelding", RATIOS)],
  },
  features: {
    label: "Voordelen met pictogram", group: "Kaarten & lijsten", icon: "sparkle", keywords: ["voordelen", "features", "pictogram", "icoon", "diensten"],
    defaults: () => ({ columns: 3, align: "left", items: [{ icon: "heart", title: "Persoonlijk", text: "Altijd met aandacht." }, { icon: "book", title: "Ervaren", text: "Jarenlange kennis." }, { icon: "smile", title: "Plezierig", text: "Met een lach." }] }),
    fields: [F.items("items", "Voordelen", "title", [F.icon("icon"), F.text("title", "Titel"), F.area("text", "Tekst")], () => ({ icon: "star", title: "Nieuw voordeel", text: "" })), F.range("columns", "Naast elkaar", 1, 4), F.seg("align", "Uitlijning", [["left", "Links"], ["center", "Midden"]])],
  },
  team: {
    label: "Team / personen", group: "Kaarten & lijsten", icon: "users", keywords: ["team", "personen", "medewerkers", "over mij", "mensen"],
    defaults: () => ({ columns: 3, round: true, items: [{ mediaId: null, name: "Naam", role: "Functie", text: "" }] }),
    fields: [F.items("items", "Personen", "name", [F.media("mediaId", "Foto"), F.text("name", "Naam"), F.text("role", "Functie"), F.area("text", "Korte omschrijving")], () => ({ mediaId: null, name: "Nieuwe persoon", role: "", text: "" })), F.range("columns", "Naast elkaar", 1, 4), F.toggle("round", "Ronde foto’s")],
  },
  pricing: {
    label: "Prijzen / pakketten", group: "Kaarten & lijsten", icon: "dollar", keywords: ["prijzen", "pakketten", "tarieven", "pricing", "abonnement"],
    defaults: () => ({ columns: 3, items: [{ name: "Basis", price: "€ 25", period: "per uur", features: "Eerste voordeel\nTweede voordeel", buttonText: "Kies dit pakket", link: null, highlight: false, badge: "" }, { name: "Plus", price: "€ 45", period: "per uur", features: "Alles van Basis\nExtra voordeel", buttonText: "Kies dit pakket", link: null, highlight: true, badge: "Populair" }] }),
    fields: [F.items("items", "Pakketten", "name", [F.text("name", "Naam"), F.text("price", "Prijs"), F.text("period", "Per…"), F.area("features", "Voordelen (één per regel)", { rows: 4 }), F.text("buttonText", "Knoptekst"), F.link("link", "Knop-link"), F.toggle("highlight", "Uitgelicht pakket"), F.text("badge", "Label bij uitgelicht", { showIf: (i) => i.highlight })], () => ({ name: "Nieuw pakket", price: "€ 0", period: "", features: "", buttonText: "Kies dit pakket", link: null, highlight: false, badge: "" })), F.range("columns", "Naast elkaar", 1, 4)],
  },
  stats: {
    label: "Cijfers / tellers", group: "Kaarten & lijsten", icon: "stats", keywords: ["cijfers", "tellers", "statistiek", "getallen", "stats"],
    defaults: () => ({ columns: 3, animate: true, items: [{ prefix: "", value: "25", suffix: "+", label: "Jaar ervaring" }, { prefix: "", value: "500", suffix: "", label: "Tevreden cursisten" }, { prefix: "", value: "100", suffix: "%", label: "Met plezier" }] }),
    fields: [F.items("items", "Cijfers", "label", [F.text("prefix", "Voor het getal (bijv. €)"), F.text("value", "Getal"), F.text("suffix", "Na het getal (bijv. +, %)"), F.text("label", "Omschrijving")], () => ({ prefix: "", value: "0", suffix: "", label: "Omschrijving" })), F.range("columns", "Naast elkaar", 1, 4), F.toggle("animate", "Laten optellen bij in beeld komen")],
  },
  timeline: {
    label: "Tijdlijn", group: "Kaarten & lijsten", icon: "timeline", keywords: ["tijdlijn", "timeline", "geschiedenis", "agenda", "cv"],
    defaults: () => ({ items: [{ date: "2020", title: "Eerste gebeurtenis", text: "Wat gebeurde er?" }, { date: "2023", title: "Tweede gebeurtenis", text: "En daarna?" }] }),
    fields: [F.items("items", "Gebeurtenissen", "title", [F.text("date", "Datum / jaar"), F.text("title", "Titel"), F.area("text", "Tekst")], () => ({ date: "", title: "Nieuwe gebeurtenis", text: "" }))],
  },
  steps: {
    label: "Stappenplan", group: "Kaarten & lijsten", icon: "layers", keywords: ["stappen", "stappenplan", "werkwijze", "proces"],
    defaults: () => ({ columns: 3, items: [{ title: "Kennismaken", text: "We bespreken je wensen." }, { title: "Samen plannen", text: "We maken een plan." }, { title: "Aan de slag", text: "En dan beginnen we." }] }),
    fields: [F.items("items", "Stappen", "title", [F.text("title", "Titel"), F.area("text", "Tekst")], () => ({ title: "Nieuwe stap", text: "" })), F.range("columns", "Naast elkaar", 1, 4)],
  },
  reviews: {
    label: "Reviews / ervaringen", group: "Kaarten & lijsten", icon: "star", keywords: ["reviews", "ervaringen", "beoordelingen", "referenties"],
    defaults: () => ({ title: "Wat anderen zeggen", items: [{ name: "Naam", role: "", text: "Een mooie ervaring…", rating: 5 }] }),
    fields: [F.text("title", "Titel boven het blok"), F.items("items", "Reviews", "name", [F.text("name", "Naam"), F.text("role", "Functie / organisatie"), F.area("text", "Review", { rows: 4 }), F.select("rating", "Sterren", [[5, "★★★★★"], [4, "★★★★☆"], [3, "★★★☆☆"], [2, "★★☆☆☆"], [1, "★☆☆☆☆"]], { number: true })], () => ({ name: "Naam", role: "", text: "", rating: 5 }))],
  },
  faq: {
    label: "Veelgestelde vragen", group: "Kaarten & lijsten", icon: "help", keywords: ["faq", "vragen", "accordeon", "uitklappen"],
    defaults: () => ({ variant: "lines", firstOpen: false, items: [{ question: "Een veelgestelde vraag?", answer: "Het antwoord hierop." }] }),
    fields: [F.items("items", "Vragen", "question", [F.text("question", "Vraag"), F.area("answer", "Antwoord", { rows: 4 })], () => ({ question: "Nieuwe vraag?", answer: "" })), F.select("variant", "Uiterlijk", [["lines", "Met lijnen"], ["cards", "Als kaarten"]]), F.toggle("firstOpen", "Eerste vraag standaard open")],
  },
  tabs: {
    label: "Tabbladen", group: "Kaarten & lijsten", icon: "tabs", keywords: ["tabs", "tabbladen", "tab"],
    defaults: () => ({ items: [{ title: "Eerste tab", text: "Inhoud van de eerste tab." }, { title: "Tweede tab", text: "Inhoud van de tweede tab." }] }),
    fields: [F.items("items", "Tabbladen", "title", [F.text("title", "Tabnaam"), F.area("text", "Inhoud", { rows: 5 })], () => ({ title: "Nieuwe tab", text: "" }))],
  },
  tiles: {
    label: "Tegels (eenvoudig)", group: "Kaarten & lijsten", icon: "grid", keywords: ["tegels", "tiles", "samenvatting"],
    defaults: () => ({ items: [{ title: "Titel", text: "Korte omschrijving.", link: null }] }),
    fields: [F.items("items", "Tegels", "title", [F.text("title", "Titel"), F.area("text", "Tekst"), F.link("link", "Link")], () => ({ title: "Titel", text: "Omschrijving", link: null }))],
  },

  // ===== Interactie =====
  button: {
    label: "Knop", group: "Interactie", icon: "button", keywords: ["knop", "button", "link"],
    defaults: () => ({ text: "Klik hier", link: null, align: "left", style: "solid", size: "md", fullWidth: false }),
    fields: [F.text("text", "Knoptekst"), F.link("link"), F.select("style", "Stijl", BTN_STYLES), F.seg("size", "Grootte", [["sm", "Klein"], ["md", "Normaal"], ["lg", "Groot"]]), F.seg("align", "Uitlijning", ALIGN), F.toggle("fullWidth", "Over de volle breedte")],
  },
  "button-group": {
    label: "Knoppenrij", group: "Interactie", icon: "button", keywords: ["knoppen", "buttons", "groep"],
    defaults: () => ({ align: "left", size: "md", items: [{ text: "Eerste knop", link: null, style: "solid" }, { text: "Tweede knop", link: null, style: "outline" }] }),
    fields: [F.items("items", "Knoppen", "text", [F.text("text", "Tekst"), F.link("link"), F.select("style", "Stijl", BTN_STYLES)], () => ({ text: "Knop", link: null, style: "solid" })), F.seg("align", "Uitlijning", ALIGN), F.seg("size", "Grootte", [["sm", "Klein"], ["md", "Normaal"], ["lg", "Groot"]])],
  },
  "contact-form": {
    label: "Contactformulier", group: "Interactie", icon: "mail", keywords: ["contact", "formulier", "bericht", "form"],
    defaults: () => ({ title: "", intro: "", buttonText: "Versturen" }),
    fields: [F.text("title", "Titel (optioneel)"), F.area("intro", "Introductie (optioneel)"), F.text("buttonText", "Knoptekst"), F.help("Verstuurde berichten lees je onder ‘Berichten’ in het menu.")],
  },

  // ===== Info =====
  hours: {
    label: "Openingstijden", group: "Info", icon: "clock", keywords: ["openingstijden", "tijden", "bereikbaar", "uren"],
    defaults: () => ({ title: "Bereikbaar", note: "", items: [{ day: "Maandag – vrijdag", time: "09:00 – 17:00" }, { day: "Weekend", time: "Gesloten" }] }),
    fields: [F.text("title", "Titel"), F.items("items", "Regels", "day", [F.text("day", "Dag(en)"), F.text("time", "Tijden")], () => ({ day: "", time: "" })), F.text("note", "Opmerking onderaan")],
  },
  "contact-card": {
    label: "Contactgegevens", group: "Info", icon: "phone", keywords: ["contactgegevens", "adres", "telefoon", "email"],
    defaults: () => ({ title: "Contact", address: "", phone: "", email: "", website: "" }),
    fields: [F.text("title", "Titel"), F.area("address", "Adres"), F.text("phone", "Telefoon"), F.text("email", "E-mail"), F.text("website", "Website")],
  },
  social: {
    label: "Social media", group: "Info", icon: "share", keywords: ["social", "facebook", "instagram", "linkedin", "volg"],
    defaults: () => ({ align: "left", items: [{ network: "facebook", url: "" }, { network: "instagram", url: "" }] }),
    fields: [F.items("items", "Kanalen", "network", [F.select("network", "Netwerk", Object.entries(SOCIAL_NETWORKS).map(([k, v]) => [k, v.label])), F.text("url", "Adres (link)")], () => ({ network: "website", url: "" })), F.seg("align", "Uitlijning", ALIGN)],
  },

  // ===== Layout =====
  columns: {
    label: "Kolommen", group: "Layout", icon: "columns", keywords: ["kolommen", "columns", "naast elkaar", "indeling"],
    defaults: () => ({ columns: 2, ratio: "equal", gap: 32, valign: "top", reverseMobile: false, items: [{ blocks: [] }, { blocks: [] }] }),
    normalize: (b) => { b.items = b.items || []; while (b.items.length < (b.columns || 2)) b.items.push({ blocks: [] }); },
    fields: [F.range("columns", "Aantal kolommen", 1, 4), F.select("ratio", "Verhouding", [["equal", "Gelijk"], ["1-2", "Smal – breed"], ["2-1", "Breed – smal"], ["1-3", "Heel smal – heel breed"], ["3-1", "Heel breed – heel smal"]], { showIf: (b) => b.columns === 2 }),
      F.range("gap", "Ruimte tussen kolommen (px)", 0, 100), F.seg("valign", "Verticaal", [["top", "Boven"], ["center", "Midden"], ["bottom", "Onder"], ["stretch", "Rek uit"]]), F.toggle("reverseMobile", "Op mobiel omgekeerde volgorde"),
      F.help("Sleep componenten vanuit de catalogus in de kolommen op het canvas.")],
  },
  group: {
    label: "Vak (container)", group: "Layout", icon: "box", keywords: ["vak", "container", "sectie", "groep", "box"],
    defaults: () => ({ blocks: [], style: { bg: "color", bgColor: "#F1ECDF", boxed: true, padTop: 32, padBottom: 32 } }),
    fields: [F.help("Een vak is een container met eigen achtergrond en kleuren. Sleep componenten er op het canvas in. Verander achtergrond, rand en kleuren op het tabblad ‘Stijl’.")],
  },
  divider: {
    label: "Scheidingslijn", group: "Layout", icon: "minus", keywords: ["lijn", "scheiding", "divider", "streep"],
    defaults: () => ({ variant: "line", color: "", width: 100 }),
    fields: [F.select("variant", "Soort", [["line", "Lijn"], ["dashed", "Gestreept"], ["dots", "Stippen"], ["ornament", "Met ornament"]]), F.color("color", "Kleur"), F.range("width", "Breedte (%)", 10, 100)],
  },
  spacer: {
    label: "Ruimte", group: "Layout", icon: "spacer", keywords: ["ruimte", "witruimte", "spacer", "afstand"],
    defaults: () => ({ height: 48 }),
    fields: [F.range("height", "Hoogte (px)", 8, 300)],
  },
};

// ---------- Hulpfuncties ----------
export function blockLabel(type) { return BLOCKS[type]?.label || type; }

export function createBlock(type) {
  const def = BLOCKS[type];
  if (!def) throw new Error(`Onbekend bloktype: ${type}`);
  const block = { id: newId(), type, ...JSON.parse(JSON.stringify(def.defaults())) };
  if (def.normalize) def.normalize(block);
  return block;
}

/** Kind-lijsten van een blok (kolommen en vakken bevatten zelf weer blokken). */
export function childLists(block) {
  if (block.type === "columns") {
    block.items = block.items || [];
    const n = block.columns || 2;
    while (block.items.length < n) block.items.push({ blocks: [] });
    return block.items.slice(0, n).map((c, slot) => { c.blocks = c.blocks || []; return { slot, list: c.blocks }; });
  }
  if (block.type === "group") { block.blocks = block.blocks || []; return [{ slot: 0, list: block.blocks }]; }
  return [];
}

/** Diepe kopie met nieuwe id's (ook voor geneste blokken). */
export function cloneBlock(block) {
  const copy = JSON.parse(JSON.stringify(block));
  const reid = (b) => { b.id = newId(); childLists(b).forEach(({ list }) => list.forEach(reid)); (b.items || []).forEach((i) => i && i.blocks && i.blocks.forEach(reid)); };
  reid(copy);
  return copy;
}

export const CONTAINER_TYPES = ["columns", "group"];
