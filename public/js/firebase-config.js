// firebase-config.js
//
// Vul dit bestand met de gegevens uit je eigen Firebase-project.
// Je vindt deze waarden in de Firebase Console onder:
// Projectinstellingen > Algemeen > "Je apps" > SDK-configuratie (Config)
//
// Zie INSTALLATIE.md stap "Firebase-configuratie toevoegen" voor de volledige uitleg.

export const firebaseConfig = {
  apiKey: "VUL_HIER_JE_API_KEY_IN",
  authDomain: "VUL_HIER_JE_PROJECT.firebaseapp.com",
  projectId: "VUL_HIER_JE_PROJECT_ID",
  storageBucket: "VUL_HIER_JE_PROJECT.appspot.com",
  messagingSenderId: "VUL_HIER_JE_SENDER_ID",
  appId: "VUL_HIER_JE_APP_ID",
};

// Let op: deze waarden zijn NIET geheim (ze zijn zichtbaar in de browser van
// elke bezoeker). De echte beveiliging zit in de Firestore- en Storage
// Security Rules (zie /firebase/firestore.rules en /firebase/storage.rules),
// niet in het verborgen houden van deze config.
