// firebase-init.js
// Initialiseert de Firebase-app en exporteert de services die de rest van de
// site nodig heeft. Alle andere bestanden importeren vanuit dit bestand,
// zodat de app maar één keer wordt geïnitialiseerd.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Let op: er is bewust GEEN Firebase Storage in dit project. Firebase
// Storage vereist sinds 2026 het betaalde Blaze-plan (met creditcard),
// ook bij gebruik binnen de gratis grenzen. Foto's en bestanden worden
// daarom (gecomprimeerd) rechtstreeks in Firestore opgeslagen — zie
// admin/js/media-picker.js. Authentication en Firestore vereisen nooit een
// creditcard.

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Zet dit op true als je lokaal wilt testen met de Firebase Emulator Suite.
// Dit is optioneel en alleen nodig voor ontwikkelaars, niet voor normaal gebruik.
const USE_EMULATORS = false;
if (USE_EMULATORS && location.hostname === "localhost") {
  connectFirestoreEmulator(db, "localhost", 8080);
  connectAuthEmulator(auth, "http://localhost:9099");
}
