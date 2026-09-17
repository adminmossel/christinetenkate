// contact-form.js
// Vangt het versturen van een contactformulier-blok af en slaat het bericht
// op in Firestore (collectie "submissions"). Geen betaalde e-maildienst
// nodig; oma kan berichten straks bekijken in het admin-paneel onder
// "Berichten". De Firestore-regels staan alléén "aanmaken" toe voor
// bezoekers, nooit lezen — zo kan niemand andermans berichten inzien.

import { db } from "./firebase-init.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export function initContactForms() {
  document.querySelectorAll("[data-contact-form]").forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector(".form-status");
      const submitBtn = form.querySelector("button[type=submit]");
      const data = Object.fromEntries(new FormData(form).entries());

      // Honeypot: als dit onzichtbare veld is ingevuld, is het waarschijnlijk
      // een spambot. We doen alsof het gelukt is, maar slaan niets op.
      if (data.website) {
        status.textContent = "Bedankt voor je bericht!";
        status.className = "form-status success";
        form.reset();
        return;
      }

      if (!data.name || !data.email || !data.message) {
        status.textContent = "Vul alle velden in.";
        status.className = "form-status error";
        return;
      }

      submitBtn.disabled = true;
      try {
        await addDoc(collection(db, "submissions"), {
          name: String(data.name).slice(0, 200),
          email: String(data.email).slice(0, 200),
          message: String(data.message).slice(0, 5000),
          page: location.pathname,
          createdAt: serverTimestamp(),
          read: false,
        });
        status.textContent = "Bedankt! Je bericht is verstuurd.";
        status.className = "form-status success";
        form.reset();
      } catch (err) {
        console.error(err);
        status.textContent = "Er ging iets mis. Probeer het later opnieuw.";
        status.className = "form-status error";
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
}
