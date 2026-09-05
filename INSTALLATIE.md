# INSTALLATIE.md — Website van Christine ten Kate

Deze handleiding neemt je stap voor stap mee van "niets" naar een werkende,
volledig gratis gehoste website met een eigen visuele editor — **zonder dat
je ergens een creditcard hoeft in te vullen.** Volg de stappen in deze
volgorde. Overal waar je iets moet invullen staat dat er duidelijk bij.

Je hebt in totaal drie gratis accounts nodig, geen van alle vraagt om
betaalgegevens:
1. **GitHub** — waar de broncode staat
2. **Firebase** — de "backend": inloggen en de database (incl. foto's/
   bestanden, die worden gecomprimeerd in de database zelf opgeslagen)
3. **Cloudflare** — hiermee wordt de site online gezet, gekoppeld aan
   `christinetenkate.nl`

---

## Deel 1 — GitHub (broncode)

### 1.1 Account maken
Ga naar https://github.com en maak een gratis account (sla over als je er
al een hebt).

### 1.2 Repository maken
1. Klik rechtsboven op **+** → **New repository**.
2. Naam: bijvoorbeeld `christinetenkate-website`.
3. Zet 'm op **Private** (aanbevolen, hoeft niet publiek te zijn).
4. Klik **Create repository**.

### 1.3 Bestanden uploaden
1. Open de nieuwe (lege) repository.
2. Pak eerst de zip-map met de website uit op je computer tot een gewone
   map (met daarin de mappen `public/` en `firebase/`, het bestand
   `wrangler.jsonc`, en `README.md`/`INSTALLATIE.md`). Let op: `admin/`
   zit tegenwoordig **in** `public/` — dat moet zo blijven, niet apart
   uploaden.
3. Klik op **uploading an existing file** (of **Add file → Upload
   files**).
4. Sleep de map **`public`**, de map **`firebase`**, én het bestand
   **`wrangler.jsonc`** in hun geheel naar het uploadvlak (moderne
   browsers ondersteunen slepen van complete mappen met submappen). Sleep
   ook `README.md` en `INSTALLATIE.md` mee. Het bestand `wrangler.jsonc`
   moet in de hoofdmap van de repository terechtkomen (dus niet in
   `public/`) — dat is precies waar Cloudflare het straks verwacht.
5. Klik onderaan op **Commit changes**.

### 1.4 Updates uitvoeren (voor later)
Wil je later handmatig een bestand aanpassen zonder de editor te
gebruiken? Ga naar het bestand in GitHub, klik op het potloodje (bewerken),
pas aan, en klik **Commit changes**. Cloudflare zet de site dan automatisch
opnieuw online (zie Deel 3).

---

## Deel 2 — Firebase (login, database, bestanden)

### 2.1 Project maken
1. Ga naar https://console.firebase.google.com.
2. Klik **Project toevoegen / Add project**.
3. Naam: bijvoorbeeld `christinetenkate-website`.
4. Google Analytics mag je uitzetten (niet nodig).
5. Klik **Project maken**.

### 2.2 Een webapp toevoegen (voor de configuratie)
1. Klik op het `</>`-icoon ("Web") op het project-dashboard.
2. Geef de app een naam, bijv. "Website".
3. **Firebase Hosting hoeft NIET aangevinkt te worden** — we gebruiken
   Cloudflare Pages voor hosting, niet Firebase Hosting.
4. Klik **App registreren**. Je krijgt nu een blokje code te zien met
   `firebaseConfig = { apiKey: "...", ... }`. Laat dit scherm openstaan of
   kopieer de waarden — je hebt ze zo nodig.

### 2.3 Authentication activeren (inloggen)
1. Ga in het linkermenu naar **Build → Authentication**.
2. Klik **Get started**.
3. Kies **E-mail/wachtwoord** (Email/Password) als inlogmethode en zet
   deze op **Enabled**. Sla op.
4. Ga naar het tabblad **Users** en klik **Add user**.
5. Vul het e-mailadres en wachtwoord in voor **oma's account** (bijv.
   `info@christinetenkate.nl`). Klik **Add user**.
6. Herhaal dit voor **jouw eigen account** (het tweede beheerdersaccount).
7. Klik bij elk aangemaakte gebruiker op de rij om het **User UID** te
   zien (een lange reeks letters/cijfers). Kopieer beide UID's — die heb
   je zo nodig bij stap 2.5.

### 2.4 Firestore activeren (de database)
1. Ga naar **Build → Firestore Database**.
2. Klik **Create database**.
3. Kies een locatie dicht bij Nederland, bijvoorbeeld `eur3 (Europe)`.
4. Kies **Production mode** (niet "test mode" — de beveiligingsregels
   zetten we hierna zelf goed).
