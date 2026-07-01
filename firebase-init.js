import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyCt9zlckcPb7agpkbBsIH4DPS7w55Fn2E8",
  authDomain: "culturecase-gs.firebaseapp.com",
  projectId: "culturecase-gs",
  storageBucket: "culturecase-gs.firebasestorage.app",
  messagingSenderId: "369046579849",
  appId: "1:369046579849:web:3672d245a9f7d42e687458",
});
const db = getFirestore(app);
const auth = getAuth(app);
window.__db = db;

// ── escapeHTML local (évite dépendance sur app.js) ───────────────────────────
const _esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const chunkCache = new Map();
let mainCache = null,
  chunkUnsubs = [],
  currentChunkCount = 0,
  listenersStarted = false;

// ══ FIREBASE → UI ════════════════════════════════════════════════════════════
// Exposer les APIs Firestore pour le blog
window.__firestoreAPI = { collection, query, where, orderBy, onSnapshot };

window.__applyFirebaseData = function (data) {
  try {
    const settings = data.settings || {};
    const rawDesigns = settings.designs || [];
    if (!rawDesigns.length) return;

    // 1. Designs (images Cloudinary uniquement)
    const newDS = rawDesigns
      .filter((d) => d.image && d.image.startsWith("http"))
      .map((d) => ({
        id: d.id,
        name: (d.name || "").toUpperCase(),
        img: d.image,
        story: d.description || d.name || "",
        cat: (d.category || "CULTURE").toUpperCase(),
      }));
    if (!newDS.length) return;

    // 2. Stock Map — products: [{design, model, stock}]
    // Matching par ID d'abord (fiable), fallback sur nom normalisé
    const normalize = (s) =>
      (s || "")
        .toUpperCase()
        .trim()
        .replace(/['']/g, "'")
        .replace(/\s+/g, " ");
    const newStockMap = {};
    for (const p of data.products || []) {
      const dsItem =
        newDS.find((d) => d.id === p.designId) ||
        newDS.find((d) => normalize(d.name) === normalize(p.design));
      if (!dsItem || !p.model) continue;
      if (!newStockMap[dsItem.id]) newStockMap[dsItem.id] = {};
      newStockMap[dsItem.id][p.model] =
        typeof p.stock === "number" ? p.stock : 0;
    }

    // 3. Modèles & prix — MDS_G1 (≤3500 FCFA) et MDS_G2 (>3500 FCFA) depuis Firebase
    const modelPrices = (settings.priceSettings || {}).modelPrices || {};
    const allModels = settings.models || [];
    const newMdsG1 = allModels.filter(
      (m) => (modelPrices[m] || 5000) <= 3500,
    );
    const newMdsG2 = allModels.filter(
      (m) => (modelPrices[m] || 5000) > 3500,
    );

    // 4. Mise à jour des variables globales (y compris MDS_G2)
    DS.length = 0;
    newDS.forEach((d) => DS.push(d));
    Object.keys(STOCK_MAP).forEach((k) => delete STOCK_MAP[k]);
    Object.assign(STOCK_MAP, newStockMap);
    MDS_G1.length = 0;
    newMdsG1.forEach((m) => MDS_G1.push(m));
    MDS_G2.length = 0;
    newMdsG2.forEach((m) => MDS_G2.push(m));
    ALL_MDS.length = 0;
    allModels.forEach((m) => ALL_MDS.push(m));
    // Exposer les prix réels pour que app.js puisse les lire
    window.MODEL_PRICES = Object.assign({}, modelPrices);

    // 5. Rafraîchir l'UI
    const pg =
      document.querySelector(".pg.on")?.id?.replace("pg-", "") || "home";
    // Stats home toujours à jour (DS et ALL_MDS viennent d'être reconstruits)
    const statD = document.getElementById("stat-designs");
    const statM = document.getElementById("stat-models");
    if (statD) statD.textContent = DS.length;
    if (statM) statM.textContent = ALL_MDS.length;
    // Images hero + about dynamiques
    if (typeof renderStaticImages === "function") {
      renderStaticImages(settings.heroImages, settings.aboutImages);
    }
    if (pg === "home") initHome();
    if (pg === "catalogue") filt();
    if (pg === "detail" && curD) {
      const sel = document.getElementById("d-mod");
      if (sel) {
        const cur = sel.value;
        sel.innerHTML = ALL_MDS.map((m) => {
          const q = getModelStock(curD.id, m);
          if (q === 0) return ""; // masquer les ruptures
          const lbl =
            q <= 2 ? `${m} — ${q} restant${q > 1 ? "s" : ""}` : m;
          return `<option value="${m}">${lbl}</option>`;
        })
          .filter(Boolean)
          .join("");
        if (cur && ALL_MDS.includes(cur)) sel.value = cur;
        updatePrice();
      }
    }
    // Mettre à jour tous les sélecteurs de modèle (catalogue header)
    const gSel = document.getElementById("global-model");
    if (gSel) {
      const cur = gSel.value; // sauvegarder avant rebuild
      const opts =
        '<option value="">— Choisir mon modèle —</option>' +
        ALL_MDS.map(
          (m) =>
            `<option value="${m}">${m} — ${modelPrices[m] ? Number(modelPrices[m]).toLocaleString("fr-FR") + " FCFA" : "3 500 – 5 000 FCFA"}</option>`,
        ).join("");
      gSel.innerHTML = opts;
      // Restaurer la sélection si le modèle est toujours valide
      if (cur && ALL_MDS.includes(cur)) {
        gSel.value = cur;
        onGlobalModelChange();
      }
      // Si aucun modèle n'était sélectionné, s'assurer que filt() tourne quand même
      else if (!cur) {
        filt();
      }
    }

    // Blog géré directement via listenBlog() → collection blog_posts
  } catch (e) {
    console.error("[CultureCase] Firebase apply error:", e);
  }
};

