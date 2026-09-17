// cookie-banner.js
// Eenvoudige cookiemelding. Onthoudt de keuze van de bezoeker in de browser
// (localStorage), zodat de melding niet steeds opnieuw verschijnt.

const STORAGE_KEY = "cookie-consent";

export function initCookieBanner() {
  if (localStorage.getItem(STORAGE_KEY)) return;

  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookiemelding");
  banner.innerHTML = `
    <p>Deze website gebruikt alleen functionele cookies die nodig zijn om de site goed te laten werken. Lees meer in ons <a href="/privacy-policy">privacybeleid</a>.</p>
    <div class="cookie-banner__actions">
      <button class="btn" type="button" data-accept>Akkoord</button>
    </div>
  `;
  document.body.appendChild(banner);
  banner.querySelector("[data-accept]").addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    banner.remove();
  });
}
