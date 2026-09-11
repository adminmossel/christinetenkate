// admin-auth.js
// Wordt bovenaan élke beveiligde admin-pagina geïmporteerd. Controleert of
// er een ingelogde gebruiker is EN of die gebruiker in de collectie
// "admins" staat (dus echt beheerrechten heeft). Alleen ingelogd zijn bij
// Firebase is niet genoeg — zonder een document in "admins" krijgt niemand
// toegang, ook al kennen ze een geldig account.
//
// Belangrijk: dit is de check aan de "voorkant" voor een prettige gebruikers-
// ervaring (meteen terugsturen naar de inlogpagina). De ECHTE beveiliging
// zit in de Firestore Security Rules — die controleren dit op exact
// dezelfde manier aan de serverkant, dus een bezoeker kan deze check nooit
// omzeilen door bijvoorbeeld JavaScript uit te zetten.

import { auth, db } from "../../js/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let cachedAdminProfile = null;

/**
 * Wacht tot de auth-status bekend is, controleert het admins-document en
 * stuurt niet-beheerders terug naar de inlogpagina.
 * @returns {Promise<{uid:string,email:string,name?:string}>}
 */
export function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        redirectToLogin();
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        if (!adminDoc.exists()) {
          alert("Dit account heeft geen beheerrechten. Vraag de hoofdbeheerder om je toe te voegen aan de collectie 'admins'.");
          await signOut(auth);
          redirectToLogin();
          return;
        }
        cachedAdminProfile = { uid: user.uid, email: user.email, ...adminDoc.data() };
        revealPage();
        resolve(cachedAdminProfile);
      } catch (err) {
        console.error("Kon beheerrechten niet controleren:", err);
        redirectToLogin();
      }
    });
  });
}

/** Maakt de pagina-inhoud pas zichtbaar nadat beheerrechten écht bevestigd zijn. */
function revealPage() {
  document.getElementById("auth-gate-style")?.remove();
}

function redirectToLogin() {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  if (!location.pathname.endsWith("login.html")) {
    location.href = `/admin/login.html?redirect=${returnTo}`;
  }
}

export function getCurrentAdmin() {
  return cachedAdminProfile;
}

export async function logout() {
  await signOut(auth);
  location.href = "/admin/login.html";
}
