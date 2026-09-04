// slugify.js
// Zet een titel om in een URL-vriendelijke slug, bijvoorbeeld
// "Over mij & mijn werk" -> "over-mij-en-mijn-werk".

export function slugify(text) {
  return (text || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accenten weghalen
    .replace(/&/g, " en ")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

import { db } from "../../public/js/firebase-init.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Maakt een unieke slug: als "over-mij" al bestaat, probeert het
 * "over-mij-2", "over-mij-3", enzovoort. excludeId negeert de huidige
 * pagina zelf (nodig bij hernoemen).
 */
export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let candidate = baseSlug || "pagina";
  let counter = 2;
  while (true) {
    const q = query(collection(db, "pages"), where("slug", "==", candidate));
    const snap = await getDocs(q);
    const conflict = snap.docs.find((d) => d.id !== excludeId);
    if (!conflict) return candidate;
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
}
