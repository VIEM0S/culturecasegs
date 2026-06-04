// ── Modèles iPhone supportés ─────────────────────────────────────────────────
export const DEFAULT_MODELS = [
  "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
  "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
  "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
  "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
  "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
  "iPhone 17", "iPhone 17 Plus", "iPhone 17 Pro", "iPhone 17 Pro Max",
];

// ── Designs CultureCase — inspirés de la culture malienne ───────────────────
// Les images sont à uploader sur Cloudinary et remplacer ici.
// Format attendu : URL Cloudinary https://res.cloudinary.com/...
// En attendant, les champs image sont vides (à compléter dans Paramètres > Designs).
export const DEFAULT_DESIGNS = [
  // ── Collection Bogolan ──────────────────────────────────────────────────
  { id: "BOG1", name: "Bogolan Classique",       image: "" },
  { id: "BOG2", name: "Bogolan Ocre",            image: "" },
  { id: "BOG3", name: "Bogolan Noir & Blanc",    image: "" },
  { id: "BOG4", name: "Bogolan Rouge",           image: "" },

  // ── Collection N'Ko ─────────────────────────────────────────────────────
  { id: "NKO1", name: "N'Ko Or",                image: "" },
  { id: "NKO2", name: "N'Ko Bleu",              image: "" },
  { id: "NKO3", name: "N'Ko Vert",              image: "" },

  // ── Collection Djenné ───────────────────────────────────────────────────
  { id: "DJE1", name: "Djenné Terracotta",      image: "" },
  { id: "DJE2", name: "Djenné Sable",           image: "" },
  { id: "DJE3", name: "Djenné Nuit",            image: "" },

  // ── Collection Ciwara ───────────────────────────────────────────────────
  { id: "CIW1", name: "Ciwara Gold",            image: "" },
  { id: "CIW2", name: "Ciwara Bronze",          image: "" },

  // ── Collection Wax ──────────────────────────────────────────────────────
  { id: "WAX1", name: "Wax Bleu Indigo",        image: "" },
  { id: "WAX2", name: "Wax Vert Forêt",         image: "" },
  { id: "WAX3", name: "Wax Rouge Piment",       image: "" },
  { id: "WAX4", name: "Wax Jaune Soleil",       image: "" },
  { id: "WAX5", name: "Wax Violet Royal",       image: "" },
  { id: "WAX6", name: "Wax Rose Harmattan",     image: "" },

  // ── Collection Teinture ─────────────────────────────────────────────────
  { id: "TEI1", name: "Teinture Indigo Bamako", image: "" },
  { id: "TEI2", name: "Teinture Kola",          image: "" },

  // ── Éditions spéciales ──────────────────────────────────────────────────
  { id: "SPE1", name: "Édition Mali Koura",     image: "" },
  { id: "SPE2", name: "Édition Sahel",          image: "" },

  // ── Personnalisés ───────────────────────────────────────────────────────
  { id: "CUS1", name: "Personnalisé 1",         image: "" },
  { id: "CUS2", name: "Personnalisé 2",         image: "" },
  { id: "CUS3", name: "Personnalisé 3",         image: "" },
];

// ── Prix par défaut ──────────────────────────────────────────────────────────
export const DEFAULT_PRICE_SETTINGS = {
  purchasePrice: 1500,
  sellingPrice:  3000,
  currency:      "FCFA",
};

// ── Constantes système ───────────────────────────────────────────────────────
export const LOW_STOCK  = 5;
export const CHUNK_SIZE = 200;
export const IDB_NAME   = "culturecase_images";
export const IDB_VER    = 1;
