import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl, today, fmtDate } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";

function StockPage({ data, onMove }) {
  const { products, movements } = data;
  const [modal, setModal] = useState(false);
  // form = { type, reason, note, date }
  // lines = [{ productId, qty }]
  const [form, setForm] = useState({ type: "in", reason: "Approvisionnement", note: "" });
  const [lines, setLines] = useState([{ id: uid(), productId: "", qty: "", _model: "", _checkedDesigns: [], _designQtys: {} }]);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});
  const reasons = { in: ["Approvisionnement", "Retour client", "Correction"], out: ["Vente", "Perte", "Casse", "Correction"] };

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  const addLine = () => setLines(l => [...l, { id: uid(), productId: "", qty: "", _model: "", _checkedDesigns: [], _designQtys: {} }]);
  const removeLine = (id) => setLines(l => l.filter(x => x.id !== id));
  const updateLine = (id, field, val) => setLines(l => l.map(x => {
    if (x.id !== id) return x;
    if (field === "_model") return { ...x, _model: val, productId: "", _checkedDesigns: [], _designQtys: {} };
    return { ...x, [field]: val };
  }));

  const handleSubmit = () => {
    const errs = {};
    const movs = [];

    lines.forEach((line, i) => {
      if (!line._model) { errs[`product_${i}`] = "Sélectionnez un modèle"; return; }
      const checked = line._checkedDesigns || [];
      if (checked.length === 0) { errs[`product_${i}`] = "Cochez au moins un design"; return; }
      checked.forEach(productId => {
        const qty = parseInt((line._designQtys || {})[productId] || "1");
        const prod = productMap[productId];
        if (!qty || qty < 1) { errs[`product_${i}`] = "Quantité invalide"; return; }
        if (form.type === "out" && prod && qty > prod.stock) {
          errs[`product_${i}`] = `Stock insuffisant pour "${prod.design}" (${prod.stock} dispo)`;
          return;
        }
        movs.push({ id: uid(), productId, type: form.type, qty, reason: form.reason, note: sanitize(form.note, 300), date: today() });
      });
    });

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (movs.length === 0) { setErrors({ general: "Aucun produit sélectionné" }); return; }

    onMove(movs);
    setModal(false);
    setForm({ type: "in", reason: "Approvisionnement", note: "" });
    setLines([{ id: uid(), productId: "", qty: "", _model: "", _checkedDesigns: [], _designQtys: {} }]);
    setErrors({});
  };

  const enriched = useMemo(() =>
    movements.map(m => {
      const p = productMap[m.productId];
      return { ...m, productName: p ? `${p.model} — ${p.design}` : "—" };
    }),
    [movements, productMap]
  );

  const filtered = useMemo(() =>
    enriched.filter(m => {
      const q = search.toLowerCase();
      return (!filterType || m.type === filterType) && (!q || m.productName.toLowerCase().includes(q) || (m.reason || "").toLowerCase().includes(q));
    }).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [enriched, filterType, search]
  );

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Mouvements de stock</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setModal(true); setErrors({}); }}><Icon name="plus" size={14} /> Nouveau mouvement</button>
      </div>
      <div className="filter-row">
        <input className="input" placeholder="Rechercher produit..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 2 }} />
        <select className="input" style={{ flex: 1 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tous</option>
          <option value="in">Entrées</option>
          <option value="out">Sorties</option>
        </select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Produit</th><th scope="col">Qté</th><th scope="col">Raison</th><th scope="col">Note</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="empty">Aucun mouvement</td></tr>}
              {filtered.map(m => (
                <tr key={m.id}>
                  <td style={{ color: "var(--text2)", fontSize: 12 }}>{fmtDate(m.date)}</td>
                  <td>
                    {m.type === "in"
                      ? <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--success)", fontSize: 12 }}><Icon name="arrow_up" size={12} /> Entrée</span>
                      : <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--danger)", fontSize: 12 }}><Icon name="arrow_down" size={12} /> Sortie</span>}
                  </td>
                  <td style={{ fontWeight: 500 }}>{m.productName}</td>
                  <td style={{ fontWeight: 700, color: m.type === "in" ? "var(--success)" : "var(--danger)" }}>{m.type === "in" ? "+" : "-"}{m.qty}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{m.reason}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{m.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Mouvement de stock" onClose={() => { setModal(false); setErrors({}); setLines([{ id: uid(), productId: "", qty: "", _model: "", _checkedDesigns: [], _designQtys: {} }]); }} footer={<>
          <button className="btn btn-outline" onClick={() => { setModal(false); setErrors({}); setLines([{ id: uid(), productId: "", qty: "", _model: "", _checkedDesigns: [], _designQtys: {} }]); }}>Annuler</button>
          <button className={`btn ${form.type === "in" ? "btn-success" : "btn-danger"}`} onClick={handleSubmit}>Enregistrer</button>
        </>}>
          <div className="tabs">
            <button className={`tab ${form.type === "in" ? "active" : ""}`} onClick={() => { setForm(f => ({ ...f, type: "in", reason: "Approvisionnement" })); setErrors({}); }}>Entrée</button>
            <button className={`tab ${form.type === "out" ? "active" : ""}`} onClick={() => { setForm(f => ({ ...f, type: "out", reason: "Vente" })); setErrors({}); }}>Sortie</button>
          </div>

          <p className="section-label">Produits *</p>
          {lines.map((line, i) => {
            const lineModel = line._model || "";
            const designsForModel = lineModel ? products.filter(p => p.model === lineModel) : [];
            return (
              <div key={line.id} style={{ background: "var(--bg3)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  {/* Modèle */}
                  <select
                    className="input"
                    value={lineModel}
                    onChange={e => updateLine(line.id, "_model", e.target.value)}
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    <option value="">Choisir un modèle</option>
                    {[...new Set(products.map(p => p.model))].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {lines.length > 1 && (
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeLine(line.id)}><Icon name="trash" size={13} /></button>
                  )}
                </div>

                {/* Multi-designs avec quantité par design */}
                {lineModel && designsForModel.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>DESIGNS — coche ceux à approvisionner</span>
                      <button className="btn btn-outline btn-sm" style={{ fontSize: 10, padding: "2px 8px" }}
                        onClick={() => {
                          const all = {};
                          designsForModel.forEach(p => { all[p.id] = line._designQtys?.[p.id] || "1"; });
                          updateLine(line.id, "_designQtys", all);
                          updateLine(line.id, "_checkedDesigns", designsForModel.map(p => p.id));
                        }}>Tout cocher</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {designsForModel.map(p => {
                        const checked = (line._checkedDesigns || []).includes(p.id);
                        const qty = line._designQtys?.[p.id] || "1";
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, background: checked ? "rgba(124,58,237,0.1)" : "transparent", border: `1px solid ${checked ? "var(--accent2)" : "var(--border)"}`, transition: "all 0.12s" }}>
                            <input type="checkbox" checked={checked} style={{ accentColor: "var(--accent)", width: 14, height: 14, flexShrink: 0 }}
                              onChange={e => {
                                const cur = line._checkedDesigns || [];
                                updateLine(line.id, "_checkedDesigns", e.target.checked ? [...cur, p.id] : cur.filter(x => x !== p.id));
                              }} />
                            <span style={{ flex: 1, fontSize: 12, fontWeight: checked ? 600 : 400 }}>{p.design}</span>
                            <span style={{ fontSize: 11, color: "var(--text2)" }}>stock: {p.stock}</span>
                            {checked && (
                              <input
                                type="number" min="1"
                                value={qty}
                                onChange={e => updateLine(line.id, "_designQtys", { ...(line._designQtys || {}), [p.id]: e.target.value })}
                                style={{ width: 60, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--bg2)", color: "var(--text1)", fontSize: 12 }}
                                placeholder="Qté"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {errors[`product_${i}`] && <FieldError msg={errors[`product_${i}`]} />}
                  </div>
                )}
              </div>
            );
          })}
          <button className="btn btn-outline btn-sm" onClick={addLine} style={{ marginBottom: 4 }}><Icon name="plus" size={13} /> Ajouter un produit</button>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Raison</label>
              <select className="input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                {reasons[form.type].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <input className="input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Remarque..." />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SALES ─────────────────────────────────────────────────────────────────

export default StockPage;