function assemble() {
  if (!mainCache) return;
  const prods = Array.from(
    { length: currentChunkCount },
    (_, i) => chunkCache.get(i) ?? [],
  ).flat();
  window.__applyFirebaseData({ ...mainCache, products: prods });
}

function subscribeChunks(count) {
  chunkUnsubs.forEach((u) => u());
  chunkUnsubs = [];
  chunkCache.clear();
  currentChunkCount = count;
  if (!count) {
    assemble();
    return;
  }
  for (let i = 0; i < count; i++) {
    const idx = i;
    chunkUnsubs.push(
      onSnapshot(doc(db, "data", `products_${idx}`), (snap) => {
        chunkCache.set(idx, snap.exists() ? snap.data().items || [] : []);
        assemble();
      }),
    );
  }
}

// ── Indicateur de statut Firebase dans le DOM ─────────────────────────────
function setFbStatus(state) {
  let el = document.getElementById("fb-status");
  if (!el) {
    el = document.createElement("div");
    el.id = "fb-status";
    Object.assign(el.style, {
      position: "fixed",
      bottom: "14px",
      left: "14px",
      zIndex: "9999",
      fontSize: "11px",
      fontWeight: "500",
      padding: "4px 10px",
      borderRadius: "20px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      backdropFilter: "blur(8px)",
      transition: "opacity .4s",
      opacity: "0",
      fontFamily: "DM Sans, sans-serif",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
  }
  const styles = {
    live: {
      bg: "rgba(30,92,53,.85)",
      color: "#b6f5ce",
      dot: "#4ade80",
      txt: "Données en direct",
    },
    loading: {
      bg: "rgba(26,8,0,.8)",
      color: "#E8A020",
      dot: "#E8A020",
      txt: "Connexion…",
    },
    offline: {
      bg: "rgba(150,40,10,.85)",
      color: "#ffd0b0",
      dot: "#ff7043",
      txt: "Hors ligne — données locales",
    },
  };
  const s = styles[state] || styles.offline;
  el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${s.dot};display:inline-block;${state === "loading" ? "animation:fbPulse 1.2s infinite" : ""}"></span>${s.txt}`;
  Object.assign(el.style, {
    background: s.bg,
    color: s.color,
    opacity: "1",
  });
  if (state === "live")
    setTimeout(() => {
      el.style.opacity = "0";
    }, 4000);
}

// Ajouter l'animation CSS pour le point clignotant
const fbStyle = document.createElement("style");
fbStyle.textContent =
  "@keyframes fbPulse{0%,100%{opacity:1}50%{opacity:.3}}";
document.head.appendChild(fbStyle);

setFbStatus("loading");

function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;

  onSnapshot(
    doc(db, "data", "main"),
    (snap) => {
      if (!snap.exists()) return;
      mainCache = snap.data();
      const n = mainCache._chunkCount ?? 0;
      if (n !== currentChunkCount) subscribeChunks(n);
      else assemble();
      setFbStatus("live");
    },
    (err) => {
      console.error(
        "[CultureCase] Firebase error:",
        err.code,
        err.message,
      );
      setFbStatus("offline");
    },
  );

  window.addEventListener("offline", () => setFbStatus("offline"));
  window.addEventListener("online", () => setFbStatus("loading"));

  window.__firestoreAPI = {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
  };
  // Un seul appel — window.__blogListening empêche le double listener Firestore
  if (typeof listenBlog === "function") {
    listenBlog();
  }
  // Listener avis publiés — remplace les cards statiques en temps réel
  if (!window.__reviewsListening) {
    window.__reviewsListening = true;
    const q = query(
      collection(db, "reviews"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
    );
    const renderReviewCard = (d) => {
      const r = d.data();
      const stars =
        "★".repeat(r.stars || 5) + "☆".repeat(5 - (r.stars || 5));
      const initials = (r.nom || "?")
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      // Construction par template — données approuvées par l'admin, pas de XSS
      return (
        `<div class="review-card">` +
        `<div class="rev-stars" style="color:var(--gold)">${stars}</div>` +
        `<p class="rev-text">\u00ab\u00a0${_esc(r.txt)}\u00a0\u00bb</p>` +
        `<div class="rev-author"><div class="rev-avatar">${initials}</div>` +
        `<div><div class="rev-name">${_esc(r.nom)}</div><div class="rev-loc">${_esc(r.loc) || "Bamako, Mali"}</div></div></div>` +
        `</div>`
      );
    };
    onSnapshot(
      q,
      (snap) => {
        const grid = document.getElementById("reviews-grid");
        if (!grid) return;
        if (snap.docs.length === 0) {
          grid.innerHTML =
            '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">Soyez le premier à laisser un avis !</p>';
          return;
        }
        grid.innerHTML = snap.docs.slice(0, 8).map(renderReviewCard).join("");
      },
      (err) => console.warn("[CultureCase] Reviews listener:", err.code),
    );
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    startListeners();
  } else {
    signInAnonymously(auth)
      .then(() => console.log("[CultureCase] Auth anonyme OK"))
      .catch((err) => {
        console.error("[CultureCase] Auth erreur:", err);
        setFbStatus("offline");
      });
  }
});

// Carrousels hero et about initialisés depuis app.js (après defer)