5. Klik **Create**.

### 2.5 Beheerders instellen in de database
1. Ga terug naar **Authentication → Users**. Je ziet de kolom **User UID**
   achter elk account — klik daarop (of selecteer de tekst) om 'm te
   kopiëren. Doe dit eerst voor het account van **oma**.
2. Ga naar **Firestore Database** en klik op **Start collection**.
3. Collection-ID: typ `admins`. Klik **Next**.
4. Er verschijnt een venster "Add a document" met bovenin een vakje
   **Document ID**, met daarin al een automatisch gegenereerde tekst
   (bijv. `Pv2qcMDwnUdUNISOd0poAlwhIFD3`). Klik in dat vakje, selecteer
   alles (Ctrl+A / Cmd+A op Mac) en **plak de UID** die je bij stap 1
   kopieerde — dat vervangt de automatische tekst. Dit moet dus **exact**
   de UID van oma's account zijn, niet een zelfbedachte naam.
5. Daaronder staat één "Field"-rij klaarstaan. Typ bij **Field**: `email`.
   Bij **Type** staat al `string` — dat klopt, laat dat zo staan. Er
   verschijnt een leeg tekstvak met het label **String**; typ daar het
   e-mailadres van oma in.
   (Zie je per ongeluk een extra, lege Field-rij? Klik dan op het
   min-icoontje ⊖ ernaast om die weg te halen — je hebt er maar één
   nodig.)
6. Klik rechtsonder op **Save**.
7. Herhaal stap 2–6 helemaal opnieuw voor **jouw eigen account**: klik
   op **Add document**, gebruik jouw UID als Document ID, en jouw eigen
   e-mailadres bij het veld `email`.

Alleen accounts met een document in deze `admins`-collectie kunnen
inloggen in het admin-paneel — dit staat los van de Security Rules die je
hierna toevoegt.

### 2.6 Belangrijk: indexering uitzetten voor grote velden
Foto's worden (gecomprimeerd) rechtstreeks als tekst in Firestore
opgeslagen. Firestore probeert **elk veld automatisch te doorzoekbaar te
maken (te "indexeren")**, maar weigert dat voor tekst langer dan 1500
tekens — en een foto of een langere alinea tekst is al snel langer dan
dat. Zonder deze stap krijg je een foutmelding zodra je een foto uploadt
of een langere tekst opslaat. Dit hoef je maar één keer te doen:

1. Ga naar **Firestore Database → Indexes** (tabblad bovenaan, niet
   "Data").
2. Klik op het subtabblad **Single field**.
3. Klik **Add exemption**.
4. Vul in: **Collection ID** = `media`, **Field path** = `url`.
5. Zet alle schuifjes (Ascending / Descending / Array-contains) op **uit
   / Disabled**.
6. Klik **Save**.
7. Klik nogmaals **Add exemption**: **Collection ID** = `pages`, **Field
   path** = `blocks`, en zet ook hier alles op **Disabled**. **Save**.
8. Klik nogmaals **Add exemption**: **Collection ID** = `versions`,
   **Field path** = `blocks`, alles op **Disabled**. **Save**.

Het kan een paar minuten duren voordat deze instellingen actief zijn.

### 2.7 Security Rules toevoegen
1. Ga naar **Firestore Database → Rules**.
2. Vervang de inhoud volledig door de inhoud van het bestand
   `firebase/firestore.rules` uit dit project (open het bestand op GitHub,
   kopieer alles, plak het hier).
3. Klik **Publish**.

### 2.8 Firebase-configuratie toevoegen aan de website
1. Open in GitHub het bestand `public/js/firebase-config.js`.
2. Klik op het potloodje om te bewerken.
3. Vul de waarden in die je bij stap 2.2 hebt gekregen (`apiKey`,
   `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`,
   `appId`) — vervang de tekst `VUL_HIER_...` telkens door de echte
   waarde uit jouw Firebase-project.
4. Klik **Commit changes**.

