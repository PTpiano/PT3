export type FormatKind = "digital" | "flac" | "cd" | "vinyl" | "cassette";

export interface Track {
  id: string;
  title: string;
  subtitle: string;
  durationSec: number;
  cover: string;
  audio: string; // url | idb:id | "" (empty => generative piano demo)
  story: string;
  year: string;
  mood: string;
  published: boolean;
}

export interface Format {
  id: string;
  kind: FormatKind;
  label: string;
  price: number; // fixed price or suggested price (when pwyw)
  pwyw: boolean; // pay-what-you-want (min below)
  min: number;
  stock: number | null; // null = unlimited
  /** Se false il formato non compare nello shop (ma resta configurato). */
  enabled: boolean;
  /** File consegnato al cliente per questo formato (url | idb:id). */
  file: string;
}

export interface Product {
  id: string;
  title: string;
  type: "album" | "compilation" | "single";
  year: string;
  cover: string;
  description: string;
  trackIds: string[];
  formats: Format[];
  downloadUrl: string; // digital delivery (url | idb:id)
  paymentLink: string; // optional Stripe / PayPal link for this product
  featured: boolean;
  published: boolean;
  /** Id dell'album nel database (quando il prodotto viene dal backend). */
  dbId?: string;
}

export interface GalleryItem {
  id: string;
  /** Miniatura (per un video è la copertina mostrata nella griglia). */
  src: string;
  caption: string;
  category: string;
  shape: "normal" | "tall" | "wide";
  published: boolean;
  /** "video" mostra il badge play e apre il player nel lightbox. */
  type?: "image" | "video";
  /** URL del video: YouTube, Vimeo o file diretto. */
  videoUrl?: string;
  /** Data usata dall'ordinamento del database. */
  date?: string;
  /** Id della riga nel database, quando l'elemento è già stato salvato. */
  dbId?: string;
}

export interface EventItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  venue: string;
  city: string;
  ticketUrl: string;
  note: string;
  published: boolean;
}

export interface SocialProfile {
  id: string;
  platform: string;
  handle: string;
  url: string;
  followers: string;
  enabled: boolean;
}

export interface SocialPost {
  id: string;
  platform: string;
  image: string;
  text: string;
  url: string;
  date: string;
}

export interface Message {
  id: string;
  date: string;
  name: string;
  email: string;
  topic: string;
  eventDate: string;
  body: string;
  read: boolean;
}

export interface OrderLine {
  productId: string;
  formatId: string;
  title: string;
  label: string;
  kind: FormatKind;
  qty: number;
  unit: number;
  /** File consegnato al cliente per questo formato (se digitale). */
  file?: string;
}

export interface Order {
  id: string;
  date: string;
  name: string;
  email: string;
  address: string;
  notes: string;
  lines: OrderLine[];
  shipping: number;
  total: number;
  method: string;
  status: "nuovo" | "pagato" | "spedito" | "annullato";
}

export interface Chapter {
  id: string;
  num: string;
  title: string;
  text: string;
  image: string;
}

export interface Project {
  id: string;
  num: string;
  title: string;
  year: string;
  tag: string;
  text: string;
  image: string;
}

export interface SiteData {
  settings: {
    artistName: string;
    tagline: string;
    email: string;
    bookingEmail: string;
    phone: string;
    location: string;
    seoTitle: string;
    seoDescription: string;
    accent: "amber" | "copper" | "oxide";
    currency: string;
    shippingFee: number;
    freeShippingOver: number;
    paypalMe: string;
    stripeLink: string;
    paymentNote: string;
    formEndpoint: string; // optional Formspree-like endpoint
    adminPassword: string;
    soundDemo: boolean;
  };
  api: {
    youtubeKey: string;
    youtubeChannelId: string;
    instagramToken: string;
    spotifyEmbed: string;
    soundcloudEmbed: string;
    feedUrl: string;
  };
  content: {
    hero: {
      kicker: string;
      line1: string;
      line2: string;
      tagline: string;
      cta1: string;
      cta2: string;
      image: string;
    };
    manifesto: string;
    keys: { kicker: string; captions: string[]; image: string; videoUrl: string };
    chapters: Chapter[];
    projects: Project[];
    marquee: string[];
    cta: { title: string; text: string; button: string; image: string };
    about: { title: string; text: string; image: string };
  };
  tracks: Track[];
  products: Product[];
  gallery: GalleryItem[];
  events: EventItem[];
  socials: SocialProfile[];
  posts: SocialPost[];
  messages: Message[];
  orders: Order[];
}

