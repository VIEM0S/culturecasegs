import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Icon from "./Icon.jsx";
import { getProductImageUrl } from "./utils.js";

// Page « Envoyer photos » : le client demande les modèles dispo pour son
// iPhone sur Snap/WhatsApp → on choisit le modèle, on coche les designs en
// stock, et le menu de partage du téléphone ouvre l'appli avec les photos
// déjà jointes (aucun nom, prix ni lien n'est envoyé — photos seules).
//
// Les images sont téléchargées dès qu'on coche (pas au clic sur « Partager »)
// car navigator.share() exige un geste utilisateur récent : attendre un
// fetch réseau juste avant le partage fait échouer le partage sur iOS.

const fileNameFor = (design, blob) => {
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const base = design.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";
  return `${base}.${ext}`;
};

export default function ShareCatalog({ data, toast }) {
  const { products = [], settings = {} } = data;
  const designs = settings.designs || [];

  const [model, setModel] = useState("");
  const [selected, setSelected] = useState({}); // { [productId]: true }
  const [loading, setLoading] = useState({});   // { [productId]: true } — téléchargement en cours
  const [failed, setFailed] = useState({});     // { [productId]: true } — téléchargement échoué
  const files = useRef(new Map());              // productId → File prêt à partager

  const models = useMemo(() => {
    const fromSettings = settings.models || [];
    const extra = [...new Set(products.map(p => p.model))].filter(m => !fromSettings.includes(m));
    return [...fromSettings, ...extra].filter(m => products.some(p => p.model === m && p.stock > 0));
  }, [settings.models, products]);

  const available = useMemo(() => products
    .filter(p => p.model === model && p.stock > 0)
    .map(p => ({ ...p, image: getProductImageUrl(p, designs) }))
    .sort((a, b) => a.design.localeCompare(b.design)),
  [products, model, designs]);

  // Changer de modèle repart d'une sélection vide.
  useEffect(() => { setSelected({}); }, [model]);

  const prefetch = useCallback(async (p) => {
    if (files.current.has(p.id)) return;
    setLoading(l => ({ ...l, [p.id]: true }));
    setFailed(f => { const n = { ...f }; delete n[p.id]; return n; });
    try {
      const res = await fetch(p.image);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      files.current.set(p.id, new File([blob], fileNameFor(p.design, blob), { type: blob.type || "image/jpeg" }));
    } catch (e) {
      console.error("[ShareCatalog] téléchargement image:", e);
      setFailed(f => ({ ...f, [p.id]: true }));
    } finally {
      setLoading(l => { const n = { ...l }; delete n[p.id]; return n; });
    }
  }, []);

  const toggle = (p) => {
    if (!p.image) return;
    const on = !selected[p.id];
    setSelected(s => { const n = { ...s }; if (on) n[p.id] = true; else delete n[p.id]; return n; });
    if (on) prefetch(p);
  };

  const chosen = available.filter(p => selected[p.id]);
  const pending = chosen.some(p => loading[p.id]);
  const hasFailed = chosen.some(p => failed[p.id]);
  const ready = chosen.filter(p => files.current.has(p.id)).map(p => files.current.get(p.id));
  const canShare = chosen.length > 0 && !pending && ready.length === chosen.length;

  const selectAll = () => {
    const all = {};
    available.forEach(p => { if (p.image) { all[p.id] = true; prefetch(p); } });
    setSelected(all);
  };

  const share = async () => {
    if (!canShare) return;
    try {
      if (navigator.canShare && navigator.canShare({ files: ready })) {
        await navigator.share({ files: ready });
        return;
      }
      // Pas de partage de fichiers (ordinateur) : on télécharge les photos.
      ready.forEach((f) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      toast?.("📥 Partage indisponible ici — photos téléchargées.", "info");
    } catch (e) {
      if (e?.name === "AbortError") return; // l'utilisateur a fermé le menu de partage
      console.error("[ShareCatalog] partage:", e);
      toast?.("❌ Le partage a échoué — réessaie.", "error");
    }
  };

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Envoyer des photos au client</span>
      </div>

      <div className="filter-row">
        <select className="input" style={{ flex: 1 }} value={model} onChange={e => setModel(e.target.value)} aria-label="Modèle d'iPhone du client">
          <option value="">Choisir le modèle du client…</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {!model && <div className="empty">Choisis l'iPhone du client pour voir les designs disponibles.</div>}

      {model && available.length === 0 && <div className="empty">Aucun design en stock pour {model}.</div>}

      {model && available.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>
              {available.length} design{available.length > 1 ? "s" : ""} en stock · {chosen.length} coché{chosen.length > 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>Tout cocher</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected({})} disabled={chosen.length === 0}>Décocher</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, paddingBottom: 90 }}>
            {available.map(p => {
              const on = !!selected[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p)}
                  disabled={!p.image}
                  aria-pressed={on}
                  aria-label={p.design}
                  style={{
                    position: "relative", padding: 0, overflow: "hidden", cursor: p.image ? "pointer" : "not-allowed",
                    background: "var(--bg2)", borderRadius: 10, aspectRatio: "1 / 1",
                    border: on ? "2px solid var(--accent)" : "1px solid var(--border)",
                    opacity: p.image ? 1 : 0.5,
                  }}
                >
                  {p.image
                    ? <img src={p.image} alt={p.design} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <span style={{ fontSize: 11, color: "var(--text2)", padding: 8 }}>Pas de photo</span>}
                  {on && (
                    <span style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
                      {loading[p.id] ? "…" : failed[p.id] ? "!" : "✓"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ position: "sticky", bottom: 76, display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
            <button className="btn btn-primary" onClick={share} disabled={!canShare} style={{ padding: "12px 22px", boxShadow: "0 6px 20px rgba(0,0,0,.35)" }}>
              <Icon name="share" size={16} />
              {pending ? "Préparation des photos…" : chosen.length === 0 ? "Coche des designs" : `Partager ${chosen.length} photo${chosen.length > 1 ? "s" : ""}`}
            </button>
          </div>
          {hasFailed && (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--danger)", marginTop: 8 }}>
              Une photo n'a pas pu être chargée — décoche-la puis recoche-la pour réessayer.
            </div>
          )}
        </>
      )}
    </div>
  );
}
