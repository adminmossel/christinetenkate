// home.js
// Laadt de pagina met slug "home" uit Firestore en rendert die. De homepage
// gebruikt dezelfde block-renderer als elke andere pagina — inclusief het
// speciale "hero"- en "tiles"-blok — zodat oma ook de homepage volledig zelf
// kan aanpassen via de editor.

import { db } from "./firebase-init.js";
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initLayout } from "./layout.js";
import { renderBlocks } from "./render.js";
import { initContactForms } from "./contact-form.js";
import { initCookieBanner } from "./cookie-banner.js";

async function loadHome() {
  const content = document.getElementById("page-content");
  try {
    const q = query(collection(db, "pages"), where("slug", "==", "home"), where("status", "==", "published"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      content.innerHTML = `<div class="state-message"><h1>Welkom</h1><p>De homepage is nog niet ingesteld. Ga naar het admin-paneel om de pagina met slug "home" te publiceren.</p></div>`;
      return;
    }
    const page = snap.docs[0].data();
    if (page.seo?.description) {
      document.querySelector('meta[name="description"]').setAttribute("content", page.seo.description);
    }
    renderBlocks(page.blocks || [], content);
    initContactForms();
  } catch (err) {
    console.error(err);
    content.innerHTML = `<p class="state-message">Er ging iets mis bij het laden van de homepage.</p>`;
  }
}

initLayout();
initCookieBanner();
loadHome();
