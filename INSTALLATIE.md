# INSTALLATIE.md — Website van Christine ten Kate

Deze handleiding neemt je stap voor stap mee van "niets" naar een werkende,
volledig gratis gehoste website met een eigen visuele editor. Volg de
stappen in deze volgorde. Overal waar je iets moet invullen staat dat er
duidelijk bij.

Je hebt in totaal drie gratis accounts nodig:
1. **GitHub** — waar de broncode staat
2. **Firebase** — de "backend": inloggen, database en bestandsopslag
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
2. Klik op **uploading an existing file** (of **Add file → Upload files**).
3. Sleep de **hele inhoud** van deze projectmap (dus de mappen `public/`,
   `admin/`, `firebase/`, en de bestanden `README.md`, `INSTALLATIE.md`)
   naar het uploadvlak. Let op: de map zelf hoeft niet mee, alleen de
   inhoud ervan.
4. Klik onderaan op **Commit changes**.

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
1. Klik in Firestore op **Start collection**.
2. Collection-ID: `admins`. Klik **Next**.
3. Document-ID: plak hier de **User UID van oma** (uit stap 2.3).
4. Voeg een veld toe: naam `email`, type `string`, waarde het e-mailadres
   van oma. Klik **Save**.
5. Herhaal: **Add document**, gebruik als document-ID **jouw eigen UID**,
   met jouw e-mailadres als `email`-veld.

Alleen accounts met een document in deze `admins`-collectie kunnen
inloggen in het admin-paneel — dit staat los van de Security Rules die je
hierna toevoegt.

### 2.6 Storage activeren (bestandsopslag voor foto's/documenten)
1. Ga naar **Build → Storage**.
2. Klik **Get started**, kies dezelfde locatie als bij Firestore, klik
   **Done**.

### 2.7 Security Rules toevoegen
1. Ga naar **Firestore Database → Rules**.
2. Vervang de inhoud volledig door de inhoud van het bestand
   `firebase/firestore.rules` uit dit project (open het bestand op GitHub,
   kopieer alles, plak het hier).
3. Klik **Publish**.
4. Ga naar **Storage → Rules**.
5. Vervang de inhoud door `firebase/storage.rules` uit dit project.
6. Klik **Publish**.

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

### 3.1 Account maken
Ga naar https://dash.cloudflare.com/sign-up en maak een gratis account.

### 3.2 GitHub koppelen en project deployen
1. Ga in het Cloudflare-dashboard naar **Workers & Pages**.
2. Klik **Create application → Pages → Connect to Git**.
3. Koppel je GitHub-account en kies de repository
   `christinetenkate-website`.
4. Klik **Begin setup**.

### 3.3 Build-instellingen
Deze site heeft geen build-stap nodig (het is kant-en-klare HTML/CSS/JS),
dus:
- **Framework preset**: `None`
- **Build command**: laat leeg
- **Build output directory**: `public`

Klik **Save and Deploy**. Na een minuutje krijg je een link zoals
`https://christinetenkate-website.pages.dev` — de site staat nu al
online (nog niet op het echte domein).

### 3.4 Custom domain instellen (christinetenkate.nl)
Omdat jullie het domein al hebben, zijn er twee situaties mogelijk:

**Als het domein al bij Cloudflare staat:**
1. Ga naar het Pages-project → **Custom domains → Set up a custom
   domain**.
2. Vul `christinetenkate.nl` in (en eventueel ook `www.christinetenkate.nl`).
3. Cloudflare regelt de DNS-instellingen automatisch.

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

### 3.5 HTTPS
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

**Pagina's op de site laden niet / blijven op "Pagina wordt geladen…"
staan**
→ Controleer of `public/js/firebase-config.js` correct is ingevuld
(stap 2.8), en of de Firestore Security Rules gepubliceerd zijn
(stap 2.7).

**Ik krijg een foutmelding bij het opslaan/publiceren in de editor**
→ Meestal betekent dit dat de Security Rules nog niet (goed) gepubliceerd
zijn, of dat je niet bent ingelogd met een account dat in de `admins`-
collectie staat.

**Uploaden van een foto/bestand lukt niet**
→ Controleer of Storage geactiveerd is (stap 2.6) en of
`firebase/storage.rules` gepubliceerd is (stap 2.7). Bestanden groter dan
15 MB worden geweigerd (in te stellen via `MAX_FILE_SIZE` in
`admin/js/media-picker.js`, samen met de limiet in `storage.rules`).

**Een nieuwe pagina op `christinetenkate.nl/mijn-pagina` geeft "pagina
niet gevonden"**
→ Controleer of de pagina op **Gepubliceerd** staat (niet Concept), en of
het bestand `public/_redirects` ongewijzigd aanwezig is — dat bestand
zorgt ervoor dat nette URL's werken.

**De site op `pages.dev` werkt, maar `christinetenkate.nl` niet (nog)**
→ DNS-wijzigingen (stap 3.4) kunnen tot 24 uur duren. Controleer de
domeinstatus in Cloudflare onder **Custom domains**.

**Ik wil de website tijdelijk helemaal niet gebruiken/wijzigen — kost dat
geld?**
→ Nee. Zolang het bezoekersaantal en de opslag binnen de gratis grenzen
van Firebase (Spark-plan) en Cloudflare Pages blijven — wat voor een site
van deze omvang ruimschoots het geval is — betaal je niets.
