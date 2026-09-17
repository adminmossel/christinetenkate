// sw.js
// Minimale service worker. Slaat bewust NIETS op in een cache — de site is
// dynamisch (Firestore-content), dus offline-cachen zou verouderde inhoud
// kunnen tonen. Deze service worker bestaat puur om Chrome de site te
// laten herkennen als "installeerbaar" (nodig voor de "App installeren"-knop).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Bewust geen enkele aanpassing — alles gaat gewoon rechtstreeks naar het
  // netwerk, zoals normaal.
});
