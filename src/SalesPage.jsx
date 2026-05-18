import { useState, useMemo, useCallback, memo } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { uid, sanitize, getProductImageUrl, today, fmtMoney, fmtDate } from "./utils.js";
import { LOW_STOCK } from "./constants.js";

// ─── TICKET DE CAISSE ───────────────────────────────────────────────────────
function TicketModal({ sales, productMap, onClose }) {
  const date     = sales[0]?.date   || today();
  const client   = sales[0]?.client || "";
  const phone    = sales[0]?.phone  || "";
  const quartier = sales[0]?.quartier || "";
  const delivery = sales[0]?.delivery || false;
  const remarque = sales[0]?.remarque || "";

  const grandTotal = sales.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0);
  const totalDiscount = sales.reduce((s, v) => s + (v.discountAmount || 0), 0);
  const totalBrut = sales.reduce((s, v) => s + v.total, 0);

  // ── Texte WhatsApp ──────────────────────────────────────────────────────
  const whatsappText = () => {
    const lines = [
      `🧾 *CULTURECASE GS — Ticket de caisse*`,
      `📅 Date : ${fmtDate(date)}`,
      ``,
      `*Produit(s) :*`,
      ...sales.map(s => {
        const p = productMap[s.productId];
        const nom = p ? `${p.model} — ${p.design}` : "—";
        const remise = s.discountPercent > 0 ? ` _(remise ${s.discountPercent}%)_` : "";
        const motif  = s.discountPercent > 0 && s.discountReason ? ` — _Motif : ${s.discountReason}_` : "";
        return `• ${nom} × ${s.qty} → *${fmtMoney(s.totalAfterDiscount ?? s.total)}*${remise}${motif}`;
      }),
      ``,
      totalDiscount > 0 ? `💸 Remise totale : -${fmtMoney(totalDiscount)}` : null,
      `✅ *Total payé : ${fmtMoney(grandTotal)}*`,
      ``,
      client   ? `👤 Client : ${client}`                  : null,
      phone    ? `📞 Tél : ${phone}`                      : null,
      quartier ? `📍 Quartier : ${quartier}`              : null,
      delivery ? `🚚 *Livraison à domicile*`              : null,
      remarque ? `📝 Remarque : ${remarque}`              : null,
      ``,
      `_Merci pour votre achat ! 🙏_`,
    ].filter(l => l !== null).join("\n");

    const encoded = encodeURIComponent(lines);
    const url = phone
      ? `https://wa.me/${phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // ── Impression ──────────────────────────────────────────────────────────
  const printTicket = () => {
    const printWin = window.open("", "_blank", "width=400,height=600");
    printWin.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Ticket — Culturecase GS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 20px 16px;
      max-width: 300px;
      margin: 0 auto;
    }
    .center  { text-align: center; }
    .bold    { font-weight: 700; }
    .sep     { border: none; border-top: 1px dashed #888; margin: 10px 0; }
    .row     { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .label   { color: #555; }
    .total   { font-size: 16px; font-weight: 700; }
    .success { color: #059669; }
    .small   { font-size: 11px; color: #777; }
    h1       { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    h1 span  { color: #7c3aed; }
    .badge   { display: inline-block; background: #f3f0ff; color: #7c3aed; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom: 14px;">
    <h1>Culture<span>case</span> GS</h1>
    <p class="small">Gestion de stock — Ticket de caisse</p>
  </div>

  <hr class="sep" />

  <div class="row"><span class="label">Date</span><span>${fmtDate(date)}</span></div>
  ${client   ? `<div class="row"><span class="label">Client</span><span>${client}</span></div>` : ""}
  ${phone    ? `<div class="row"><span class="label">Tél</span><span>${phone}</span></div>` : ""}
  ${quartier ? `<div class="row"><span class="label">Quartier</span><span>${quartier}</span></div>` : ""}
  ${delivery ? `<div class="row"><span class="label">Livraison</span><span class="badge">À domicile</span></div>` : ""}
  ${remarque ? `<div class="row"><span class="label">Remarque</span><span style="font-style:italic;color:#555;">${remarque}</span></div>` : ""}

  <hr class="sep" />

  <p class="bold" style="margin-bottom: 8px;">Produit(s)</p>
  ${sales.map(s => {
    const p = productMap[s.productId];
    const nom = p ? `${p.model} — ${p.design}` : "—";
    const remise = s.discountPercent > 0
      ? `<div class="row small"><span>Remise ${s.discountPercent}%</span><span>-${fmtMoney(s.discountAmount || 0)}</span></div>` : "";
    const motif = s.discountPercent > 0 && s.discountReason
      ? `<div class="row small" style="font-style:italic;color:#888;"><span>Motif</span><span>${s.discountReason}</span></div>` : "";
    return `
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dotted #ddd;">
        <div class="bold">${nom}</div>
        <div class="row small" style="margin-top: 4px;">
          <span>${s.qty} × ${fmtMoney(s.price)}</span>
          <span>${fmtMoney(s.total)}</span>
        </div>
        ${remise}
        ${motif}
        <div class="row bold" style="margin-top: 2px;">
          <span>Sous-total</span>
          <span class="success">${fmtMoney(s.totalAfterDiscount ?? s.total)}</span>
        </div>
      </div>`;
  }).join("")}

  <hr class="sep" />

  ${totalDiscount > 0 ? `<div class="row"><span class="label">Remise totale</span><span>-${fmtMoney(totalDiscount)}</span></div>` : ""}
  <div class="row total">
    <span>TOTAL PAYÉ</span>
    <span class="success">${fmtMoney(grandTotal)}</span>
  </div>

  <hr class="sep" />

  <div class="center small" style="margin-top: 12px; line-height: 1.8;">
    Merci pour votre achat ! 🙏<br/>
    <span style="color: #7c3aed; font-weight: 700;">Culturecase GS</span>
  </div>
</body>
</html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
  };

  return (
    <Modal
      title="🧾 Ticket de caisse"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          <button
            className="btn btn-success"
            onClick={whatsappText}
            style={{ gap: 6 }}
          >
            <span style={{ fontSize: 15 }}>📲</span> WhatsApp
          </button>
          <button className="btn btn-primary" onClick={printTicket}>
            <Icon name="download" size={13} /> Imprimer
          </button>
        </>
      }
    >
      {/* Aperçu du ticket dans la modale */}
      <div style={{
        background: "var(--bg3)", borderRadius: 10,
        padding: "18px 20px", fontFamily: "'Courier New', monospace",
        fontSize: 13, lineHeight: 1.7,
      }}>
        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Culture<span style={{ color: "var(--accent2)" }}>case</span> GS
          </div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>Ticket de caisse</div>
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "10px 0" }} />

        {/* Infos vente */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          <Row label="Date"      value={fmtDate(date)} />
          {client   && <Row label="Client"    value={client} />}
          {phone    && <Row label="Tél"       value={phone} />}
          {quartier && <Row label="Quartier"  value={quartier} />}
          {delivery && <Row label="Livraison" value="🚚 À domicile" accent />}
          {remarque && <Row label="Remarque"  value={remarque} italic />}
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "10px 0" }} />

        {/* Lignes produits */}
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Produit(s)
        </div>
        {sales.map(s => {
          const p = productMap[s.productId];
          return (
            <div key={s.id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px dotted var(--border)" }}>
              <div style={{ fontWeight: 700 }}>{p ? `${p.model} — ${p.design}` : "—"}</div>
              <Row label={`${s.qty} × ${fmtMoney(s.price)}`} value={fmtMoney(s.total)} small />
              {s.discountPercent > 0 && (
                <Row label={`Remise ${s.discountPercent}%`} value={`-${fmtMoney(s.discountAmount || 0)}`} small warn />
              )}
              {s.discountPercent > 0 && s.discountReason && (
                <Row label="Motif" value={s.discountReason} small italic />
              )}
              <Row label="Sous-total" value={fmtMoney(s.totalAfterDiscount ?? s.total)} bold success />
            </div>
          );
        })}

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "10px 0" }} />

        {/* Totaux */}
        {totalDiscount > 0 && (
          <Row label="Remise totale" value={`-${fmtMoney(totalDiscount)}`} warn />
        )}
        <Row label="TOTAL PAYÉ" value={fmtMoney(grandTotal)} bold success large />

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "12px 0 8px" }} />

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text2)" }}>
          Merci pour votre achat ! 🙏
        </div>
      </div>
    </Modal>
  );
}

// ── Ligne de ticket ──────────────────────────────────────────────────────────
function Row({ label, value, bold, small, success, warn, accent, large, italic }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: small ? 11 : large ? 14 : 13,
      color: success ? "var(--success)" : warn ? "var(--warn)" : accent ? "var(--accent2)" : "var(--text)",
      fontWeight: bold || large ? 700 : 400,
      fontStyle: italic ? "italic" : "normal",
      marginBottom: 2,
    }}>
      <span style={{ color: bold || large ? "inherit" : "var(--text2)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── SALES PAGE ─────────────────────────────────────────────────────────────
function SalesPage({ data, onSale, toast }) {
  const { products, sales, settings } = data;
  const { priceSettings } = settings;
  const designs = settings?.designs || [];

  const [modal, setModal]         = useState(false);
  const [ticket, setTicket]       = useState(null); // sales[] à afficher dans le ticket
  const [client, setClient]       = useState({ name: "", phone: "", quartier: "", delivery: false, remarque: "" });

  // ── Normalise le numéro de téléphone : ajoute +223 si aucun indicatif
  const normalizePhone = (raw) => {
    if (!raw || !raw.trim()) return "";
    const trimmed = raw.trim();
    // Déjà un indicatif (commence par + ou 00)
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) return trimmed;
    // Pas d'indicatif → on préfixe avec +223 (Mali)
    return "+223" + trimmed.replace(/^0/, ""); // supprime le 0 initial si présent
  };
  const [cartLines, setCartLines] = useState([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  const addCartLine    = () => setCartLines(l => [...l, { id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  const removeCartLine = (id) => setCartLines(l => l.filter(x => x.id !== id));
  const updateCartLine = (id, field, val) => {
    setCartLines(l => l.map(x => x.id === id ? { ...x, [field]: val } : x));
    setErrors(e => { const ne = { ...e }; delete ne[`${id}_${field}`]; return ne; });
  };

  const lineCalcs = useMemo(() => cartLines.map(line => {
    const prod      = productMap[line.productId];
    const qty       = parseInt(line.qty) || 1;
    const basePrice = prod?.price || 0;
    const baseTotal = basePrice * qty;
    const autoVol   = priceSettings?.volumeDiscounts
      ? (priceSettings.volumeDiscounts.filter(vd => qty >= vd.minQty).sort((a, b) => b.percent - a.percent)[0]?.percent || 0)
      : 0;
    const effectivePct   = line.discountType === "none" ? 0 : line.discountType === "volume" ? autoVol : parseInt(line.discountPercent) || 0;
    const discountAmount = Math.round(baseTotal * effectivePct / 100);
    return { prod, qty, basePrice, baseTotal, autoVol, effectivePct, discountAmount, total: baseTotal - discountAmount };
  }), [cartLines, productMap, priceSettings]);

  const grandTotal = useMemo(() => lineCalcs.reduce((s, l) => s + l.total, 0), [lineCalcs]);

  const handleSale = () => {
    if (submitting) return;
    const errs = {};
    cartLines.forEach((line, i) => {
      const calc = lineCalcs[i];
      if (!line.productId) errs[`${line.id}_productId`] = "Sélectionnez un produit";
      else {
        if (!line.qty || isNaN(parseInt(line.qty)) || parseInt(line.qty) < 1) errs[`${line.id}_qty`] = "Quantité ≥ 1";
        else if (calc.prod && parseInt(line.qty) > calc.prod.stock) errs[`${line.id}_qty`] = `Stock insuffisant (${calc.prod.stock} dispo)`;
      }
      if (line.discountType === "custom") {
        const pct = parseInt(line.discountPercent);
        if (isNaN(pct) || pct < 1 || pct > 100) errs[`${line.id}_discountPercent`] = "Entre 1 et 100%";
      }
    });
    if (client.phone && !/^[\d\s\+\-\(\)\.]{6,20}$/.test(normalizePhone(client.phone).trim())) errs.phone = "Numéro invalide";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    for (let i = 0; i < cartLines.length; i++) {
      const line = cartLines[i];
      const calc = lineCalcs[i];
      const qty  = parseInt(line.qty) || 0;
      if (calc.prod && qty > calc.prod.stock) {
        (toast || window.alert)(`❌ Stock insuffisant pour "${calc.prod.model} — ${calc.prod.design}" (${calc.prod.stock} dispo).`);
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
        client: sanitize(client.name, 100), phone: sanitize(normalizePhone(client.phone), 20),
        quartier: sanitize(client.quartier, 100), delivery: client.delivery,
        remarque: sanitize(client.remarque, 300),
      };
    });

    setSubmitting(true);
    onSale(newSales);
    setModal(false);

    // ── Ouvre le ticket après la vente ──────────────────────────────────
    setTicket(newSales);

    setClient({ name: "", phone: "", quartier: "", delivery: false, remarque: "" });
    setCartLines([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
    setErrors({});
    setTimeout(() => setSubmitting(false), 600);
  };

  const filtered = useMemo(() =>
    sales.filter(s => {
      const prod = productMap[s.productId];
      const q    = search.toLowerCase();
      return (!q || (prod && (`${prod.model} ${prod.design}`).toLowerCase().includes(q)) || (s.client || "").toLowerCase().includes(q))
        && (!dateFrom || s.date >= dateFrom)
        && (!dateTo   || s.date <= dateTo);
    }).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sales, productMap, search, dateFrom, dateTo]
  );

  const totalRev = useMemo(() => filtered.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0), [filtered]);

  const openModal  = () => { setModal(true); setErrors({}); };
  const closeModal = () => {
    setModal(false); setErrors({});
    setClient({ name: "", phone: "", quartier: "", delivery: false, remarque: "" });
    setCartLines([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  };

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Ventes ({filtered.length})</span>
        <button className="btn btn-primary btn-sm" onClick={openModal}>
          <Icon name="plus" size={14} /> Nouvelle vente
        </button>
      </div>

      <div className="filter-row">
        <input className="input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 2 }} />
        <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ flex: 1 }} />
        <input className="input" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ flex: 1 }} />
        {(dateFrom || dateTo || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }} title="Effacer les filtres">✕</button>
        )}
      </div>

      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--text2)" }}>CA filtré :</span>
        <span style={{ fontWeight: 800, color: "var(--success)", fontSize: 16 }}>{fmtMoney(totalRev)}</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Produit</th>
                <th scope="col">Qté</th>
                <th scope="col">Total</th>
                <th scope="col">Remise</th>
                <th scope="col">Client</th>
                <th scope="col">Quartier</th>
                <th scope="col">Livraison</th>
                <th scope="col">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="empty">Aucune vente</td></tr>}
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
                    <td>
                      <button
                        className="btn btn-outline btn-sm btn-icon"
                        title="Voir le ticket"
                        onClick={() => setTicket([s])}
                      >
                        🧾
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modale nouvelle vente ── */}
      {modal && (
        <Modal title="Enregistrer une vente" onClose={closeModal} wide footer={<>
          <button className="btn btn-outline" onClick={closeModal}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSale} disabled={submitting}>
            {submitting ? "Enregistrement..." : `Valider la vente — ${fmtMoney(grandTotal)}`}
          </button>
        </>}>

          <p className="section-label">Produits *</p>
          {cartLines.map((line, i) => {
            const calc = lineCalcs[i];
            const lineModel = line._model || "";
            const designsForModel = lineModel ? products.filter(p => p.model === lineModel && p.stock > 0) : [];
            return (
              <div key={line.id} style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 2 }}>
                    <select className="input" value={lineModel} onChange={e => { const m = e.target.value; setCartLines(l => l.map(x => x.id === line.id ? { ...x, _model: m, productId: "" } : x)); }} style={{ fontSize: 12 }}>
                      <option value="">① Modèle</option>
                      {[...new Set(products.filter(p => p.stock > 0).map(p => p.model))].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <select className={`input${errors[`${line.id}_productId`] ? " input-error" : ""}`} value={line.productId} onChange={e => updateCartLine(line.id, "productId", e.target.value)} disabled={!lineModel} style={{ fontSize: 12 }}>
                      <option value="">② Design</option>
                      {designsForModel.map(p => <option key={p.id} value={p.id}>{p.design} — {p.stock} dispo — {fmtMoney(p.price)}</option>)}
                    </select>
                    {errors[`${line.id}_productId`] && <FieldError msg={errors[`${line.id}_productId`]} />}
                    {line.productId && (() => { const prod = products.find(p => p.id === line.productId); const img = prod ? getProductImageUrl(prod, designs) : ""; return img ? <img src={img} alt="" loading="lazy" style={{ marginTop: 5, height: 40, borderRadius: 6, objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : null; })()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input className={`input${errors[`${line.id}_qty`] ? " input-error" : ""}`} type="number" min="1" value={line.qty} onChange={e => updateCartLine(line.id, "qty", e.target.value)} placeholder="Qté" style={{ fontSize: 12 }} />
                    {errors[`${line.id}_qty`] && <FieldError msg={errors[`${line.id}_qty`]} />}
                  </div>
                  {cartLines.length > 1 && (
                    <button className="btn btn-danger btn-sm btn-icon" style={{ marginTop: 1 }} onClick={() => removeCartLine(line.id)}><Icon name="trash" size={13} /></button>
                  )}
                </div>

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
                      <input className={`input${errors[`${line.id}_discountPercent`] ? " input-error" : ""}`} type="number" min="1" max="100" value={line.discountPercent} onChange={e => updateCartLine(line.id, "discountPercent", e.target.value)} placeholder="% remise" />
                      {errors[`${line.id}_discountPercent`] && <FieldError msg={errors[`${line.id}_discountPercent`]} />}
                    </div>
                    <div className="form-group">
                      <input className="input" value={line.discountReason} onChange={e => updateCartLine(line.id, "discountReason", e.target.value)} placeholder="Motif (optionnel)" />
                    </div>
                  </div>
                )}

                {calc.prod && (
                  <div style={{ fontSize: 12, color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
                    <span>{calc.qty} × {fmtMoney(calc.basePrice)}{calc.effectivePct > 0 ? ` — remise ${calc.effectivePct}%` : ""}</span>
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(calc.total)}</span>
                  </div>
                )}
              </div>
            );
          })}

          <button className="btn btn-outline btn-sm" onClick={addCartLine} style={{ marginBottom: 4 }}>
            <Icon name="plus" size={13} /> Ajouter un produit
          </button>

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
              <div style={{ position: "relative" }}>
                <input
                  className={`input${errors.phone ? " input-error" : ""}`}
                  value={client.phone}
                  onChange={e => { setClient(c => ({ ...c, phone: e.target.value })); setErrors(er => ({ ...er, phone: undefined })); }}
                  placeholder="76 XXX XX XX"
                  style={{ paddingRight: 110 }}
                />
                {!client.phone.trim().startsWith("+") && !client.phone.trim().startsWith("00") && client.phone.trim() && (
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text2)", pointerEvents: "none", background: "var(--bg2)", padding: "2px 6px", borderRadius: 4 }}>
                    → +223 auto
                  </span>
                )}
              </div>
              <FieldError msg={errors.phone} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Quartier</label>
            <input className="input" value={client.quartier} onChange={e => setClient(c => ({ ...c, quartier: e.target.value }))} placeholder="Plateau, Médina..." />
          </div>
          <div className="form-group">
            <label className="form-label">Remarque</label>
            <input className="input" value={client.remarque} onChange={e => setClient(c => ({ ...c, remarque: e.target.value }))} placeholder="Livraison express, couleur spéciale..." />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={client.delivery} onChange={e => setClient(c => ({ ...c, delivery: e.target.checked }))} />
            <Icon name="truck" size={14} /> Livraison à domicile
          </label>
        </Modal>
      )}

      {/* ── Modale ticket de caisse ── */}
      {ticket && (
        <TicketModal
          sales={ticket}
          productMap={productMap}
          onClose={() => setTicket(null)}
        />
      )}
    </div>
  );
}

export default SalesPage;
