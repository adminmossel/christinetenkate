// search.js
// Zoekfunctie over alle gepubliceerde pagina's — doorzoekt niet alleen de
// titel en meta-omschrijving, maar ook de daadwerkelijke inhoud van elke
// pagina (tekstblokken, koppen, quotes, FAQ's, tegels, knoppen). Haalt
// éénmaal per bezoek een lichte, platte-tekst-index op en filtert lokaal
// terwijl de bezoeker typt — geen extra zoekserver nodig.

import { db } from "./firebase-init.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let indexPromise = null;

/** Haalt alle platte tekst uit een blokken-array, incl. geneste kolommen. */
function extractText(blocks) {
  const parts = [];
  (blocks || []).forEach((block) => {
    switch (block.type) {
      case "heading": case "hero":
        if (block.text) parts.push(block.text);
        if (block.title) parts.push(block.title);
        if (block.lead) parts.push(block.lead);
        if (block.eyebrow) parts.push(block.eyebrow);
        break;
      case "text": if (block.html) parts.push(block.html.replace(/<[^>]*>/g, " ")); break;
      case "quote": if (block.text) parts.push(block.text); if (block.cite) parts.push(block.cite); break;
      case "button": if (block.text) parts.push(block.text); break;
      case "file": if (block.label) parts.push(block.label); break;
      case "faq": (block.items || []).forEach((i) => { if (i.question) parts.push(i.question); if (i.answer) parts.push(i.answer); }); break;
      case "tiles": (block.items || []).forEach((i) => { if (i.title) parts.push(i.title); if (i.text) parts.push(i.text); }); break;
      case "columns": (block.items || []).forEach((col) => parts.push(extractText(col?.blocks))); break;
      default: break;
    }
  });
  return parts.join(" ");
}

function snippetAround(text, term, length = 100) {
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return text.slice(0, length);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? "…" : "") + text.slice(start, start + length) + "…";
}

async function loadIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const q = query(collection(db, "pages"), where("status", "==", "published"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        const bodyText = extractText(data.blocks);
        return {
          title: data.title || "",
          slug: data.slug || "",
          summary: data.seo?.description || "",
          bodyText,
        };
      });
    })();
  }
  return indexPromise;
}

export function initSearch(root) {
  if (!root) return;
  root.innerHTML = `
    <input type="search" placeholder="Zoeken…" aria-label="Zoek op de website" />
    <div class="site-search__results" hidden></div>
  `;
  const input = root.querySelector("input");
  const results = root.querySelector(".site-search__results");
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const term = input.value.trim().toLowerCase();
    if (!term) { results.hidden = true; results.innerHTML = ""; return; }
    debounceTimer = setTimeout(async () => {
      const pages = await loadIndex();
      const matches = pages
        .map((p) => {
          const inTitle = p.title.toLowerCase().includes(term);
          const inSummary = p.summary.toLowerCase().includes(term);
          const inBody = p.bodyText.toLowerCase().includes(term);
          if (!inTitle && !inSummary && !inBody) return null;
          const context = inSummary ? p.summary : inBody ? snippetAround(p.bodyText, term) : "";
          return { ...p, context, rank: inTitle ? 0 : inSummary ? 1 : 2 };
        })
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 8);

      results.innerHTML = matches.length
        ? matches.map((p) => `
            <a href="/${p.slug}">
              <span class="site-search__result-title">${p.title}</span>
              ${p.context ? `<span class="site-search__result-context">${p.context}</span>` : ""}
            </a>
          `).join("")
        : `<p style="padding:0.8rem;">Geen resultaten gevonden.</p>`;
      results.hidden = false;
    }, 200);
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) results.hidden = true;
  });
}