export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const defaults: SiteData = {
  settings: {
    artistName: "P. Taglieri",
    tagline: "Pianoforte · Jazz Fusion · Radici",
    email: "press@peppetaglieri.com",
    bookingEmail: "booking@peppetaglieri.com",
    phone: "+39 000 000 0000",
    location: "Italia · Europa",
    seoTitle: "P. Taglieri — Pianista | Nocturne Underground",
    seoDescription:
      "Peppe Taglieri, pianista jazz fusion. Concerti, musica, album, gallery e booking.",
    accent: "amber",
    currency: "€",
    shippingFee: 5.9,
    freeShippingOver: 60,
    paypalMe: "",
    stripeLink: "",
    paymentNote:
      "Dopo l'ordine riceverai una mail con le istruzioni di pagamento e la conferma di spedizione.",
    formEndpoint: "",
    adminPassword: "taglieri2025",
    soundDemo: true,
  },
  api: {
    youtubeKey: "",
    youtubeChannelId: "",
    instagramToken: "",
    spotifyEmbed: "",
    soundcloudEmbed: "",
    feedUrl: "",
  },
  content: {
    hero: {
      kicker: "Sala d'ascolto · dopo mezzanotte",
      line1: "P.",
      line2: "Taglieri",
      tagline: "Ogni nota arriva da un luogo lontano e profondo.",
      cta1: "Entra nella sala",
      cta2: "Ascolta",
      image: "asset:hero",
    },
    manifesto:
      "Suono nel punto esatto in cui il jazz smette di essere un genere e diventa un luogo: una stanza senza finestre, una lanterna accesa, un'eco che arriva dal porto e dal deserto. Ogni nota è una porta socchiusa. Ogni silenzio, un invito a restare.",
    keys: {
      kicker: "Prima della prima nota",
      captions: ["Le dita sfiorano i tasti.", "Il silenzio pesa.", "Poi, la frase."],
      image: "asset:hands",
      videoUrl: "",
    },
    chapters: [
      {
        id: "c1",
        num: "I",
        title: "Radici",
        text: "Cortili illuminati da lanterne, scale modali, ritmi che si tramandano a voce. Le radici non sono folklore: sono la grammatica segreta con cui ogni improvvisazione prende forma.",
        image: "asset:courtyard",
      },
      {
        id: "c2",
        num: "II",
        title: "Approccio",
        text: "Si parte dal gesto, non dalla nota. Il corpo ascolta prima delle mani; la coreografia contemporanea insegna a lasciare spazio, a rompere la simmetria al momento giusto.",
        image: "asset:textile",
      },
      {
        id: "c3",
        num: "III",
        title: "Suono",
        text: "Un coperchio che si solleva lentamente, martelletti di feltro, risonanze che restano nell'aria. Un suono tattile, caldo, un po' sporco di vita vera — mai sterile.",
        image: "asset:grandpiano",
      },
      {
        id: "c4",
        num: "IV",
        title: "Il Club",
        text: "Piccole sale, tavoli bassi, ottoni spenti appesi al muro. Il set diventa un rito: nessuna scaletta fissa, soltanto la serata che decide dove andare.",
        image: "asset:club",
      },
    ],
    projects: [
      {
        id: "p1",
        num: "I",
        title: "Notturno Sommerso",
        year: "2025",
        tag: "Album · piano solo",
        text: "Quattro movimenti registrati di notte in una sala d'ascolto privata, microfoni a un metro dal pianoforte.",
        image: "asset:cover1",
      },
      {
        id: "p2",
        num: "II",
        title: "Riad Sessions",
        year: "2024",
        tag: "Compilation · ensemble",
        text: "Oud, percussioni e pianoforte in una corte mediterranea. Una raccolta di dialoghi tra radici e improvvisazione.",
        image: "asset:cover2",
      },
      {
        id: "p3",
        num: "III",
        title: "Corpo & Tastiera",
        year: "2024",
        tag: "Performance · danza contemporanea",
        text: "Un lavoro dal vivo con danzatori: gesto rituale, respiro e tasti che rispondono al movimento.",
        image: "asset:hands",
      },
      {
        id: "p4",
        num: "IV",
        title: "Dopo Mezzanotte",
        year: "2023",
        tag: "EP · live in club",
        text: "Un set catturato dal vivo, con il rumore dei bicchieri, il fumo e il pubblico che trattiene il fiato.",
        image: "asset:cover3",
      },
    ],
    marquee: ["Notturno", "Radici", "Improvvisazione", "Rituale", "Silenzio", "Lanterna", "Ottone", "Feltro"],
    cta: {
      title: "Resta ancora\nun brano.",
      text: "Per un concerto, una collaborazione, una colonna sonora o semplicemente per parlare di musica: la serata può continuare.",
      button: "Parliamone",
      image: "asset:courtyard",
    },
    about: {
      title: "Chi suona",
      text: "Pianista e compositore, tra tastiere, jazz fusion e radici. Suona un jazz che ascolta più di quanto parli: modale, tattile, attraversato da scale orientali e da un'idea di rito contemporaneo.",
      image: "asset:portrait",
    },
  },
  tracks: [
    { id: "t1", title: "Lanterne nel Riad", subtitle: "Notturno Sommerso", durationSec: 372, cover: "asset:cover1", audio: "", story: "Una scala frigia che si apre come una corte al tramonto.", year: "2025", mood: "Frigio · 62 bpm", published: true },
    { id: "t2", title: "Dopo Mezzanotte, Ancora", subtitle: "Dopo Mezzanotte", durationSec: 348, cover: "asset:cover3", audio: "", story: "Il bis che non era previsto, eseguito a luci quasi spente.", year: "2023", mood: "Dorico · 70 bpm", published: true },
    { id: "t3", title: "Tessuto d'Indaco", subtitle: "Riad Sessions", durationSec: 425, cover: "asset:cover2", audio: "", story: "Pentatonica minore, trame ripetute come un telaio.", year: "2024", mood: "Pentatonica · 58 bpm", published: true },
    { id: "t4", title: "Il Coperchio Si Solleva", subtitle: "Notturno Sommerso", durationSec: 276, cover: "asset:cover1", audio: "", story: "Pochi secondi di silenzio, poi la prima risonanza.", year: "2025", mood: "Dorico · 64 bpm", published: true },
    { id: "t5", title: "Sabbia e Ottone", subtitle: "Riad Sessions", durationSec: 400, cover: "asset:cover2", audio: "", story: "Frigio dominante: il porto, il vento, un trombone lontano.", year: "2024", mood: "Frigio dom. · 76 bpm", published: true },
    { id: "t6", title: "Ultimo Brano (Resta)", subtitle: "Dopo Mezzanotte", durationSec: 500, cover: "asset:cover3", audio: "", story: "L'invito a rimanere dopo l'ultimo accordo.", year: "2023", mood: "Dorico · 54 bpm", published: true },
  ],
  products: [
    {
      id: "pr1",
      title: "Notturno Sommerso",
      type: "album",
      year: "2025",
      cover: "asset:cover1",
      description: "Il disco in piano solo: quattro movimenti registrati di notte, con la risonanza della sala sempre presente.",
      trackIds: ["t1", "t4"],
      formats: [
        { id: "f1", kind: "digital", label: "Download digitale (MP3 320)", price: 8, pwyw: true, min: 0, stock: null, enabled: true, file: "" },
        { id: "f2", kind: "flac", label: "Download lossless (FLAC 24 bit)", price: 12, pwyw: false, min: 12, stock: null, enabled: true, file: "" },
        { id: "f3", kind: "cd", label: "CD in digipak", price: 16, pwyw: false, min: 16, stock: 200, enabled: true, file: "" },
        { id: "f4", kind: "vinyl", label: "Vinile 180 g · edizione numerata", price: 32, pwyw: false, min: 32, stock: 120, enabled: true, file: "" },
      ],
      downloadUrl: "",
      paymentLink: "",
      featured: true,
      published: true,
    },
    {
      id: "pr2",
      title: "Riad Sessions Vol. 1",
      type: "compilation",
      year: "2024",
      cover: "asset:cover2",
      description: "Compilation di dialoghi tra pianoforte, oud e percussioni registrati in una corte mediterranea.",
      trackIds: ["t3", "t5"],
      formats: [
        { id: "f5", kind: "digital", label: "Download digitale (MP3 320)", price: 7, pwyw: true, min: 0, stock: null, enabled: true, file: "" },
        { id: "f6", kind: "cd", label: "CD", price: 14, pwyw: false, min: 14, stock: 150, enabled: true, file: "" },
        { id: "f7", kind: "cassette", label: "Musicassetta · tiratura limitata", price: 15, pwyw: false, min: 15, stock: 60, enabled: true, file: "" },
      ],
      downloadUrl: "",
      paymentLink: "",
      featured: false,
      published: true,
    },
    {
      id: "pr3",
      title: "Dopo Mezzanotte (live)",
      type: "single",
      year: "2023",
      cover: "asset:cover3",
      description: "Registrazione dal vivo in club: bicchieri, fumo e pubblico che trattiene il fiato.",
      trackIds: ["t2", "t6"],
      formats: [
        { id: "f8", kind: "digital", label: "Download digitale (MP3 320)", price: 5, pwyw: true, min: 0, stock: null, enabled: true, file: "" },
        { id: "f9", kind: "vinyl", label: "Vinile 10\"", price: 24, pwyw: false, min: 24, stock: 80, enabled: true, file: "" },
      ],
      downloadUrl: "",
      paymentLink: "",
      featured: false,
      published: true,
    },
  ],
  gallery: [
    { id: "g1", src: "asset:hero", caption: "Sala d'ascolto, ore 00:40", category: "Club", shape: "wide", published: true },
    { id: "g2", src: "asset:portrait", caption: "Profilo, prima del set", category: "Ritratti", shape: "tall", published: true },
    { id: "g3", src: "asset:hands", caption: "Il gesto prima del suono", category: "Mani", shape: "normal", published: true },
    { id: "g4", src: "asset:courtyard", caption: "Corte con lanterne", category: "Radici", shape: "tall", published: true },
    { id: "g5", src: "asset:textile", caption: "Trame d'indaco e rame", category: "Radici", shape: "normal", published: true },
    { id: "g6", src: "asset:grandpiano", caption: "Il coperchio si solleva", category: "Club", shape: "wide", published: true },
    { id: "g7", src: "asset:club", caption: "Tavoli bassi, ottoni spenti", category: "Club", shape: "normal", published: true },
    { id: "g8", src: "asset:cover1", caption: "Artwork · Notturno Sommerso", category: "Artwork", shape: "normal", published: true },
    { id: "g9", src: "asset:cover3", caption: "Artwork · Dopo Mezzanotte", category: "Artwork", shape: "tall", published: true },
  ],
  events: [
    { id: "e1", date: inDays(12), time: "21:30", title: "Notturno Sommerso — release show", venue: "Cantina Blu", city: "Milano", ticketUrl: "", note: "Piano solo · posti limitati", published: true },
    { id: "e2", date: inDays(26), time: "22:00", title: "Riad Sessions live", venue: "Teatro delle Lanterne", city: "Torino", ticketUrl: "", note: "Con oud e percussioni", published: true },
    { id: "e3", date: inDays(41), time: "23:00", title: "Dopo Mezzanotte", venue: "Sotterraneo 9", city: "Bologna", ticketUrl: "", note: "Late set · ingresso a cappello", published: true },
    { id: "e4", date: inDays(63), time: "20:45", title: "Corpo & Tastiera", venue: "Spazio Rituale", city: "Roma", ticketUrl: "", note: "Performance con danzatori", published: true },
  ],
  socials: [
    { id: "s1", platform: "Instagram", handle: "@peppetaglieri", url: "https://instagram.com/", followers: "", enabled: true },
    { id: "s2", platform: "YouTube", handle: "Peppe Taglieri", url: "https://www.youtube.com/@peppetaglieri", followers: "", enabled: true },
    { id: "s3", platform: "Spotify", handle: "Peppe Taglieri", url: "https://open.spotify.com/", followers: "", enabled: true },
    { id: "s4", platform: "SoundCloud", handle: "peppetaglieri", url: "https://soundcloud.com/", followers: "", enabled: true },
    { id: "s5", platform: "Bandcamp", handle: "peppetaglieri.bandcamp.com", url: "https://bandcamp.com/", followers: "Edizioni limitate", enabled: true },
  ],
  posts: [
    { id: "po1", platform: "Instagram", image: "asset:hands", text: "Il silenzio prima della prima nota. 🎹", url: "", date: inDays(-3) },
    { id: "po2", platform: "Instagram", image: "asset:club", text: "Soundcheck in una cantina che odora di legno e fumo.", url: "", date: inDays(-9) },
    { id: "po3", platform: "Instagram", image: "asset:courtyard", text: "Lanterne, zellige e una scala frigia.", url: "", date: inDays(-15) },
    { id: "po4", platform: "Instagram", image: "asset:grandpiano", text: "Ultimo check prima del set.", url: "", date: inDays(-21) },
  ],
  messages: [],
  orders: [],
};