### 2.9 Database initialiseren
Dit doe je zo als de site eenmaal online staat (zie Deel 4, "Eerste
admin-login" en "Startinhoud plaatsen") — daar hoef je nu nog niets voor
te doen in Firebase zelf.

---

## Deel 3 — Cloudflare (de site online zetten)

Sinds 2026 zet Cloudflare nieuwe, aan GitHub gekoppelde projecten
standaard op als **Worker** (met een bestand `wrangler.jsonc` dat zegt
welke map als website dient) in plaats van het oudere "Pages" met een
los invulveld voor de "build output directory". Dit project is al op die
nieuwe manier ingericht — het bestand `wrangler.jsonc` staat al klaar in
de hoofdmap.

### 3.1 Account maken
Ga naar https://dash.cloudflare.com/sign-up en maak een gratis account.

### 3.2 GitHub koppelen en project deployen
1. Ga in het Cloudflare-dashboard naar **Workers & Pages** (soms ook
   gewoon "Workers" genoemd in het menu).
2. Klik **Create application** (of **Create**) → kies de optie om een
   project te **importeren vanuit een Git-repository** ("Import a
   repository" / "Connect to Git").
3. Koppel je GitHub-account en kies de repository
   `christinetenkate-website`.
4. Cloudflare herkent automatisch het bestand `wrangler.jsonc` in de
   hoofdmap van de repository en gebruikt die instellingen (o.a. dat de
   map `public/` de website is). Je hoeft dus **niets** in te vullen bij
   "build command" of "output directory" — laat die leeg als ze getoond
   worden.
5. Klik **Save and Deploy** / **Deploy**.

Na een minuutje krijg je een link zoals
`https://christinetenkate-website.<jouw-account>.workers.dev` — de site
staat nu al online (nog niet op het echte domein). Controleer even of de
pagina er gestyled uitziet (kleuren, lettertype) — zo niet, dan is
`wrangler.jsonc` niet meegekomen bij het uploaden; controleer of dat
bestand in de hoofdmap van de GitHub-repository staat (naast de mappen
`public` en `firebase`, dus niet erin).

### 3.3 Custom domain instellen (christinetenkate.nl)
Omdat jullie het domein al hebben, zijn er twee situaties mogelijk:

**Als het domein al bij Cloudflare staat:**
1. Ga naar het zojuist aangemaakte Worker-project → **Settings → Domains
   & Routes** (soms "Custom Domains" genoemd).
2. Klik **Add** / **Add custom domain**.
3. Vul `christinetenkate.nl` in (en eventueel ook `www.christinetenkate.nl`
   als los, tweede domein).
4. Cloudflare regelt de DNS-instellingen automatisch.

**Als het domein nog bij een andere provider staat** (bijv. de partij waar
het ooit geregistreerd is):
1. Voeg eerst het domein toe aan Cloudflare via **Add a site** op het
   hoofddashboard, en volg de instructies (Cloudflare scant de bestaande
   DNS-instellingen automatisch over).
2. Cloudflare geeft je twee **nameservers** (bijv. `ana.ns.cloudflare.com`
   en `bob.ns.cloudflare.com`). Log in bij de huidige registrar/provider
   van het domein en wijzig daar de nameservers naar deze twee waarden.
3. Dit kan tot 24 uur duren om overal actief te worden.
4. Ga daarna terug naar stap "Als het domein al bij Cloudflare staat"
   hierboven.

### 3.4 HTTPS
Dit gaat automatisch: zodra het domein actief is via Cloudflare, wordt er
automatisch een gratis SSL-certificaat aangemaakt (Cloudflare Universal
SSL). Je hoeft hier zelf niets voor te doen.

---

## Deel 4 — De website in gebruik nemen

### 4.1 Eerste admin-login
Ga naar `https://christinetenkate.nl/admin/login.html` en log in met het
e-mailadres/wachtwoord dat je bij stap 2.3 hebt aangemaakt.

### 4.2 Startinhoud plaatsen
Ga na het inloggen naar **`/admin/seed.html`** (of klik op de link die op
het dashboard verschijnt) en klik op **"Website vullen met
startinhoud"**. Dit plaatst in één keer:
- het logo en de echte contactgegevens in de instellingen;
- het navigatiemenu;
- de volledige Privacy Policy-tekst;
- de Contact-pagina met een werkend contactformulier;
- een aantal andere pagina's (Even voorstellen, Cursussen & workshops,
  Ouderavonden, Referenties, Handige links, Algemene voorwaarden) met
  duidelijk gemarkeerde **plaatshouder-tekst** die je zelf via de editor
  aanvult of desgewenst verwijdert.

Dit hoef je maar één keer te doen — voer het niet opnieuw uit nadat je
zelf al wijzigingen hebt gemaakt, want dat overschrijft je eigen werk.

### 4.3 Eerste foto uploaden en eerste bestand toevoegen
Ga naar **Mediabibliotheek** in het menu links, klik **+ Bestand
uploaden**, en kies een foto of document van je computer.

### 4.4 Een pagina aanpassen
Ga naar **Pagina's**, klik bij een pagina op **Bewerken**. Klik op een
blok om het aan te passen, of op **+ Blok toevoegen** om iets nieuws toe
te voegen (bijvoorbeeld een foto). Wijzigingen worden automatisch
tussentijds bewaard als concept; klik op **Publiceren** zodra je
tevreden bent.

### 4.5 Menu-item toevoegen of aanpassen
Ga naar **Menu**, sleep items in de gewenste volgorde, of klik **+
Menu-item toevoegen**. Vergeet niet op **Opslaan** te klikken.

### 4.6 Pagina publiceren
Zie 4.4 — de knop **Publiceren** rechtsboven in de pagina-editor.

---

## Latere wijzigingen maken

- **Inhoud van de site** (teksten, foto's, pagina's, menu): dit doe je
  volledig via `https://christinetenkate.nl/admin/` — daar is geen
  GitHub/Firebase/Cloudflare voor nodig.
- **Code aanpassen** (bijv. het design): pas het bestand aan op GitHub
  (of lokaal en dan opnieuw uploaden) en commit de wijziging. Cloudflare
  Pages bouwt de site dan automatisch opnieuw (dit duurt meestal minder
  dan een minuut).
- **Een nieuwe beheerder toevoegen**: maak een gebruiker aan bij
  Firebase → Authentication → Users, en voeg diens UID toe als document
  in de Firestore-collectie `admins` (zie stap 2.5). Dit gebeurt
  bewust alleen via de Firebase Console, niet via de website zelf — zo
  kan niemand zichzelf via de browser beheerrechten toekennen.

---

## Troubleshooting

**"Dit account heeft geen beheerrechten" bij het inloggen**
→ Er is geen document met de juiste UID in de Firestore-collectie
`admins` (stap 2.5), of het UID klopt niet. Controleer dit in de
Firebase Console.

**De site ziet er ongestyled/kaal uit (geen kleuren, standaardlettertype),
of pagina's blijven op "Pagina wordt geladen…" staan**
→ Twee mogelijke oorzaken:
1. Het bestand `wrangler.jsonc` staat niet (goed) in de **hoofdmap** van
   de GitHub-repository (dus als broertje van `public/` en `firebase/`,
   niet erin). Controleer dit op GitHub en herstel zo nodig; Cloudflare
   deployt daarna automatisch opnieuw.
2. `public/js/firebase-config.js` is nog niet (correct) ingevuld (stap
   2.8), of de Firestore Security Rules zijn nog niet gepubliceerd (stap
   2.7). Open de website, druk op **F12** (ontwikkelaarstools) en kijk op
   het tabblad **Console** naar foutmeldingen — die vertellen meestal
   precies wat er mis is.

**Ik krijg een foutmelding bij het opslaan/publiceren in de editor**
→ Meestal betekent dit dat de Security Rules nog niet (goed) gepubliceerd
zijn, of dat je niet bent ingelogd met een account dat in de `admins`-
collectie staat.

**Ik krijg een foutmelding als "The value of property ... is longer than
1500 bytes" bij het opslaan**
→ De indexeringsuitzonderingen uit stap 2.6 zijn nog niet (goed)
ingesteld. Controleer of alle drie de uitzonderingen (`media.url`,
`pages.blocks`, `versions.blocks`) er staan met alle indexeermodi op
Disabled.

**Uploaden van een foto/bestand lukt niet, of geeft "te groot"**
→ Foto's worden automatisch verkleind tot ze passen; bestanden die niet
gecomprimeerd kunnen worden (zoals PDF's) mogen max. ~650 KB zijn (in te
stellen via `MAX_NON_IMAGE_BYTES` in `public/admin/js/media-picker.js`).
Verklein een te groot PDF-bestand eerst met een gratis online
PDF-compressietool.

**Een nieuwe pagina op `christinetenkate.nl/mijn-pagina` geeft "pagina
niet gevonden"**
→ Controleer of de pagina op **Gepubliceerd** staat (niet Concept). Werkt
geen enkele nette URL (ook niet een bestaande, gepubliceerde pagina)?
Controleer dan of `wrangler.jsonc` in de hoofdmap staat met
`"not_found_handling": "single-page-application"` erin — dat zorgt ervoor
dat Cloudflare elke onbekende URL laat afhandelen door de website zelf in
plaats van een kale foutpagina te tonen.

**De site op `<naam>.workers.dev` werkt, maar `christinetenkate.nl` niet
(nog)**
→ DNS-wijzigingen (stap 3.3) kunnen tot 24 uur duren. Controleer de
domeinstatus in Cloudflare onder **Domains & Routes**.

**Ik wil de website tijdelijk helemaal niet gebruiken/wijzigen — kost dat
geld?**
→ Nee. Deze opzet gebruikt bewust alleen onderdelen die nooit een
creditcard vereisen (Firebase Authentication, Firestore, GitHub,
Cloudflare Pages). Zolang bezoekersaantal en opslag binnen de gratis
grenzen blijven — wat voor een site van deze omvang ruimschoots het geval
is — betaal je nooit iets, en kán er ook nergens per ongeluk geld worden
afgeschreven, want er staat nergens een betaalmethode gekoppeld.
