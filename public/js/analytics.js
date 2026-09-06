// analytics.js
// Simpele, privacyvriendelijke bezoekstatistieken — geen betaalde dienst,
// geen cookies-met-tracking-ID die andere sites kunnen uitlezen, en
// BEWUST geen opgeslagen IP-adres (dat is persoonsgegeven onder de AVG).
// In plaats daarvan wordt er, via een gratis locatiedienst, alleen de
// GESCHATTE plaats/land bepaald en dát wordt opgeslagen — dat is voldoende
// om te zien "waar bezoekers vandaan komen" zonder een individu
// herleidbaar te maken.
//
// Er wordt maximaal 1 bezoek per browser-sessie geregistreerd (dus niet
// bij elke pagina binnen hetzelfde bezoek), via sessionStorage.

import { db } from "./firebase-init.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const SESSION_KEY = "visit-logged";

function detectDevice(ua) {
  if (/mobile|android|iphone/i.test(ua)) return "Mobiel";
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}

function detectBrowser(ua) {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/") && !ua.includes("Chromium")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  return "Overig";
}

async function lookupApproxLocation() {
  try {
    // Gratis, geen API-sleutel nodig voor dit soort volumes. Geeft alleen
    // plaats/regio/land terug — we lezen bewust het ip-veld niet uit.
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return {};
    const data = await res.json();
    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country_name || null,
    };
  } catch {
    return {}; // geen internet/dienst niet bereikbaar: sla bezoek toch op, zonder locatie
  }
}

export async function trackVisit() {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const geo = await lookupApproxLocation();
    await addDoc(collection(db, "visits"), {
      path: window.location.pathname,
      referrer: document.referrer ? new URL(document.referrer).hostname : null,
      device: detectDevice(navigator.userAgent),
      browser: detectBrowser(navigator.userAgent),
      city: geo.city,
      region: geo.region,
      country: geo.country,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Bezoekstatistieken mogen nooit de site breken als het misgaat.
    console.error("Bezoek kon niet geregistreerd worden:", err);
  }
}
