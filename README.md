# Website van Christine ten Kate — technische documentatie

Volledig gratis te hosten website met een eigen visuele CMS-editor, gebouwd
in vanilla HTML/CSS/JavaScript op Firebase (gratis Spark-plan, geen
creditcard) en Cloudflare Workers static assets (gratis).

Voor installatie-instructies: zie **INSTALLATIE.md**.

## Mappenstructuur

```
wrangler.jsonc      Zegt tegen Cloudflare: "serveer de map public/ als
                    website" (moet in de hoofdmap staan, niet in public/)

public/            De HELE website (dit is de map die online gezet wordt)
  index.html        Universele pagina — laadt élke pagina (incl. home),
                    aan de hand van de URL. Zie app.js hieronder.
  404.html          Losse foutpagina (wordt zelf niet automatisch getoond
                    door Cloudflare, zie "Waarom deze technische keuzes")
  css/               Stijl (tokens.css = kleuren/lettertypes, style.css = layout)
  js/
    firebase-config.js   Jouw Firebase-projectgegevens (in te vullen)
    firebase-init.js     Initialiseert Firebase, gebruikt door alle andere bestanden
    render.js            Zet block-data (uit Firestore) om naar HTML, lost mediaId's op
    layout.js             Bouwt header/menu/footer op
    app.js                 Leest de URL en laadt/toont de bijbehorende pagina
    search.js, contact-form.js, cookie-banner.js  Losse functionaliteit
  img/               Vaste huisstijl-afbeeldingen (logo, keurmerk)

  admin/            Het beveiligde admin-paneel ("de builder") — zit BEWUST
                    in public/, anders wordt het niet mee online gezet
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
      media-picker.js         Bestand kiezen/uploaden/comprimeren + fetchMediaMap()
      link-picker.js          Link kiezen (pagina/extern/e-mail/telefoon/bestand/anker)
      slugify.js               Genereert nette, unieke URL's
      seed.js                  Eenmalige startinhoud (zie INSTALLATIE.md, Deel 4.2)

firebase/
  firestore.rules    Wie mag wat lezen/schrijven in de database
  firebase.json      Firebase-projectconfiguratie
```

## Hoe media werkt (foto's en bestanden)

Er is bewust **geen Firebase Storage** gebruikt (dat vereist tegenwoordig
een creditcard, ook bij gratis gebruik). In plaats daarvan:

1. Bij het uploaden comprimeert de browser een foto zelf (via een
   `<canvas>`) tot 'ie ruim onder de Firestore-documentlimiet van 1 MB
   past, en slaat 'm op als tekst (`data:image/jpeg;base64,...`) in een
   los document in de collectie `media`.
2. Een blok dat naar een foto/bestand verwijst (bijv. een `image`- of
   `file`-blok) bevat alleen een `mediaId` — nooit de foto-data zelf. Zo
   blijft een pagina-document klein, ook met meerdere foto's.
3. Bij het tonen van een pagina verzamelt `collectMediaIds()` (in
   `render.js`) alle gebruikte `mediaId`'s, haalt `fetchMediaMap()` (in
   `public/admin/js/media-picker.js`) die documenten op, en geeft `renderBlocks()`
   de echte URL's door.
4. Bestandslinks (het "Bestand"-blok, of een link naar een bestand vanuit
   een knop/tekst) krijgen automatisch een `download`-attribuut, omdat
   moderne browsers een rechtstreekse *navigatie* naar zo'n data-URL
   blokkeren (phishing-bescherming) — downloaden is wel toegestaan.

Praktisch gevolg: foto's op de site zien er niet anders uit (elke website
comprimeert foto's toch al), maar PDF's/Word-documenten die niet
gecomprimeerd kunnen worden, mogen max. ~650 KB zijn. Zie INSTALLATIE.md
voor de eenmalige Firestore-instelling (indexeringsuitzonderingen) die
hiervoor nodig is.

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
- de editor zelf (`public/admin/js/editor-blocks.js` bouwt daar de bewerk-UI bij).

Zo zien preview en live pagina er altijd identiek uit, en hoeft nieuwe
functionaliteit maar op één plek (de renderer) toegevoegd te worden.

Ondersteunde bloktypes: tekst (rijke opmaak), titel/kop, quote, afbeelding,
galerij, bestand/download, video/embed, knop, contactformulier,
vraag & antwoord (FAQ), kolommen (2 of 3, met geneste blokken), scheidings-
lijn, ruimte — plus `hero` en `tiles`, alleen bruikbaar op de homepage
(slug `home`). Zie ook "Hoe media werkt" hierboven voor hoe foto's/
bestanden binnen blokken worden gerefereerd.

## Beveiliging — hoe dit werkt

- **Firestore Security Rules** (niet de website-code) bepalen wie wat
  mag. Een bezoeker kan dus nooit — ook niet door JavaScript uit te
  zetten of een verzoek na te bootsen — zelf content wijzigen.
- Alleen accounts met een eigen document in de collectie `admins` (via de
  Firebase Console toegevoegd, zie INSTALLATIE.md) krijgen schrijfrechten.
- Tekst die via de rijke-tekst-editor is ingevoerd, wordt bij het tonen op
  de site altijd door **DOMPurify** opgeschoond, zodat er nooit
  kwaadaardige code in een tekstblok terecht kan komen.
- Bestandsuploads zijn beperkt in bestandstype en -grootte
  (`public/admin/js/media-picker.js`).
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
- **Eén universele `index.html`** in plaats van een los HTML-bestand per
  pagina: omdat pagina's dynamisch door oma aangemaakt worden, kan de
  inhoud niet vooraf als losse bestanden gebouwd worden. `wrangler.jsonc`
  zet `not_found_handling` op `"single-page-application"`, waardoor
  Cloudflare élke onbekende URL (dus elke pagina die oma aanmaakt)
  gewoon met `index.html` beantwoordt; `public/js/app.js` bepaalt daarna
  zelf, aan de hand van de adresbalk, welke pagina-inhoud getoond wordt.
- **Cloudflare Workers static assets + Firebase Spark (gratis)**: geen
  enkele maandelijkse kost bij normaal gebruik, en nergens een
  creditcard nodig. (Cloudflare noemde dit tot voor kort "Pages"; sinds
  2026 is "Workers" met een `assets`-map de aanbevolen, vergelijkbare
  opvolger — vandaar `wrangler.jsonc` in plaats van een los
  "build output directory"-instelscherm.)

## Bekend aandachtspunt voor de toekomst

Firestore-rules staan toe dat een ingelogde beheerder alles in
`pages`/`menu`/`settings`/`media` mag aanpassen — er is (bewust, voor
eenvoud) geen onderscheid tussen "hoofdbeheerder" en "extra beheerder".
Wil je dat op termijn verfijnen (bijv. bepaalde acties alleen voor één van
de twee accounts), dan pas je dat aan in `firebase/firestore.rules`.
