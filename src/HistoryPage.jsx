import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl, toDateStr, fmtMoney, fmtDate, fmtDateTime } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";

function HistoryPage({ data }) {
  const { sales, products } = data;
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  // Group sales by client, then sub-group by groupId (multi-produits = 1 achat)
  const clientGroups = useMemo(() => {
    const groups = {};
    sales.forEach(s => {
      const phone = (s.phone || "").trim();
      const name  = (s.client || "").trim();
      const key   = phone || name || "__anon__";
      if (!groups[key]) groups[key] = { name, phone, quartier: s.quartier || "", salesRaw: [] };
      if (name) { groups[key].name = name; }
      if (phone) { groups[key].phone = phone; }
      if (s.quartier) groups[key].quartier = s.quartier;
      groups[key].salesRaw.push(s);
    });
    return Object.values(groups).map(g => {
      // Regrouper les ventes par groupId → chaque "achat" peut contenir plusieurs lignes
      const purchaseMap = new Map();
      g.salesRaw.forEach(s => {
        const gid = s.groupId || s.id;
        if (!purchaseMap.has(gid)) purchaseMap.set(gid, []);
        purchaseMap.get(gid).push(s);
      });
      const purchases = Array.from(purchaseMap.values()).sort((a, b) => new Date(b[0].date) - new Date(a[0].date));
      const totalSpent = g.salesRaw.reduce((s, p) => s + (p.totalAfterDiscount ?? p.total), 0);
      const lastDate   = g.salesRaw.map(p => p.date).sort().reverse()[0];
      const daysSince  = lastDate ? Math.floor((Date.now() - new Date(lastDate)) / 86400000) : 999;
      const nbPurchases = purchases.length;

      // ── Segmentation — 2 gammes : 3 500 FCFA (≤ iPhone 13 PM) et 5 000 FCFA (14→17 PM) ──
      // VIP       : ≥5 achats OU ≥25 000 FCFA (5 coques à 5 000 ou 6 à 3 500)
      // Fidèle    : ≥3 achats, actif dans les 45 derniers jours
      // Inactif   : absent depuis >45 jours avec 2+ achats
      // Nouveau   : 1 seul achat
      let segment;
      if (nbPurchases >= 5 || totalSpent >= 25000) {
        segment = "vip";
      } else if (nbPurchases >= 3 && daysSince <= 45) {
        segment = "fidele";
      } else if (daysSince > 45 && nbPurchases >= 2) {
        segment = "inactif";
      } else if (nbPurchases === 1) {
        segment = "nouveau";
      } else {
        segment = "regulier";
      }

      return { ...g, purchases, totalSpent, lastDate, daysSince, segment };
    }).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
  }, [sales]);

  const [segmentFilter, setSegmentFilter] = useState("tous");
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  // Compteurs par segment pour les boutons
  const segmentCounts = useMemo(() => {
    const counts = { tous: clientGroups.length, vip: 0, fidele: 0, nouveau: 0, inactif: 0, regulier: 0 };
    clientGroups.forEach(g => { if (counts[g.segment] !== undefined) counts[g.segment]++; });
    return counts;
  }, [clientGroups]);

  // Config des segments
  const SEGMENTS = [
    { key: "tous",     label: "Tous",     color: "var(--text2)",    bg: "var(--bg2)" },
    { key: "vip",      label: "⭐ VIP",    color: "#854F0B",         bg: "#FAEEDA" },
    { key: "fidele",   label: "💚 Fidèle", color: "#3B6D11",         bg: "#EAF3DE" },
    { key: "nouveau",  label: "🆕 Nouveau",color: "#185FA5",         bg: "#E6F1FB" },
    { key: "inactif",  label: "😴 Inactif",color: "#A32D2D",         bg: "#FCEBEB" },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clientGroups.filter(g => {
      const nameMatch = !q || g.name.toLowerCase().includes(q) || g.phone.includes(q) || g.quartier.toLowerCase().includes(q);
      const dateMatch = g.purchases.some(p =>
        (!dateFrom || toDateStr(p[0]?.date || p.date) >= dateFrom) && (!dateTo || toDateStr(p[0]?.date || p.date) <= dateTo)
      );
      const segmentMatch = segmentFilter === "tous" || g.segment === segmentFilter;
      return nameMatch && ((!dateFrom && !dateTo) || dateMatch) && segmentMatch;
    });
  }, [clientGroups, search, dateFrom, dateTo, segmentFilter]);

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Historique clients ({filtered.length} client{filtered.length !== 1 ? "s" : ""})</span>
      </div>
      <div className="filter-row">
        <div style={{ position: "relative", flex: 2 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text2)" }}><Icon name="search" size={14} /></span>
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Nom, téléphone, quartier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ flex: 1 }} placeholder="Du" />
        <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ flex: 1 }} placeholder="Au" />
      </div>

      {/* ── Filtres par segment ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {SEGMENTS.map(seg => (
          <button
            key={seg.key}
            onClick={() => setSegmentFilter(seg.key)}
            style={{
              padding: "5px 12px", borderRadius: 20, border: "1.5px solid",
              borderColor: segmentFilter === seg.key ? seg.color : "var(--border)",
              background: segmentFilter === seg.key ? seg.bg : "transparent",
              color: segmentFilter === seg.key ? seg.color : "var(--text2)",
              fontSize: 12, fontWeight: segmentFilter === seg.key ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {seg.label}
            {segmentCounts[seg.key] > 0 && (
              <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.8 }}>({segmentCounts[seg.key]})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div className="empty">Aucun client trouvé</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((g, gi) => {
          const key = g.name || `__anon_${gi}`;
          const isOpen = expanded[key];
          const isAnon = !g.name;
          return (
            <div key={key} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Client header row */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", background: isOpen ? "rgba(124,58,237,0.08)" : "transparent", transition: "background 0.15s" }}
                onClick={() => toggleExpand(key)}
              >
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: isAnon ? "var(--bg3)" : "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: isAnon ? "var(--text2)" : "var(--accent2)" }}>
                    {isAnon ? "?" : g.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{isAnon ? "Client anonyme" : g.name}</span>
                    {g.phone && <span style={{ fontSize: 12, color: "var(--text2)", display: "flex", alignItems: "center", gap: 3 }}><Icon name="phone" size={11} />{g.phone}</span>}
                    {g.quartier && <span className="badge badge-purple" style={{ fontSize: 10 }}>{g.quartier}</span>}
                    {g.segment === "vip"     && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FAEEDA", color: "#854F0B", fontWeight: 700 }}>⭐ VIP</span>}
                    {g.segment === "fidele"  && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#EAF3DE", color: "#3B6D11", fontWeight: 700 }}>💚 Fidèle</span>}
                    {g.segment === "nouveau" && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#E6F1FB", color: "#185FA5", fontWeight: 700 }}>🆕 Nouveau</span>}
                    {g.segment === "inactif" && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FCEBEB", color: "#A32D2D", fontWeight: 700 }}>😴 Inactif</span>}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>{g.purchases.length} achat{g.purchases.length > 1 ? "s" : ""} · {g.salesRaw.length} article{g.salesRaw.length > 1 ? "s" : ""}</span>
                    <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>{fmtMoney(g.totalSpent)}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>Dernier : {fmtDate(g.lastDate)}</span>
                    {g.segment === "inactif" && (
                      <span style={{ fontSize: 11, color: "#A32D2D" }}>· absent depuis {g.daysSince} j</span>
                    )}
                  </div>
                </div>
                <div style={{ color: "var(--text2)", transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                  <Icon name="arrow_down" size={14} />
                </div>
              </div>

              {/* Purchase details */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="history-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "8px 18px", textAlign: "left", fontSize: 10.5, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", borderBottom: "1px solid var(--border)" }}>Date</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", borderBottom: "1px solid var(--border)" }}>Produit</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", borderBottom: "1px solid var(--border)" }}>Qté</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", borderBottom: "1px solid var(--border)" }}>Total</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", borderBottom: "1px solid var(--border)" }}>Remise</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", borderBottom: "1px solid var(--border)" }}>Livraison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.purchases.map(pGroup => {
                        const s = pGroup[0];
                        const isMulti = pGroup.length > 1;
                        const groupTotal = pGroup.reduce((sum, v) => sum + (v.totalAfterDiscount ?? v.total), 0);
                        const totalQty   = pGroup.reduce((sum, v) => sum + v.qty, 0);
                        const hasDiscount = pGroup.some(v => v.discountPercent > 0);
                        const prodLabel = isMulti
                          ? `${pGroup.length} produits`
                          : (() => { const p = productMap[s.productId]; return p ? `${p.model} — ${p.design}` : "—"; })();
                        return (
                          <tr key={s.groupId || s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 18px", color: "var(--text2)", fontSize: 12 }}>
                              <div>{fmtDate(s.date)}</div>
                              {s.date && s.date.length > 10 && (
                                <div style={{ fontSize: 10, marginTop: 1 }}>
                                  {new Date(s.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                              {prodLabel}
                              {isMulti && (
                                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                                  {pGroup.map(v => { const p = productMap[v.productId]; return p ? `${p.model} — ${p.design}` : "—"; }).join(", ")}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px" }}>{totalQty}</td>
                            <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--success)" }}>{fmtMoney(groupTotal)}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {hasDiscount
                                ? <span className="badge badge-gold">remise</span>
                                : <span style={{ color: "var(--text2)", fontSize: 12 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {s.delivery ? <span className="badge badge-info">Oui</span> : <span style={{ color: "var(--text2)", fontSize: 12 }}>Non</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── IMAGE PICKER — upload local compressé (canvas → base64 ~100KB max) ────

export default HistoryPage;
