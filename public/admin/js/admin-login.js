// admin-login.js
import { auth } from "../../js/firebase-init.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");

function getRedirectTarget() {
  const params = new URLSearchParams(location.search);
  return params.get("redirect") || "/admin/index.html";
}

// Als er al een geldige sessie is, meteen doorsturen (de doelpagina
// controleert zelf nogmaals of dit account beheerrechten heeft).
onAuthStateChanged(auth, (user) => {
  if (user) location.href = getRedirectTarget();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    location.href = getRedirectTarget();
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Inloggen mislukt. Controleer je e-mailadres en wachtwoord.";
  }
});

document.getElementById("reset-link").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  if (!email) {
    errorEl.textContent = "Vul eerst je e-mailadres in, klik daarna opnieuw op 'Wachtwoord vergeten?'.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    errorEl.className = "form-status success";
    errorEl.textContent = "Er is een e-mail verstuurd om je wachtwoord opnieuw in te stellen.";
  } catch (err) {
    console.error(err);
    errorEl.className = "form-status error";
    errorEl.textContent = "Kon geen reset-e-mail versturen. Controleer het e-mailadres.";
  }
});
