import { useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { LOW_STOCK } from "./constants.js";
import { fmtMoney } from "./utils.js";

// ─── HELPER : badge de stock ────────────────────────────────────────────────
export const stockBadge = (s) => {
  if (s === 0) return <span className="badge badge-danger">Rupture</span>;
  if (s <= LOW_STOCK)
    return <span className="badge badge-warn">{s} restant</span>;
  return <span className="badge badge-success">{s} en stock</span>;
};

// ─── COMPOSANT : vue stock par modèle (accordéon) ───────────────────────────
export function StockView({
  products,
  modelsWithProducts,
  search,
  openEdit,
  onDelete,
  handleQuickSale,
  isViewer = false,
}) {
  const [expanded, setExpanded] = useState({});

  const toggle   = (m) => setExpanded((e) => ({ ...e, [m]: !e[m] }));
  const openAll  = () => {
    const s = {};
    modelsWithProducts.forEach((m) => { s[m] = true; });
    setExpanded(s);
  };
  const closeAll = () => setExpanded({});

  const stats = useMemo(() => {
    const s = {};
    products.forEach((p) => {
      if (!s[p.model])
        s[p.model] = { total: 0, designs: 0, empty: 0, items: [] };
      s[p.model].total   += p.stock;
      s[p.model].designs += 1;
      if (p.stock === 0) s[p.model].empty += 1;
      s[p.model].items.push(p);
    });
    return s;
  }, [products]);

  const q = search.toLowerCase();

  const visibleModels = modelsWithProducts.filter(
    (m) =>
      !q ||
      m.toLowerCase().includes(q) ||
      (stats[m] ? stats[m].items : []).some((p) =>
        p.design.toLowerCase().includes(q),
      ),
  );

  const totalUnits = products.reduce((s, p) => s + p.stock, 0);
  const totalEmpty = products.filter((p) => p.stock === 0).length;
  const totalFull  = products.filter((p) => p.stock > 0).length;

  return (
    <div>
      {/* ── 4 chiffres globaux ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total unités",       value: totalUnits,                color: "var(--accent2)" },
          { label: "Modèles actifs",     value: modelsWithProducts.length, color: "var(--success)" },
          { label: "Designs en rupture", value: totalEmpty,                color: "var(--danger)"  },
          { label: "Designs en stock",   value: totalFull,                 color: "var(--gold)"    },
        ].map((card) => (
          <div key={card.label} className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Boutons tout ouvrir / fermer ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={openAll}>Tout ouvrir</button>
        <button className="btn btn-outline btn-sm" onClick={closeAll}>Tout fermer</button>
      </div>

      {visibleModels.length === 0 && <div className="empty">Aucun modèle trouvé</div>}

      {/* ── Accordéon ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleModels.map((model) => {
          const st     = stats[model] || { total: 0, designs: 0, empty: 0, items: [] };
          const isOpen = !!expanded[model];
          const pct    = st.designs > 0 ? Math.round(((st.designs - st.empty) / st.designs) * 100) : 0;
          const color  = st.total === 0 ? "var(--danger)" : st.empty > st.designs / 2 ? "var(--warn)" : "var(--success)";
          const label  = st.total === 0 ? "Rupture totale" : st.empty > 0 ? st.empty + " vide" + (st.empty > 1 ? "s" : "") : "Tout en stock";
          const items  = q ? st.items.filter((p) => p.design.toLowerCase().includes(q) || model.toLowerCase().includes(q)) : st.items;

          return (
            <div key={model} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* En-tête cliquable */}
              <div
                onClick={() => toggle(model)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", cursor: "pointer", flexWrap: "wrap", background: isOpen ? "rgba(124,58,237,0.06)" : "transparent", transition: "background 0.15s" }}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 110 }}>{model}</span>
                <div style={{ flex: 2, minWidth: 90, maxWidth: 170 }}>
                  <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 2 }}>{pct}% en stock</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent2)", lineHeight: 1.1 }}>{st.total}</div>
                    <div style={{ fontSize: 10, color: "var(--text2)" }}>unités</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
                    <div style={{ fontSize: 10, color: "var(--text2)" }}>{st.designs} designs</div>
                  </div>
                  <div style={{ color: "var(--text2)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <Icon name="arrow_down" size={14} />
                  </div>
                </div>
              </div>

              {/* Détail déplié */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 18, padding: "8px 18px", background: "var(--bg3)", fontSize: 12, color: "var(--text2)", flexWrap: "wrap" }}>
                    <span>✅ En stock : <strong style={{ color: "var(--success)" }}>{st.designs - st.empty}</strong></span>
                    <span>❌ Vides : <strong style={{ color: "var(--danger)" }}>{st.empty}</strong></span>
                    <span>📦 Total : <strong style={{ color: "var(--accent2)" }}>{st.total}</strong> unités</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Design</th><th>Prix</th><th>Stock</th>{!isViewer && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.slice().sort((a, b) => b.stock - a.stock).map((p) => (
                          <tr key={p.id} style={{ background: p.stock === 0 ? "rgba(239,68,68,0.04)" : "transparent" }}>
                            <td style={{ fontWeight: 500 }}>
                              {p.stock === 0 && <span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700, marginRight: 6 }}>VIDE</span>}
                              {p.design}
                            </td>
                            <td style={{ color: "var(--gold)", fontWeight: 700 }}>{fmtMoney(p.price)}</td>
                            <td>{stockBadge(p.stock)}</td>
                            {!isViewer && (
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(p)} aria-label={`Modifier ${p.model} — ${p.design}`}>
                                    <Icon name="edit" size={12} />
                                  </button>
                                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(p.id)} aria-label={`Supprimer ${p.model} — ${p.design}`}>
                                    <Icon name="trash" size={12} />
                                  </button>
                                  <button className="btn btn-success btn-sm" style={{ fontSize: 11 }} onClick={() => handleQuickSale(p)} aria-label={`Vente rapide ${p.model} — ${p.design}`} disabled={p.stock === 0} title={p.stock === 0 ? "Rupture de stock" : "Enregistrer une vente rapide"}>
                                    ⚡ Vente
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
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
