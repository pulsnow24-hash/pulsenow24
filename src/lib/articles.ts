/**
 * Stratul de date PulsNow24.
 *
 * Deocamdată articolele sunt statice. Când conectăm Firebase,
 * doar funcțiile getArticles() / getArticleById() se rescriu
 * să citească din Firestore — restul site-ului nu se atinge.
 */

export type ArticleBadge = "breaking" | "blue" | "buzz";

export interface QAPair {
  q: string;
  a: string;
}

export interface Article {
  id: string;
  categorie: string;
  badge: ArticleBadge;
  buzz: boolean;
  titlu: string;
  sumar: string;
  data: string;
  citire: string;
  fapt: string;
  unghi: string;
  opinie: string;
  predictie: string;
  qa: QAPair[];
  dezbatere: string;
}

const ARTICOLE: Article[] = [
  {
    id: "bnr-dobanda",
    categorie: "Business",
    badge: "breaking",
    buzz: false,
    titlu: "BNR menține dobânda de referință la 6,5% după ședința de azi",
    sumar:
      "Decizia vine pe fondul inflației stabilizate. Ce înseamnă pentru ratele tale și unde se duce leul.",
    data: "24 iunie 2026, 13:42",
    citire: "2 min",
    fapt: "Banca Națională a României a menținut astăzi dobânda de politică monetară la 6,5%, decizie confirmată în comunicatul oficial de după ședința Consiliului de administrație din 24 iunie 2026.",
    unghi:
      "Ce nu spune comunicatul direct: menținerea vine într-un moment în care presiunea pe leu crește, iar o scădere a dobânzii ar fi slăbit moneda. BNR alege stabilitatea valutară în detrimentul relaxării creditelor.",
    opinie:
      "Decizia e prudentă, dar conservatoare. Pentru cei cu credite, e o veste neutră pe termen scurt. Pentru economie, semnalează că banca centrală nu vede încă spațiu de respiro.",
    predictie:
      "Estimăm că dobânda rămâne neschimbată cel puțin până la finalul trimestrului. O primă scădere ar veni doar dacă inflația coboară constant și leul se stabilizează.",
    qa: [
      {
        q: "Cât este dobânda de referință a BNR acum?",
        a: "Dobânda de politică monetară a BNR este de 6,5%, menținută la ședința din 24 iunie 2026.",
      },
      {
        q: "De ce a menținut BNR dobânda?",
        a: "Pentru a proteja stabilitatea leului; o scădere ar fi slăbit moneda într-un context de presiune valutară.",
      },
      {
        q: "Ce înseamnă pentru ratele la credite?",
        a: "Ratele variabile legate de indicele de referință rămân, în general, stabile pe termen scurt.",
      },
    ],
    dezbatere:
      "Ar fi trebuit BNR să scadă dobânda pentru a ușura ratele, chiar cu riscul slăbirii leului?",
  },
  {
    id: "ai-model-nou",
    categorie: "AI & Tech",
    badge: "blue",
    buzz: false,
    titlu: "Noul model AI care îngrijorează companiile de software",
    sumar:
      "Un model nou promite să scrie cod complet singur. Ce înseamnă pentru programatori și pentru piață.",
    data: "24 iunie 2026, 12:10",
    citire: "4 min",
    fapt: "Un nou model de inteligență artificială a fost lansat, demonstrând capacitatea de a genera aplicații funcționale din descrieri în limbaj natural, conform anunțului oficial al companiei dezvoltatoare.",
    unghi:
      "Discuția publică se concentrează pe «înlocuiește programatorii?». Întrebarea mai relevantă: cine verifică securitatea codului generat? Testele independente arată rate mari de vulnerabilități în codul produs de AI.",
    opinie:
      "Părerea PulsNow24: nu programatorii dispar, ci se schimbă rolul lor — din «cel care scrie cod» în «cel care verifică și ghidează». Cererea pentru audit și securitate va crește, nu va scădea.",
    predictie:
      "Anticipăm că în următoarele 12 luni vor apărea reglementări și standarde pentru codul generat de AI, în special în zone sensibile precum finanțe și sănătate.",
    qa: [
      {
        q: "Ce poate face noul model AI?",
        a: "Poate genera aplicații funcționale pornind de la descrieri scrise în limbaj natural.",
      },
      {
        q: "Înlocuiește AI-ul programatorii?",
        a: "Mai degrabă le schimbă rolul: accentul se mută pe verificare, securitate și coordonare.",
      },
      {
        q: "Care e principalul risc?",
        a: "Securitatea: codul generat automat are adesea vulnerabilități care necesită verificare umană.",
      },
    ],
    dezbatere:
      "Ai avea încredere într-o aplicație bancară scrisă integral de un AI, fără verificare umană?",
  },
  {
    id: "summit-energie",
    categorie: "Geopolitică",
    badge: "blue",
    buzz: false,
    titlu: "Summit pe energie: ce s-a decis și cine pierde",
    sumar:
      "Liderii europeni au negociat noi reguli pentru piața de energie. Cine câștigă și cine plătește factura.",
    data: "24 iunie 2026, 11:30",
    citire: "3 min",
    fapt: "În cadrul unui summit dedicat energiei, statele participante au discutat un nou cadru de coordonare a aprovizionării și a prețurilor, potrivit declarațiilor oficiale de la finalul reuniunii.",
    unghi:
      "Sub titlurile despre «solidaritate energetică» se ascunde o realocare a costurilor: țările cu producție mai mare ar putea subvenționa indirect pe cele dependente de import.",
    opinie:
      "Părerea PulsNow24: acordurile sună bine pe hârtie, dar implementarea va arăta cât de reală e solidaritatea. Detaliile tehnice, nu declarațiile, decid cine plătește.",
    predictie:
      "Ne așteptăm la negocieri tensionate în lunile următoare, pe măsură ce fiecare stat își calculează costul real al noului cadru.",
    qa: [
      {
        q: "Ce s-a decis la summit?",
        a: "Un nou cadru de coordonare a aprovizionării și prețurilor la energie între statele participante.",
      },
      {
        q: "Cine câștigă din acord?",
        a: "În principiu, statele dependente de import, care ar beneficia de o aprovizionare mai stabilă.",
      },
      {
        q: "Cine plătește?",
        a: "Costurile ar putea fi suportate indirect de țările cu producție energetică mai mare.",
      },
    ],
    dezbatere:
      "Este corect ca țările producătoare de energie să susțină financiar pe cele dependente de import?",
  },
  {
    id: "carburanti-scadere",
    categorie: "Business",
    badge: "blue",
    buzz: false,
    titlu: "Prețul carburanților, în scădere a treia săptămână la rând",
    sumar:
      "De ce scade acum prețul la pompă și ce spun analiștii despre lunile următoare.",
    data: "24 iunie 2026, 10:00",
    citire: "3 min",
    fapt: "Prețurile carburanților au scăzut pentru a treia săptămână consecutiv, conform datelor de piață privind cotațiile la benzină și motorină.",
    unghi:
      "Scăderea nu se datorează doar prețului petrolului, ci și unei concurențe mai agresive între lanțurile de distribuție pentru cota de piață.",
    opinie:
      "Părerea PulsNow24: e o veste bună pentru buzunar, dar volatilă. Scăderile de acum se pot inversa rapid la prima tensiune geopolitică.",
    predictie:
      "Estimăm stabilizare pe termen scurt, dar cu risc de creștere dacă apar perturbări în aprovizionarea internațională.",
    qa: [
      {
        q: "De ce scade prețul carburanților?",
        a: "Atât din cauza cotațiilor internaționale, cât și a concurenței dintre distribuitori.",
      },
      {
        q: "Cât va dura scăderea?",
        a: "Analiștii estimează o stabilizare pe termen scurt, fără garanții pe termen lung.",
      },
      {
        q: "Ce ar putea inversa trendul?",
        a: "O tensiune geopolitică sau perturbări în aprovizionarea internațională.",
      },
    ],
    dezbatere:
      "Crezi că prețurile mici la carburant se vor menține sau e doar o pauză temporară?",
  },
  {
    id: "startup-ai-finantare",
    categorie: "AI & Tech",
    badge: "blue",
    buzz: false,
    titlu: "Startup românesc de AI atrage o finanțare de 10 milioane €",
    sumar:
      "Ce construiesc și de ce au pariat investitorii pe o echipă din România.",
    data: "24 iunie 2026, 09:15",
    citire: "4 min",
    fapt: "Un startup din România specializat în inteligență artificială a anunțat atragerea unei finanțări de 10 milioane de euro, destinată dezvoltării produsului și extinderii echipei.",
    unghi:
      "Suma e notabilă pentru ecosistemul local, dar adevărata poveste e talentul: investitorii pariază pe inginerii români, nu doar pe idee.",
    opinie:
      "Părerea PulsNow24: finanțarea confirmă un trend — România devine sursă de talent tehnic pentru AI. Provocarea e să rețină acest talent acasă.",
    predictie:
      "Anticipăm mai multe runde de finanțare în ecosistemul românesc de AI în următorul an, pe măsură ce vizibilitatea crește.",
    qa: [
      { q: "Cât a atras startup-ul?", a: "O finanțare de 10 milioane de euro." },
      {
        q: "La ce vor folosi banii?",
        a: "Pentru dezvoltarea produsului și extinderea echipei.",
      },
      {
        q: "De ce contează pentru România?",
        a: "Confirmă potențialul ecosistemului local de AI și valoarea talentului tehnic.",
      },
    ],
    dezbatere:
      "Poate România să devină un hub real de AI sau talentul va pleca tot în străinătate?",
  },
  {
    id: "sprijin-antreprenori",
    categorie: "Politică",
    badge: "blue",
    buzz: false,
    titlu: "Program nou de sprijin pentru tinerii antreprenori",
    sumar:
      "Cum aplici, cât primești și care e capcana ascunsă în condițiile de eligibilitate.",
    data: "24 iunie 2026, 08:30",
    citire: "3 min",
    fapt: "A fost anunțat un nou program de sprijin financiar pentru tinerii antreprenori, cu fonduri alocate pentru înființarea și dezvoltarea de afaceri, conform comunicării oficiale.",
    unghi:
      "Dincolo de sumele anunțate, condițiile de eligibilitate și birocrația de raportare decid câți chiar reușesc să acceseze banii.",
    opinie:
      "Părerea PulsNow24: intenția e bună, dar succesul programului se măsoară în câte afaceri supraviețuiesc după primul an, nu în câte au aplicat.",
    predictie:
      "Ne așteptăm la cerere mare la lansare, urmată de o filtrare naturală în funcție de capacitatea de a îndeplini condițiile.",
    qa: [
      {
        q: "Cine poate aplica la program?",
        a: "Tinerii antreprenori care îndeplinesc condițiile de eligibilitate stabilite.",
      },
      {
        q: "Cât sprijin financiar se oferă?",
        a: "Sume alocate pentru înființarea și dezvoltarea de afaceri, conform programului.",
      },
      {
        q: "Care e principala provocare?",
        a: "Condițiile de eligibilitate și birocrația de raportare.",
      },
    ],
    dezbatere:
      "Ajută programele de stat cu adevărat antreprenorii sau creează doar dependență de fonduri?",
  },
  {
    id: "clip-viral",
    categorie: "Viral",
    badge: "buzz",
    buzz: true,
    titlu: "Clipul care a strâns 5 milioane de vizualizări într-o zi",
    sumar:
      "De ce a explodat acest clip și ce spune despre trendul momentului pe rețele.",
    data: "24 iunie 2026, 14:00",
    citire: "2 min",
    fapt: "Un clip video a depășit 5 milioane de vizualizări în mai puțin de 24 de ore, devenind unul dintre cele mai distribuite materiale ale zilei pe platformele sociale.",
    unghi:
      "Viralizarea nu e întâmplătoare: clipul combină un format scurt, o emoție puternică și un moment de surpriză — exact tiparul pe care îl favorizează algoritmii acum.",
    opinie:
      "Părerea PulsNow24: succesul confirmă regula momentului — autenticitatea și emoția bat producția scumpă. Un clip simplu, dar sincer, câștigă.",
    predictie:
      "Anticipăm un val de clipuri care imită formatul, urmat de saturație rapidă — ciclul tipic al trendurilor virale.",
    qa: [
      {
        q: "Câte vizualizări a strâns clipul?",
        a: "Peste 5 milioane în mai puțin de 24 de ore.",
      },
      {
        q: "De ce a devenit viral?",
        a: "Combină format scurt, emoție puternică și un moment de surpriză.",
      },
      {
        q: "Ce urmează după un astfel de viral?",
        a: "De obicei, un val de imitații, apoi saturație rapidă.",
      },
    ],
    dezbatere:
      "Mai contează calitatea producției în era clipurilor virale autentice și spontane?",
  },
  {
    id: "vedeta-aparitie",
    categorie: "Monden",
    badge: "buzz",
    buzz: true,
    titlu: "Vedeta care a surprins pe toată lumea cu o apariție",
    sumar: "Reacțiile din online și ce a declarat public despre situație.",
    data: "24 iunie 2026, 13:00",
    citire: "2 min",
    fapt: "O apariție publică recentă a generat numeroase reacții pe rețelele sociale, devenind subiect de discuție în presa de divertisment.",
    unghi:
      "Dincolo de imaginea în sine, momentul arată cât de repede o singură apariție poate redefini percepția publică în era rețelelor.",
    opinie:
      "Părerea PulsNow24: tratăm subiectul cu prudență — raportăm reacțiile și declarațiile publice, fără speculații despre viața privată.",
    predictie:
      "Ne așteptăm ca discuția să se stingă în câteva zile, conform ciclului obișnuit al subiectelor de divertisment.",
    qa: [
      {
        q: "Ce a stârnit reacțiile?",
        a: "O apariție publică recentă, devenită subiect de discuție online.",
      },
      {
        q: "Cum a reacționat publicul?",
        a: "Cu numeroase comentarii și distribuiri pe rețelele sociale.",
      },
      {
        q: "Cum tratează PulsNow24 subiectul?",
        a: "Raportând fapte și declarații publice, fără speculații private.",
      },
    ],
    dezbatere:
      "Acordăm prea multă atenție aparițiilor vedetelor în detrimentul subiectelor importante?",
  },
  {
    id: "trend-tiktok",
    categorie: "Viral",
    badge: "buzz",
    buzz: true,
    titlu: "Trendul de pe TikTok care a ajuns și la televizor",
    sumar: "Cum a pornit, cine l-a preluat și de ce prinde la public.",
    data: "24 iunie 2026, 11:00",
    citire: "3 min",
    fapt: "Un trend apărut inițial pe TikTok a fost preluat ulterior de emisiuni de televiziune, marcând trecerea unui fenomen din online în media tradițională.",
    unghi:
      "Saltul de la TikTok la TV arată inversarea fluxului: azi televiziunea urmărește rețelele sociale, nu invers.",
    opinie:
      "Părerea PulsNow24: e un semnal clar despre cine dictează cultura populară acum. Platformele scurte stabilesc agenda, restul o preiau.",
    predictie:
      "Anticipăm tot mai multe trenduri care fac drumul invers — de la utilizatori obișnuiți la ecranele mari.",
    qa: [
      {
        q: "Unde a pornit trendul?",
        a: "Pe TikTok, înainte de a fi preluat de televiziune.",
      },
      {
        q: "De ce e semnificativ?",
        a: "Arată că media tradițională urmărește acum rețelele sociale.",
      },
      {
        q: "Ce spune despre viitor?",
        a: "Tot mai multe fenomene vor porni de jos, din online, spre media mare.",
      },
    ],
    dezbatere:
      "A devenit TikTok mai influent decât televiziunea în stabilirea trendurilor?",
  },
];

const TICKER_ITEMS = [
  "BNR a anunțat noua dobândă de referință",
  "Model AI nou lansat: ce poate face diferit",
  "Rezultate alegeri — date parțiale",
];

export async function getArticles(): Promise<Article[]> {
  return ARTICOLE;
}

export async function getArticleById(id: string): Promise<Article | undefined> {
  return ARTICOLE.find((a) => a.id === id);
}

export async function getTickerItems(): Promise<string[]> {
  return TICKER_ITEMS;
}
