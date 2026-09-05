// seed.js
import { requireAdmin } from "./admin-auth.js";
import { db } from "../../js/firebase-init.js";
import {
  doc, setDoc, collection, query, where, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let idCounter = 0;
function bid() { return `seed${Date.now()}${idCounter++}`; }

function heading(text, level = 2, align = "left") { return { id: bid(), type: "heading", text, level, align }; }
function paragraph(html, align = "left") { return { id: bid(), type: "text", html: `<p>${html}</p>`, align }; }
function quote(text, cite = "") { return { id: bid(), type: "quote", text, cite }; }
function divider() { return { id: bid(), type: "divider" }; }
function spacer(height = 30) { return { id: bid(), type: "spacer", height }; }

const SETTINGS = {
  siteName: "Christine ten Kate",
  logoText: "Christine <span>ten Kate</span>",
  logoUrl: "/img/logo-blocks.png",
  footerText: "Trainer, docent en pedagogisch adviseur voor de kinderopvang.",
  address: "Zuiderlaan 199\n7944 EE Meppel",
  phone: "0522 - 24 43 66",
  mobilePhone: "06 - 30 86 09 63",
  email: "info@christinetenkate.nl",
  kvk: "60855851",
  trustBadgeUrl: "/img/crkbo-badge.png",
  trustBadgeAlt: "CRKBO geregistreerd docent",
  socialLinks: [],
};

const MENU = {
  items: [
    { label: "Home", type: "page", slug: "home", hidden: false, children: [] },
    { label: "Even voorstellen", type: "page", slug: "even-voorstellen", hidden: false, children: [] },
    { label: "Cursussen & workshops", type: "page", slug: "cursussen-workshops", hidden: false, children: [] },
    { label: "Ouderavonden", type: "page", slug: "ouderavonden", hidden: false, children: [] },
    { label: "Referenties", type: "page", slug: "referenties", hidden: false, children: [] },
    { label: "Handige links", type: "page", slug: "handige-links", hidden: false, children: [] },
    { label: "Contact", type: "page", slug: "contact", hidden: false, children: [] },
  ],
};

function placeholderNotice(text) {
  return paragraph(`<em>${text}</em>`);
}

const PAGES = [
  {
    slug: "home",
    title: "Home",
    seo: { title: "Christine ten Kate — Trainer, docent en pedagogisch adviseur", description: "Christine ten Kate: trainer, docent en pedagogisch adviseur voor de kinderopvang.", ogImage: "" },
    blocks: [
      {
        id: bid(), type: "hero",
        eyebrow: "Trainer · Docent · Pedagogisch adviseur",
        title: "Christine ten Kate",
        lead: "Ik ondersteun pedagogisch medewerkers, teams en organisaties in de kinderopvang met training, scholing en advies.",
        imageMediaId: null, imageAlt: "",
        buttonText: "Neem contact op",
        buttonLink: { type: "page", value: "contact" },
      },
      {
        id: bid(), type: "tiles",
        items: [
          { title: "Even voorstellen", text: "Maak kennis met Christine en haar werkwijze.", link: { type: "page", value: "even-voorstellen" } },
          { title: "Cursussen & workshops", text: "Trainingen en scholing voor pedagogisch medewerkers.", link: { type: "page", value: "cursussen-workshops" } },
          { title: "Ouderavonden", text: "Interactieve avonden voor ouders en teams.", link: { type: "page", value: "ouderavonden" } },
          { title: "Referenties", text: "Ervaringen van eerdere opdrachtgevers.", link: { type: "page", value: "referenties" } },
        ],
      },
    ],
  },
  {
    slug: "even-voorstellen",
    title: "Even voorstellen",
    seo: { title: "Even voorstellen — Christine ten Kate", description: "Maak kennis met Christine ten Kate.", ogImage: "" },
    blocks: [
      heading("Even voorstellen", 1),
      placeholderNotice("Plaatshouder-tekst — pas dit aan via de editor met jouw eigen verhaal, foto en achtergrond."),
      paragraph("Vertel hier wie je bent, wat je drijft en hoe je te werk gaat. Je kunt hieronder eenvoudig een foto toevoegen via het '+ Blok'-menu."),
    ],
  },
  {
    slug: "cursussen-workshops",
    title: "Cursussen & workshops voor pedagogisch medewerkers",
    seo: { title: "Cursussen & workshops — Christine ten Kate", description: "Trainingen en workshops voor pedagogisch medewerkers in de kinderopvang.", ogImage: "" },
    blocks: [
      heading("Cursussen & workshops voor pedagogisch medewerkers", 1),
      placeholderNotice("Plaatshouder-tekst — vul hier het actuele aanbod aan cursussen en workshops in, eventueel met een 'Vraag & antwoord'-blok voor veelgestelde vragen."),
      paragraph("Beschrijf hier per cursus of workshop de inhoud, duur en doelgroep."),
    ],
  },
  {
    slug: "ouderavonden",
    title: "Ouderavonden",
    seo: { title: "Ouderavonden — Christine ten Kate", description: "Interactieve ouderavonden verzorgd door Christine ten Kate.", ogImage: "" },
    blocks: [
      heading("Ouderavonden", 1),
      placeholderNotice("Plaatshouder-tekst — beschrijf hier het aanbod en de werkwijze rondom ouderavonden."),
      paragraph("Vertel hier meer over de opzet, onderwerpen en aanpak van de ouderavonden die je verzorgt."),
    ],
  },
  {
    slug: "referenties",
    title: "Referenties",
    seo: { title: "Referenties — Christine ten Kate", description: "Ervaringen van eerdere opdrachtgevers van Christine ten Kate.", ogImage: "" },
    blocks: [
      heading("Referenties", 1),
      placeholderNotice("Plaatshouder — vervang dit voorbeeldcitaat door echte reacties van opdrachtgevers."),
      quote("Een fijne, deskundige trainer die goed aansluit bij de praktijk.", "Voorbeeld — naam opdrachtgever"),
    ],
  },
  {
    slug: "handige-links",
    title: "Handige links",
    seo: { title: "Handige links — Christine ten Kate", description: "Handige links voor pedagogisch medewerkers.", ogImage: "" },
    blocks: [
      heading("Handige links", 1),
      placeholderNotice("Plaatshouder — voeg hier links toe naar handige websites, met de knop 'Link instellen' bij een tekst- of knopblok."),
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    seo: { title: "Contact — Christine ten Kate", description: "Neem contact op met Christine ten Kate.", ogImage: "" },
    blocks: [
      heading("Contact", 1),
      paragraph("Neem gerust contact op via onderstaand formulier, telefoon of e-mail."),
      paragraph("<strong>Christine ten Kate</strong><br>Zuiderlaan 199<br>7944 EE Meppel<br>T 0522 - 24 43 66<br>M 06 - 30 86 09 63<br>E info@christinetenkate.nl<br>KvK-nr. 60855851"),
      divider(),
      { id: bid(), type: "contact-form", buttonText: "Versturen" },
    ],
  },
  {
    slug: "algemene-voorwaarden",
    title: "Algemene voorwaarden",
    seo: { title: "Algemene voorwaarden — Christine ten Kate", description: "Algemene voorwaarden van Christine ten Kate.", ogImage: "" },
    blocks: [
      heading("Algemene voorwaarden", 1),
      placeholderNotice("Plaatshouder — de eerdere algemene voorwaarden waren niet aangeleverd. Vul hier de geldende algemene voorwaarden in."),
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    seo: { title: "Privacy Policy — Christine ten Kate", description: "Privacybeleid van Christine ten Kate.", ogImage: "" },
    blocks: [
      heading("Privacy Policy", 1),
      paragraph("Christine ten Kate hecht veel waarde aan de bescherming van uw persoonsgegevens. In deze Privacy policy wil ik heldere en transparante informatie geven over hoe ik omga met persoonsgegevens."),
      paragraph("Ik doe er alles aan om uw privacy te waarborgen en ga daarom zorgvuldig om met persoonsgegevens. Christine ten Kate houdt zich in alle gevallen aan de toepasselijke wet- en regelgeving, waaronder de Algemene Verordening Gegevensbescherming. Dit brengt met zich mee dat ik in ieder geval:"),
      { id: bid(), type: "text", html: `<ul>
        <li>Uw persoonsgegevens verwerk in overeenstemming met het doel waarvoor deze zijn verstrekt, deze doelen en type persoonsgegevens zijn beschreven in dit Privacy policy;</li>
        <li>Verwerking van uw persoonsgegevens beperk tot enkel die gegevens welke minimaal nodig zijn voor de doeleinden waarvoor ze worden verwerkt;</li>
        <li>Vraag om uw uitdrukkelijke toestemming als ik deze nodig heb voor de verwerking van uw persoonsgegevens;</li>
        <li>Passende technische en organisatorische maatregelen heb genomen zodat de beveiliging van uw persoonsgegevens gewaarborgd is;</li>
        <li>Geen persoonsgegevens doorgeef aan andere partijen, tenzij dit nodig is voor uitvoering van de doeleinden waarvoor ze zijn verstrekt;</li>
        <li>Op de hoogte ben van uw rechten omtrent uw persoonsgegevens, u hierop wil wijzen en deze respecteren.</li>
      </ul>`, align: "left" },
      paragraph("Als Christine ten Kate ben ik verantwoordelijk voor de verwerking van uw persoonsgegevens. Indien u na het doornemen van dit Privacy policy, of in algemenere zin, vragen heeft hierover of contact met mij wenst op te nemen kan dit via de contactgegevens onder aan dit document."),

      heading("Verwerking van persoonsgegevens van klanten, relaties of deelnemers", 2),
      paragraph("Persoonsgegevens van klanten, relaties of deelnemers worden door Christine ten Kate verwerkt ten behoeve van de volgende doelstelling(en):"),
      { id: bid(), type: "text", html: `<ul><li>Administratieve doeleinden;</li><li>Communicatie over de opdracht, training/workshop of uitnodigingen;</li></ul>` },
      paragraph("Grondslag voor deze persoonsgegevens is:"),
      { id: bid(), type: "text", html: `<ul><li>De overeengekomen opdracht uitvoeren of het contract opmaken;</li></ul>` },
      paragraph("Voor de bovenstaande doelstelling(en) kan Christine ten Kate de volgende persoonsgegevens vragen:"),
      { id: bid(), type: "text", html: `<ul>
        <li>Voornaam;</li><li>Tussenvoegsel;</li><li>Achternaam;</li><li>Geboortedatum;</li>
        <li>Adres en woonplaats;</li><li>(Zakelijk) Telefoonnummer;</li><li>(Zakelijk) E-mailadres;</li>
        <li>Geslacht;</li><li>Website;</li><li>Btw-nummer;</li><li>Betalingstermijn;</li>
        <li>Rekeningnummer;</li><li>Telebankier machtiging;</li><li>Beginsituatie van de deelnemers;</li>
        <li>Eventuele bijzonderheden van de deelnemers.</li>
      </ul>` },
      paragraph("Uw persoonsgegevens worden door Christine ten Kate opgeslagen ten behoeve van bovengenoemde verwerking(en) voor de periode: gedurende de looptijd van de opdracht of contract en daarna alleen in de financiële administratie voor maximaal 7 jaar."),

      heading("Verwerking van persoonsgegevens (mogelijk) geïnteresseerden", 2),
      paragraph("Persoonsgegevens van lobbycontacten en/of geïnteresseerden worden door Christine ten Kate verwerkt ten behoeve van de volgende doelstelling(en): informatieverstrekking en/of gerichte contacten."),
      paragraph("Grondslag voor deze persoonsgegevens is: mondelinge toestemming, afgifte visitekaartje en/of via koppeling op LinkedIn."),
      paragraph("Voor de bovenstaande doelstelling(en) kan Christine ten Kate de volgende persoonsgegevens van u vragen: voornaam, tussenvoegsel, achternaam, telefoonnummer en e-mailadres."),
      paragraph("Uw persoonsgegevens worden door Christine ten Kate opgeslagen ten behoeve van bovengenoemde verwerking(en) voor de periode: gedurende de periode dat men gezien wordt als een lobbycontact en/of geïnteresseerde."),

      heading("Verstrekking aan derden", 2),
      paragraph("De gegevens die u aan ons geeft kan ik aan derde partijen verstrekken indien dit noodzakelijk is voor uitvoering van de hierboven beschreven doeleinden en indien u hiermee akkoord gaat."),
      paragraph("Zo maak ik gebruik van derde partijen voor:"),
      { id: bid(), type: "text", html: `<ul>
        <li>Het verzorgen van de internetomgeving van Christine ten Kate;</li>
        <li>Het verzorgen van de (financiële) administratie;</li>
        <li>Het verzorgen van uitnodigingen en drukwerk.</li>
      </ul>` },
      paragraph("Ik zal door u verstrekte gegevens niet aan andere partijen verstrekken, tenzij dit wettelijk verplicht en toegestaan is. Een voorbeeld hiervan is als de politie in het kader van een onderzoek (persoons)gegevens bij ons opvraagt. Tevens kan ik persoonsgegevens delen met derden indien u mij hier schriftelijk toestemming voor geeft."),

      heading("Binnen de EU", 3),
      paragraph("N.v.t."),
      heading("Minderjarigen", 3),
      paragraph("N.v.t."),

      heading("Bewaartermijn", 2),
      paragraph("Christine ten Kate bewaart persoonsgegevens niet langer dan noodzakelijk voor het doel waarvoor deze zijn verstrekt dan wel op grond van de wet is vereist."),

      heading("Beveiliging", 2),
      paragraph("Ik heb passende technische en organisatorische maatregelen genomen om persoonsgegevens van u te beschermen tegen onrechtmatige verwerking, zo heb ik bijvoorbeeld de volgende maatregelen genomen:"),
      { id: bid(), type: "text", html: `<ul>
        <li>Alle personen die namens Christine ten Kate van uw gegevens kennis kunnen nemen, zijn gehouden aan geheimhouding daarvan;</li>
        <li>Ik hanteer een gebruikersnaam- en wachtwoordbeleid op al onze systemen;</li>
        <li>Ik maak gebruik van initialen als daar aanleiding toe is;</li>
        <li>Ik maak back-ups van de persoonsgegevens om deze te kunnen herstellen bij fysieke of technische incidenten.</li>
      </ul>` },

      heading("Rechten omtrent uw gegevens", 2),
      paragraph("U heeft recht op inzage, rectificatie of verwijdering van de persoonsgegevens welke ik van u ontvangen heb. Tevens kunt u bezwaar maken tegen de verwerking van uw persoonsgegevens (of een deel hiervan) door mij. Ook heeft u het recht om de door u verstrekte gegevens door mij te laten overdragen aan uzelf of in opdracht van u direct aan een andere partij. Ik kan u vragen om u te legitimeren voordat ik gehoor kan geven aan voornoemde verzoeken. Als ik uw persoonsgegevens verwerk op basis van een door u gegeven toestemming hiertoe, dan heeft u altijd het recht deze toestemming in te trekken."),

      heading("Klachten", 2),
      paragraph("Mocht u een klacht hebben over de verwerking van uw persoonsgegevens dan vraag ik u hierover direct contact met mij op te nemen. Komen we er samen niet uit dan vind ik dit natuurlijk erg vervelend. U heeft altijd het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens, dit is de toezichthoudende autoriteit op het gebied van privacybescherming."),

      heading("Vragen", 2),
      paragraph("Als u naar aanleiding van deze Privacy Policy nog vragen of opmerkingen heeft, neem dan contact met mij op!"),

      heading("Contactgegevens", 2),
      paragraph("Christine ten Kate<br>Zuiderlaan 199<br>7944 EE Meppel<br>info@christinetenkate.nl<br>tel: 06 30 86 09 63"),
      spacer(20),
    ],
  },
];

function log(msg) {
  const el = document.getElementById("seed-log");
  el.innerHTML += `<div>${msg}</div>`;
}

async function upsertPage(pageDef, adminEmail) {
  const q = query(collection(db, "pages"), where("slug", "==", pageDef.slug));
  const snap = await getDocs(q);
  const now = serverTimestamp();
  const data = {
    title: pageDef.title,
    slug: pageDef.slug,
    status: "published",
    trashed: false,
    blocks: pageDef.blocks,
    seo: pageDef.seo,
    updatedAt: now,
    updatedBy: adminEmail,
  };
  if (!snap.empty) {
    await setDoc(doc(db, "pages", snap.docs[0].id), data, { merge: true });
    log(`Bijgewerkt: /${pageDef.slug}`);
  } else {
    await setDoc(doc(collection(db, "pages")), { ...data, createdAt: now, createdBy: adminEmail });
    log(`Aangemaakt: /${pageDef.slug}`);
  }
}

async function run() {
  const admin = await requireAdmin();
  document.getElementById("run-seed-btn").addEventListener("click", async () => {
    if (!confirm("Weet je zeker dat je de website wilt vullen met de startinhoud? Bestaande pagina's met dezelfde URL worden overschreven.")) return;
    document.getElementById("run-seed-btn").disabled = true;
    log("Bezig met plaatsen van instellingen…");
    await setDoc(doc(db, "settings", "site"), SETTINGS, { merge: true });
    log("Instellingen geplaatst.");

    log("Bezig met plaatsen van menu…");
    await setDoc(doc(db, "menu", "main"), MENU, { merge: true });
    log("Menu geplaatst.");

    for (const pageDef of PAGES) {
      await upsertPage(pageDef, admin.email);
    }

    log("<strong>Klaar! Bekijk de website via het menu 'Bekijk site' linksboven.</strong>");
    document.getElementById("run-seed-btn").disabled = false;
  });
}

run();
