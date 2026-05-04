import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl, today, fmtMoney, fmtDate } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";

function SalesPage({ data, onSale, toast }) {
  const { products, sales, settings } = data;
  const { priceSettings } = settings;
  const [modal, setModal] = useState(false);
  // client info
  const [client, setClient] = useState({ name: "", phone: "", quartier: "", delivery: false });
  // cart lines: [{ id, productId, qty, discountType, discountPercent, discountReason }]
  const [cartLines, setCartLines] = useState([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false); // 🛡️ Anti double-clic

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  const addCartLine = () => setCartLines(l => [...l, { id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  const removeCartLine = (id) => setCartLines(l => l.filter(x => x.id !== id));
  const updateCartLine = (id, field, val) => {
    setCartLines(l => l.map(x => x.id === id ? { ...x, [field]: val } : x));
    setErrors(e => { const ne = { ...e }; delete ne[`${id}_${field}`]; return ne; });
  };

  // Compute per-line totals
  const lineCalcs = useMemo(() => cartLines.map(line => {
    const prod = productMap[line.productId];
    const qty = parseInt(line.qty) || 1;
    const basePrice = prod?.price || 0;
    const baseTotal = basePrice * qty;
    // auto volume discount
    const autoVol = priceSettings?.volumeDiscounts
      ? (priceSettings.volumeDiscounts.filter(vd => qty >= vd.minQty).sort((a, b) => b.percent - a.percent)[0]?.percent || 0)
      : 0;
    const effectivePct = line.discountType === "none" ? 0
      : line.discountType === "volume" ? autoVol
      : parseInt(line.discountPercent) || 0;
    const discountAmount = Math.round(baseTotal * effectivePct / 100);
    return { prod, qty, basePrice, baseTotal, autoVol, effectivePct, discountAmount, total: baseTotal - discountAmount };
  }), [cartLines, productMap, priceSettings]);

  const grandTotal = useMemo(() => lineCalcs.reduce((s, l) => s + l.total, 0), [lineCalcs]);

  const handleSale = () => {
    if (submitting) return; // 🛡️ Anti double-clic
    const errs = {};
    cartLines.forEach((line, i) => {
      const calc = lineCalcs[i];
      if (!line.productId) errs[`${line.id}_productId`] = "Sélectionnez un produit";
      else {
        if (!line.qty || isNaN(parseInt(line.qty)) || parseInt(line.qty) < 1) errs[`${line.id}_qty`] = "Quantité ≥ 1";
        else if (calc.prod && parseInt(line.qty) > calc.prod.stock)
          errs[`${line.id}_qty`] = `Stock insuffisant (${calc.prod.stock} dispo)`;
      }
      if (line.discountType === "custom") {
        const pct = parseInt(line.discountPercent);
        if (isNaN(pct) || pct < 1 || pct > 100) errs[`${line.id}_discountPercent`] = "Entre 1 et 100%";
      }
    });
    if (client.phone && !/^[\d\s\+\-]{7,15}$/.test(client.phone.trim()))
      errs.phone = "Numéro invalide";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // 🛡️ Double sécurité stock — vérification finale avant enregistrement
    for (let i = 0; i < cartLines.length; i++) {
      const line = cartLines[i];
      const calc = lineCalcs[i];
      const qty = parseInt(line.qty) || 0;
      if (calc.prod && qty > calc.prod.stock) {
        alert(`Stock insuffisant pour "${calc.prod.model} — ${calc.prod.design}" (${calc.prod.stock} disponible(s)).`);
        return;
      }
    }

    const saleDate = today();
    const newSales = cartLines.map((line, i) => {
      const calc = lineCalcs[i];
      return {
        id: uid(), date: saleDate,
        productId: line.productId, qty: calc.qty,
        price: calc.basePrice, total: calc.baseTotal,
        discountType: line.discountType,
        discountPercent: calc.effectivePct,
        discountAmount: calc.discountAmount,
        totalAfterDiscount: calc.total,
        discountReason: line.discountReason,
        client: sanitize(client.name, 100), phone: sanitize(client.phone, 20),
        quartier: sanitize(client.quartier, 100), delivery: client.delivery,
      };
    });
    setSubmitting(true);
    onSale(newSales);
    (toast || window.alert)(`✅ Vente enregistrée — ${newSales.length} ligne(s) — Total : ${fmtMoney(grandTotal)}`);
    setModal(false);
    setClient({ name: "", phone: "", quartier: "", delivery: false });
    setCartLines([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "" }]);
    setErrors({});
    setTimeout(() => setSubmitting(false), 600); // Déverrouille après 600ms
  };

  const filtered = useMemo(() =>
    sales.filter(s => {
      const prod = productMap[s.productId];
      const q = search.toLowerCase();
      return (!q || (prod && (`${prod.model} ${prod.design}`).toLowerCase().includes(q)) || (s.client || "").toLowerCase().includes(q))
        && (!dateFrom || s.date >= dateFrom)
        && (!dateTo || s.date <= dateTo);
    }).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sales, productMap, search, dateFrom, dateTo]
  );

  const totalRev = useMemo(() =>
    filtered.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0),
    [filtered]
  );

  const openModal = () => { setModal(true); setErrors({}); };
  const closeModal = () => {
    setModal(false); setErrors({});
    setClient({ name: "", phone: "", quartier: "", delivery: false });
    setCartLines([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  };

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Ventes ({filtered.length})</span>
        <button className="btn btn-primary btn-sm" onClick={openModal}><Icon name="plus" size={14} /> Nouvelle vente</button>
      </div>
      <div className="filter-row">
        <input className="input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 2 }} />
        <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ flex: 1 }} />
        <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ flex: 1 }} />
      </div>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--text2)" }}>CA filtré :</span>
        <span style={{ fontWeight: 800, color: "var(--success)", fontSize: 16 }}>{fmtMoney(totalRev)}</span>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Date</th><th scope="col">Produit</th><th scope="col">Qté</th><th scope="col">Total</th><th scope="col">Remise</th><th scope="col">Client</th><th scope="col">Quartier</th><th scope="col">Livraison</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="empty">Aucune vente</td></tr>}
              {filtered.map(s => {
                const prod = productMap[s.productId];
                return (
                  <tr key={s.id}>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>{fmtDate(s.date)}</td>
                    <td style={{ fontWeight: 500 }}>{prod ? `${prod.model} — ${prod.design}` : "—"}</td>
                    <td>{s.qty}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(s.totalAfterDiscount ?? s.total)}</td>
                    <td>
                      {s.discountPercent > 0
                        ? <span className="badge badge-gold"><Icon name="percent" size={10} /> -{s.discountPercent}%</span>
                        : <span style={{ color: "var(--text2)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{s.client || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>{s.quartier || "—"}</td>
                    <td>{s.delivery ? <span className="badge badge-info">Livraison</span> : <span style={{ color: "var(--text2)", fontSize: 12 }}>Non</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title="Enregistrer une vente" onClose={closeModal} wide footer={<>
          <button className="btn btn-outline" onClick={closeModal}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSale} disabled={submitting}>{submitting ? "Enregistrement..." : `Valider la vente — ${fmtMoney(grandTotal)}`}</button>
        </>}>

          {/* ── Panier produits ── */}
          <p className="section-label">Produits *</p>
          {cartLines.map((line, i) => {
            const calc = lineCalcs[i];
            const lineModel = line._model || "";
            const designsForModel = lineModel ? products.filter(p => p.model === lineModel && p.stock > 0) : [];
            return (
              <div key={line.id} style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  {/* Étape 1 : Modèle */}
                  <div style={{ flex: 2 }}>
                    <select
                      className="input"
                      value={lineModel}
                      onChange={e => {
                        const newModel = e.target.value;
                        setCartLines(l => l.map(x => x.id === line.id ? { ...x, _model: newModel, productId: "" } : x));
                      }}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">① Modèle</option>
                      {[...new Set(products.filter(p => p.stock > 0).map(p => p.model))].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {/* Étape 2 : Design */}
                  <div style={{ flex: 2 }}>
                    <select
                      className={`input${errors[`${line.id}_productId`] ? " input-error" : ""}`}
                      value={line.productId}
                      onChange={e => updateCartLine(line.id, "productId", e.target.value)}
                      disabled={!lineModel}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">② Design</option>
                      {designsForModel.map(p => <option key={p.id} value={p.id}>{p.design} — {p.stock} dispo — {fmtMoney(p.price)}</option>)}
                    </select>
                    {errors[`${line.id}_productId`] && <FieldError msg={errors[`${line.id}_productId`]} />}
                  </div>
                  {/* Quantité */}
                  <div style={{ flex: 1 }}>
                    <input
                      className={`input${errors[`${line.id}_qty`] ? " input-error" : ""}`}
                      type="number" min="1"
                      value={line.qty}
                      onChange={e => updateCartLine(line.id, "qty", e.target.value)}
                      placeholder="Qté"
                      style={{ fontSize: 12 }}
                    />
                    {errors[`${line.id}_qty`] && <FieldError msg={errors[`${line.id}_qty`]} />}
                  </div>
                  {cartLines.length > 1 && (
                    <button className="btn btn-danger btn-sm btn-icon" style={{ marginTop: 1 }} onClick={() => removeCartLine(line.id)}><Icon name="trash" size={13} /></button>
                  )}
                </div>

                {/* Remise par ligne */}
                <div className="tabs" style={{ marginBottom: 8 }}>
                  <button className={`tab ${line.discountType === "none" ? "active" : ""}`} onClick={() => updateCartLine(line.id, "discountType", "none")}>Sans remise</button>
                  {calc.autoVol > 0 && (
                    <button className={`tab ${line.discountType === "volume" ? "active" : ""}`} onClick={() => updateCartLine(line.id, "discountType", "volume")}>Volume (-{calc.autoVol}%)</button>
                  )}
                  <button className={`tab ${line.discountType === "custom" ? "active" : ""}`} onClick={() => updateCartLine(line.id, "discountType", "custom")}>Exceptionnelle</button>
                </div>
                {line.discountType === "custom" && (
                  <div className="form-grid" style={{ marginBottom: 8 }}>
                    <div className="form-group">
                      <input
                        className={`input${errors[`${line.id}_discountPercent`] ? " input-error" : ""}`}
                        type="number" min="1" max="100"
                        value={line.discountPercent}
                        onChange={e => updateCartLine(line.id, "discountPercent", e.target.value)}
                        placeholder="% remise"
                      />
                      {errors[`${line.id}_discountPercent`] && <FieldError msg={errors[`${line.id}_discountPercent`]} />}
                    </div>
                    <div className="form-group">
                      <input className="input" value={line.discountReason} onChange={e => updateCartLine(line.id, "discountReason", e.target.value)} placeholder="Motif (optionnel)" />
                    </div>
                  </div>
                )}

                {/* Sous-total ligne */}
                {calc.prod && (
                  <div style={{ fontSize: 12, color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
                    <span>{calc.qty} × {fmtMoney(calc.basePrice)}{calc.effectivePct > 0 ? ` — remise ${calc.effectivePct}%` : ""}</span>
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(calc.total)}</span>
                  </div>
                )}
              </div>
            );
          })}

          <button className="btn btn-outline btn-sm" onClick={addCartLine} style={{ marginBottom: 4 }}><Icon name="plus" size={13} /> Ajouter un produit</button>

          {/* Total général */}
          <div className="discount-preview">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>Total à payer ({cartLines.length} ligne{cartLines.length > 1 ? "s" : ""})</span>
              <span style={{ fontWeight: 800, color: "var(--success)", fontSize: 16 }}>{fmtMoney(grandTotal)}</span>
            </div>
          </div>

          <div className="divider" />
          <p className="section-label">Client (optionnel)</p>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nom client</label>
              <input className="input" value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} placeholder="Moussa Diallo" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input
                className={`input${errors.phone ? " input-error" : ""}`}
                value={client.phone}
                onChange={e => { setClient(c => ({ ...c, phone: e.target.value })); setErrors(er => ({ ...er, phone: undefined })); }}
                placeholder="77 XXX XX XX"
              />
              <FieldError msg={errors.phone} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Quartier</label>
            <input className="input" value={client.quartier} onChange={e => setClient(c => ({ ...c, quartier: e.target.value }))} placeholder="Plateau, Médina..." />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={client.delivery} onChange={e => setClient(c => ({ ...c, delivery: e.target.checked }))} />
            <Icon name="truck" size={14} /> Livraison à domicile
          </label>
        </Modal>
      )}
    </div>
  );
}

// ─── REPORTS ───────────────────────────────────────────────────────────────

export default SalesPage;
