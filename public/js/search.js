// search.js
// Eenvoudige zoekfunctie over alle gepubliceerde pagina's. Haalt éénmaal per
// bezoek een lichte lijst (titel + slug + korte tekst) op en filtert lokaal
// terwijl de bezoeker typt — geen extra zoekserver nodig, dus gratis te
// hosten en snel genoeg voor een site van deze omvang.

import { db } from "./firebase-init.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let indexPromise = null;

async function loadIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const q = query(collection(db, "pages"), where("status", "==", "published"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          title: data.title || "",
          slug: data.slug || "",
          summary: data.seo?.description || "",
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
      const matches = pages.filter((p) =>
        p.title.toLowerCase().includes(term) || p.summary.toLowerCase().includes(term)
      ).slice(0, 8);
      results.innerHTML = matches.length
        ? matches.map((p) => `<a href="/${p.slug}">${p.title}</a>`).join("")
        : `<p style="padding:0.8rem;">Geen resultaten gevonden.</p>`;
      results.hidden = false;
    }, 200);
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) results.hidden = true;
  });
}
