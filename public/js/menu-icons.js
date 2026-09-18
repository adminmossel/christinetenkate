// menu-icons.js
// Een kleine bibliotheek zelfgemaakte lijn-iconen. Oma kiest er per
// menu-item (pagina) één uit in het menu-beheer (zie admin/menu.html +
// admin/js/menu-editor.js); dat icoontje verschijnt vervolgens naast het
// label in het uitklapmenu op de live site (zie layout.js). Eén bron voor
// beide plekken, zodat de iconen in de admin en op de site altijd exact
// hetzelfde zijn.
//
// Elke entry is alleen path-data (geen kleur/maat/viewBox) — dat wordt pas
// bepaald op de plek waar het icoon getekend wordt, via `menuIconSvg()`.
export const MENU_ICON_LIBRARY = {
  contact: {
    label: "Contact (belletje + hart)",
    paths: `
      <path d="M4 6.2A2.2 2.2 0 0 1 6.2 4h11.6A2.2 2.2 0 0 1 20 6.2v6.6a2.2 2.2 0 0 1-2.2 2.2H10l-4.6 3.7v-3.7h-1A2.2 2.2 0 0 1 2 12.8"/>
      <path d="M9 8.7c1-1.3 2.9-.7 2.9.8 0 1.1-1 1.9-2.9 3.4-1.9-1.5-2.9-2.3-2.9-3.4 0-1.5 1.9-2.1 2.9-.8Z" fill="currentColor" stroke="none"/>
    `,
  },
  home: {
    label: "Huisje",
    paths: `<path d="M4 11.5 12 4l8 7.5"/><path d="M6 9.8V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.8"/>`,
  },
  info: {
    label: "Info",
    paths: `<circle cx="12" cy="12" r="8.5"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none"/>`,
  },
  book: {
    label: "Boek (cursus / aanbod)",
    paths: `<path d="M12 6.2c-1.6-1-3.7-1.5-6-1.5v13.6c2.3 0 4.4.5 6 1.5 1.6-1 3.7-1.5 6-1.5V4.7c-2.3 0-4.4.5-6 1.5Z"/><line x1="12" y1="6.2" x2="12" y2="19.8"/>`,
  },
  calendar: {
    label: "Agenda",
    paths: `<rect x="4" y="5.5" width="16" height="14" rx="2"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="8" y1="3.5" x2="8" y2="7.2"/><line x1="16" y1="3.5" x2="16" y2="7.2"/>`,
  },
  phone: {
    label: "Telefoon",
    paths: `<path d="M6.6 4.2 9 4c.5 0 1 .4 1.1.9l.8 3a1.1 1.1 0 0 1-.3 1.1l-1.6 1.5a13 13 0 0 0 5.5 5.5l1.5-1.6a1.1 1.1 0 0 1 1.1-.3l3 .8c.5.1.9.6.9 1.1l-.2 2.4c-.1.9-.9 1.6-1.8 1.5-8-.9-14.3-7.2-15.2-15.2-.1-.9.6-1.7 1.5-1.8Z"/>`,
  },
  heart: {
    label: "Hart",
    paths: `<path d="M12 20 4.6 12.9C2.6 11 2.8 7.8 5 6.1c2-1.5 4.6-1 6 .8l1 1.3 1-1.3c1.4-1.8 4-2.3 6-.8 2.2 1.7 2.4 4.9.4 6.8Z"/>`,
  },
  star: {
    label: "Ster",
    paths: `<path d="m12 4 2.4 5.1 5.6.6-4.2 3.8 1.2 5.5L12 16.3l-4.9 2.7 1.1-5.5-4.1-3.8 5.6-.6Z"/>`,
  },
  "map-pin": {
    label: "Locatie",
    paths: `<path d="M12 21s7-6.3 7-11.7A7 7 0 0 0 5 9.3C5 14.7 12 21 12 21Z"/><circle cx="12" cy="9.3" r="2.4"/>`,
  },
  mail: {
    label: "Envelop",
    paths: `<rect x="3.2" y="5.5" width="17.6" height="13" rx="2"/><path d="m3.8 6.3 8.2 6.6 8.2-6.6"/>`,
  },
};

/** Bouwt de <svg> voor een icoon-sleutel; geeft "" terug als de sleutel niet bestaat. */
export function menuIconSvg(key, extraClass = "") {
  const entry = MENU_ICON_LIBRARY[key];
  if (!entry) return "";
  return `<svg class="${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${entry.paths}</svg>`;
}
