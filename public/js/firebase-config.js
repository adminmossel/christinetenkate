// firebase-config.js
//
// Vul dit bestand met de gegevens uit je eigen Firebase-project.
// Je vindt deze waarden in de Firebase Console onder:
// Projectinstellingen > Algemeen > "Je apps" > SDK-configuratie (Config)
//
// Zie INSTALLATIE.md stap "Firebase-configuratie toevoegen" voor de volledige uitleg.

const firebaseConfig = {
  apiKey: "AIzaSyATboS6Da0ukExPvv5l1gyCQoRJb4JUarw",
  authDomain: "christinetenkate-website.firebaseapp.com",
  projectId: "christinetenkate-website",
  storageBucket: "christinetenkate-website.firebasestorage.app",
  messagingSenderId: "1011471273655",
  appId: "1:1011471273655:web:e0244c65edd010e2ac8732"
};
// Let op: deze waarden zijn NIET geheim (ze zijn zichtbaar in de browser van
// elke bezoeker). De echte beveiliging zit in de Firestore- en Storage
// Security Rules (zie /firebase/firestore.rules en /firebase/storage.rules),
// niet in het verborgen houden van deze config.
