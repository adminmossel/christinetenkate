# Website van Christine ten Kate — technische documentatie

Volledig gratis te hosten website met een eigen visuele CMS-editor, gebouwd
in vanilla HTML/CSS/JavaScript op Firebase (gratis Spark-plan) en
Cloudflare Pages (gratis).

Voor installatie-instructies: zie **INSTALLATIE.md**.

## Mappenstructuur

```
public/            De website die bezoekers zien
  index.html        Homepage
  page.html         Universele sjabloon voor alle andere pagina's
  404.html          Niet-gevonden-pagina
  _redirects        Cloudflare Pages routing (nette URL's zoals /contact)
  css/               Stijl (tokens.css = kleuren/lettertypes, style.css = layout)
  js/
    firebase-config.js   Jouw Firebase-projectgegevens (in te vullen)
    firebase-init.js     Initialiseert Firebase, gebruikt door alle andere bestanden
    render.js            Zet block-data (uit Firestore) om naar HTML
    layout.js             Bouwt header/menu/footer op
    app.js / home.js      Laden en tonen van de juiste pagina
    search.js, contact-form.js, cookie-banner.js  Losse functionaliteit
  img/               Vaste huisstijl-afbeeldingen (logo, keurmerk)

admin/              Het beveiligde admin-paneel ("de builder")
  login.html, index.html (dashboard), editor.html, media.html,
  menu.html, settings.html, messages.html, seed.html
  css/               Admin-styling, incl. admin-theme.css (Apple-achtige
                     blauw/wit-stijl — alleen voor de builder, niet voor
                     de publieke site)
  js/
    admin-auth.js         Login- en rechtencontrole
    admin-shell.js         Gedeelde zijbalk-navigatie
    admin-dashboard.js     Pagina-overzicht (aanmaken/dupliceren/publiceren/prullenbak)
    editor-core.js         De pagina-editor: canvas, drag&drop, autosave, versies
    editor-blocks.js       Bewerk-UI per bloktype (tekst, afbeelding, kolommen, ...)
    rich-toolbar.js         Opmaak-werkbalk voor tekstblokken
    media-picker.js         Bestand kiezen/uploaden (gedeeld door meerdere schermen)
    link-picker.js          Link kiezen (pagina/extern/e-mail/telefoon/bestand/anker)
    slugify.js               Genereert nette, unieke URL's
    seed.js                  Eenmalige startinhoud (zie INSTALLATIE.md, Deel 4.2)

firebase/
  firestore.rules    Wie mag wat lezen/schrijven in de database
  storage.rules      Wie mag bestanden uploaden/lezen
  firebase.json      Firebase-projectconfiguratie
```

## Hoe pagina's werken (het datamodel)

Elke pagina is een document in de Firestore-collectie `pages`:

```js
{
  title: "Contact",
  slug: "contact",              // wordt de URL: /contact
  status: "published" | "draft",
  trashed: false,
  blocks: [ {...}, {...} ],     // de opbouw van de pagina, zie hieronder
  seo: { title, description, ogImage },
  updatedAt, createdAt, updatedBy, createdBy,
}
```

Een pagina bestaat uit een array van **blocks**. Elk blok heeft een `type`
(bijv. `text`, `image`, `columns`, `hero`) en de velden die bij dat type
horen. Dezelfde blokken-array wordt gebruikt door:
- de publieke site (`public/js/render.js`),
- de "Voorbeeld"-tab in de editor,
- de editor zelf (`admin/js/editor-blocks.js` bouwt daar de bewerk-UI bij).

Zo zien preview en live pagina er altijd identiek uit, en hoeft nieuwe
functionaliteit maar op één plek (de renderer) toegevoegd te worden.

Ondersteunde bloktypes: tekst (rijke opmaak), titel/kop, quote, afbeelding,
galerij, bestand/download, video/embed, knop, contactformulier,
vraag & antwoord (FAQ), kolommen (2 of 3, met geneste blokken), scheidings-
lijn, ruimte — plus `hero` en `tiles`, alleen bruikbaar op de homepage
(slug `home`).

## Beveiliging — hoe dit werkt

- **Firestore/Storage Security Rules** (niet de website-code) bepalen wie
  wat mag. Een bezoeker kan dus nooit — ook niet door JavaScript uit te
  zetten of een verzoek na te bootsen — zelf content wijzigen.
- Alleen accounts met een eigen document in de collectie `admins` (via de
  Firebase Console toegevoegd, zie INSTALLATIE.md) krijgen schrijfrechten.
- Tekst die via de rijke-tekst-editor is ingevoerd, wordt bij het tonen op
  de site altijd door **DOMPurify** opgeschoond, zodat er nooit
  kwaadaardige code in een tekstblok terecht kan komen.
- Bestandsuploads zijn beperkt in bestandstype en -grootte
  (`admin/js/media-picker.js` + `firebase/storage.rules`).
- Contactformulieren kunnen door bezoekers alléén *aangemaakt* worden
  (nooit gelezen) — zie de rules voor de collectie `submissions`.

## Waarom deze technische keuzes

- **Vanilla HTML/CSS/JS** (geen framework): simpel, snel, geen
  build-stap nodig, precies zoals gevraagd.
- **`document.execCommand()`** voor de tekst-editor: formeel verouderd,
  maar nog altijd breed ondersteund en ruim voldoende voor de gevraagde
  functionaliteit, zonder een zware externe bibliotheek toe te voegen.
  Een logische vervolgstap (niet nu gebouwd) zou een moderne bibliotheek
  als Tiptap zijn, mocht dat ooit gewenst zijn.
- **Eén universele `page.html`** in plaats van een los HTML-bestand per
  pagina: omdat pagina's dynamisch door oma aangemaakt worden, kan de
  inhoud niet vooraf als losse bestanden gebouwd worden. `_redirects`
  zorgt er bij Cloudflare Pages voor dat dit toch nette URL's oplevert.
- **Cloudflare Pages + Firebase Spark (gratis)**: geen enkele
  maandelijkse kost bij normaal gebruik.

## Bekend aandachtspunt voor de toekomst

Firestore-rules staan toe dat een ingelogde beheerder alles in
`pages`/`menu`/`settings`/`media` mag aanpassen — er is (bewust, voor
eenvoud) geen onderscheid tussen "hoofdbeheerder" en "extra beheerder".
Wil je dat op termijn verfijnen (bijv. bepaalde acties alleen voor één van
de twee accounts), dan pas je dat aan in `firebase/firestore.rules`.
