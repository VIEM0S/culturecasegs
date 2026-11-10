// ── Séparation données publiques / données privées ───────────────────────────
//
// Pourquoi : `data/main` est lisible SANS connexion (le site public y lit les
// designs, modèles et prix — voir firestore.rules). Y stocker les ventes
// complètes exposait nom, téléphone et quartier de chaque client à
// n'importe qui. Désormais :
//
//   data/main     → version ANONYMISÉE (ce que voient le site public et le
//                   mode partenaire "viewer" : chiffres, pas d'identités)
//   private/main  → version COMPLÈTE des ventes / mouvements / paiements,
//                   lisible uniquement par l'admin (firestore.rules)
//
// Les deux documents sont écrits dans le même batch avec le même tampon
// (`_privSavedAt` côté public, `_savedAt` côté privé) : à la lecture, un
// tampon différent veut dire que les deux ne viennent pas de la même
// sauvegarde.
//
// IMPORTANT — liste blanche, pas liste noire : un champ ajouté plus tard à
// une vente (ex. un futur "email") reste privé par défaut au lieu de fuiter.

export const PRIVATE_FIELDS = ["sales", "pendingSales", "movements", "payments"];

const SALE_PUBLIC_KEYS = [
  "id", "groupId", "date", "productId", "qty", "price", "total",
  "discountType", "discountPercent", "discountAmount", "totalAfterDiscount",
  "delivery", "pendingPayment", "paid", "exchangedFrom", "exchangedAt",
];
const MOVEMENT_PUBLIC_KEYS = ["id", "productId", "type", "qty", "reason", "date"];
const PAYMENT_PUBLIC_KEYS = ["id", "groupId", "amount", "date"];

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
};

export const anonymizeSale     = (s) => pick(s, SALE_PUBLIC_KEYS);
export const anonymizeMovement = (m) => pick(m, MOVEMENT_PUBLIC_KEYS);
export const anonymizePayment  = (p) => pick(p, PAYMENT_PUBLIC_KEYS);

/** Version publique de `data` : mêmes champs, mais sans aucune identité client. */
export function toPublicData(data) {
  return {
    ...data,
    sales:        (data.sales        || []).map(anonymizeSale),
    pendingSales: (data.pendingSales || []).map(anonymizeSale),
    movements:    (data.movements    || []).map(anonymizeMovement),
    payments:     (data.payments     || []).map(anonymizePayment),
  };
}

/** Document privé : les tableaux complets + le tampon de sauvegarde. */
export function toPrivateDoc(data, stamp) {
  const doc = { _savedAt: stamp };
  for (const f of PRIVATE_FIELDS) doc[f] = data[f] || [];
  return doc;
}

/** Vrai si `data` contient encore des identités clients (ancien format). */
export function hasIdentity(data) {
  const dirty = (arr, keys) => (arr || []).some((x) => keys.some((k) => x && x[k]));
  return dirty(data?.sales, ["client", "phone", "quartier", "remarque", "webOrderId"])
    || dirty(data?.pendingSales, ["client", "phone", "quartier", "remarque", "webOrderId"])
    || dirty(data?.movements, ["note"]);
}

const withPrivate = (main, priv) => {
  const out = { ...main };
  for (const f of PRIVATE_FIELDS) out[f] = priv[f] || [];
  delete out._privSavedAt;
  return out;
};

/**
 * Recompose les données admin à partir de data/main (`main`) et
 * private/main (`priv`, null s'il n'existe pas).
 *   ok     → les deux viennent de la même sauvegarde, données complètes
 *   wait   → main est récent mais le privé n'est pas (encore) le même :
 *            les deux listeners ne livrent pas toujours en même temps, on
 *            attend le suivant plutôt que d'afficher un état mélangé
 *   legacy → main n'a pas de tampon : il a été écrit par l'ancien format
 *            (ventes complètes dedans) → à migrer vers private/main
 */
export function mergeAdminData(main, priv) {
  const stamp = main?._privSavedAt;
  if (stamp) {
    if (priv && priv._savedAt === stamp) return { status: "ok", data: withPrivate(main, priv) };
    return { status: "wait" };
  }
  // Pas de tampon. Cas rare : un vieil onglet encore ouvert a réécrit main
  // avec des données déjà anonymisées → les vraies sont dans le privé, qui
  // reste la référence tant que main ne contient aucune identité.
  if (priv && !hasIdentity(main)) return { status: "legacy", data: withPrivate(main, priv) };
  return { status: "legacy", data: main };
}

/** Nouveau tampon de sauvegarde (unique par écriture). */
export const newStamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
