import { memo, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { StatCard } from "./components.jsx";
import { LOW_STOCK } from "./constants.js";
import { fmtDate, fmtMoney, today } from "./utils.js";

const Dashboard = memo(function Dashboard({ data }) {
  const { products, sales, movements } = data;
  const todayStr = today();
  const monthStr = todayStr.slice(0, 7);

  const stats = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + p.stock, 0);
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const lowStock = products.filter(
      (p) => p.stock > 0 && p.stock <= LOW_STOCK,
    ).length;
    const salesToday = sales.filter((s) => s.date === todayStr);
    const salesMonth = sales.filter((s) => s.date.startsWith(monthStr));
    const revenueToday = salesToday.reduce(
      (s, v) => s + (v.totalAfterDiscount ?? v.total),
      0,
    );
    const revenueMonth = salesMonth.reduce(
      (s, v) => s + (v.totalAfterDiscount ?? v.total),
      0,
    );
    return {
      totalStock,
      outOfStock,
      lowStock,
      salesToday,
      salesMonth,
      revenueToday,
      revenueMonth,
    };
  }, [products, sales, todayStr, monthStr]);

  const recentOps = useMemo(
    () =>
      [
        ...sales.map((s) => ({ ...s, _type: "sale" })),
        ...movements.map((m) => ({ ...m, _type: "mov" })),
      ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 8),
    [sales, movements],
  );

  // Build a product lookup map for O(1) access
  const productMap = useMemo(() => {
    const m = {};
    products.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [products]);

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <StatCard
          label="Stock total"
          value={stats.totalStock}
          sub="unités en stock"
          color="purple"
        />
        <StatCard
          label="Rupture"
          value={stats.outOfStock}
          sub="produits épuisés"
          color="red"
        />
        <StatCard
          label="Stock faible"
          value={stats.lowStock}
          sub={`≤ ${LOW_STOCK} unités`}
          color="amber"
        />
        <StatCard
          label="CA du jour"
          value={fmtMoney(stats.revenueToday)}
          sub={`${stats.salesToday.length} vente(s)`}
          color="green"
        />
      </div>
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <p className="section-label">CA du mois</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "var(--success)" }}>
            {fmtMoney(stats.revenueMonth)}
          </p>
          <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
            {stats.salesMonth.length} vente(s) en {monthStr}
          </p>
        </div>
        <div className="card">
          <p className="section-label">Alertes Stock</p>
          {stats.outOfStock === 0 && stats.lowStock === 0 && (
            <p style={{ color: "var(--success)", fontSize: 13 }}>
              ✓ Tout le stock est OK
            </p>
          )}
          {products
            .filter((p) => p.stock === 0)
            .slice(0, 3)
            .map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>
                  {p.model} — {p.design}
                </span>
                <span className="badge badge-danger">Rupture</span>
              </div>
            ))}
          {products
            .filter((p) => p.stock > 0 && p.stock <= LOW_STOCK)
            .slice(0, 3)
            .map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>
                  {p.model} — {p.design}
                </span>
                <span className="badge badge-warn">{p.stock} restant(s)</span>
              </div>
            ))}
        </div>
      </div>
      <div className="card">
        <p className="section-label" style={{ marginBottom: 14 }}>
          Dernières opérations
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Produit</th>
                <th scope="col">Qté</th>
                <th scope="col">Détail</th>
              </tr>
            </thead>
            <tbody>
              {recentOps.map((op, i) => {
                const prod = productMap[op.productId];
                if (!prod) return null;
                return (
                  <tr key={i}>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      {fmtDate(op.date)}
                    </td>
                    <td>
                      {op._type === "sale" ? (
                        <span className="badge badge-success">Vente</span>
                      ) : op.type === "in" ? (
                        <span className="badge badge-info">Entrée</span>
                      ) : (
                        <span className="badge badge-danger">Sortie</span>
                      )}
                    </td>
                    <td>
                      {prod.model} — {prod.design}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {op._type === "sale"
                        ? `-${op.qty}`
                        : op.type === "in"
                          ? `+${op.qty}`
                          : `-${op.qty}`}
                    </td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      {op._type === "sale" ? (
                        <>
                          {op.client || "—"}
                          {op.discountPercent > 0 && (
                            <span
                              className="badge badge-gold"
                              style={{ marginLeft: 6 }}
                            >
                              -{op.discountPercent}%
                            </span>
                          )}
                        </>
                      ) : (
                        op.reason || "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// ─── PRODUCTS ──────────────────────────────────────────────────────────────
// ─── HELPERS GLOBAUX ───────────────────────────────────────────────────────
export const stockBadge = (s) => {
  if (s === 0) return <span className="badge badge-danger">Rupture</span>;
  if (s <= LOW_STOCK)
    return <span className="badge badge-warn">{s} restant</span>;
  return <span className="badge badge-success">{s} en stock</span>;
};

// ─── STOCK VIEW ────────────────────────────────────────────────────────────
export function StockView({
  products,
  modelsWithProducts,
  search,
  openEdit,
  onDelete,
  handleQuickSale,
}) {
  const [expanded, setExpanded] = useState({});

  const toggle = (m) => setExpanded((e) => ({ ...e, [m]: !e[m] }));
  const openAll = () => {
    const s = {};
    modelsWithProducts.forEach((m) => {
      s[m] = true;
    });
    setExpanded(s);
  };
  const closeAll = () => setExpanded({});

  // Stats agrégées par modèle
  const stats = useMemo(() => {
    const s = {};
    products.forEach((p) => {
      if (!s[p.model])
        s[p.model] = { total: 0, designs: 0, empty: 0, items: [] };
      s[p.model].total += p.stock;
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
  const totalFull = products.filter((p) => p.stock > 0).length;

  return (
    <div>
      {/* ── 4 chiffres globaux ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          { label: "Total unités", value: totalUnits, color: "var(--accent2)" },
          {
            label: "Modèles actifs",
            value: modelsWithProducts.length,
            color: "var(--success)",
          },
          {
            label: "Designs en rupture",
            value: totalEmpty,
            color: "var(--danger)",
          },
          { label: "Designs en stock", value: totalFull, color: "var(--gold)" },
        ].map((card) => (
          <div
            key={card.label}
            className="card"
            style={{ padding: "12px 14px", textAlign: "center" }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Boutons tout ouvrir / fermer ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={openAll}>
          Tout ouvrir
        </button>
        <button className="btn btn-outline btn-sm" onClick={closeAll}>
          Tout fermer
        </button>
      </div>

      {visibleModels.length === 0 && (
        <div className="empty">Aucun modèle trouvé</div>
      )}

      {/* ── Accordéon ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleModels.map((model) => {
          const st = stats[model] || {
            total: 0,
            designs: 0,
            empty: 0,
            items: [],
          };
          const isOpen = !!expanded[model];
          const pct =
            st.designs > 0
              ? Math.round(((st.designs - st.empty) / st.designs) * 100)
              : 0;
          const color =
            st.total === 0
              ? "var(--danger)"
              : st.empty > st.designs / 2
                ? "var(--warn)"
                : "var(--success)";
          const label =
            st.total === 0
              ? "Rupture totale"
              : st.empty > 0
                ? st.empty + " vide" + (st.empty > 1 ? "s" : "")
                : "Tout en stock";
          const items = q
            ? st.items.filter(
                (p) =>
                  p.design.toLowerCase().includes(q) ||
                  model.toLowerCase().includes(q),
              )
            : st.items;

          return (
            <div
              key={model}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              {/* En-tête cliquable */}
              <div
                onClick={() => toggle(model)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 18px",
                  cursor: "pointer",
                  flexWrap: "wrap",
                  background: isOpen ? "rgba(124,58,237,0.06)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {/* Pastille couleur */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />

                {/* Nom modèle */}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    flex: 1,
                    minWidth: 110,
                  }}
                >
                  {model}
                </span>

                {/* Barre de progression */}
                <div style={{ flex: 2, minWidth: 90, maxWidth: 170 }}>
                  <div
                    style={{
                      height: 6,
                      background: "var(--bg3)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: pct + "%",
                        background: color,
                        borderRadius: 3,
                        transition: "width 0.4s",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text2)",
                      marginTop: 2,
                    }}
                  >
                    {pct}% en stock
                  </div>
                </div>

                {/* Chiffres clés */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: "var(--accent2)",
                        lineHeight: 1.1,
                      }}
                    >
                      {st.total}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text2)" }}>
                      unités
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text2)" }}>
                      {st.designs} designs
                    </div>
                  </div>
                  <div
                    style={{
                      color: "var(--text2)",
                      transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <Icon name="arrow_down" size={14} />
                  </div>
                </div>
              </div>

              {/* Détail déplié */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {/* Sous-résumé */}
                  <div
                    style={{
                      display: "flex",
                      gap: 18,
                      padding: "8px 18px",
                      background: "var(--bg3)",
                      fontSize: 12,
                      color: "var(--text2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      ✅ En stock :{" "}
                      <strong style={{ color: "var(--success)" }}>
                        {st.designs - st.empty}
                      </strong>
                    </span>
                    <span>
                      ❌ Vides :{" "}
                      <strong style={{ color: "var(--danger)" }}>
                        {st.empty}
                      </strong>
                    </span>
                    <span>
                      📦 Total :{" "}
                      <strong style={{ color: "var(--accent2)" }}>
                        {st.total}
                      </strong>{" "}
                      unités
                    </span>
                  </div>

                  {/* Table des designs */}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Design</th>
                          <th>Prix</th>
                          <th>Stock</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items
                          .slice()
                          .sort((a, b) => b.stock - a.stock)
                          .map((p) => (
                            <tr
                              key={p.id}
                              style={{
                                background:
                                  p.stock === 0
                                    ? "rgba(239,68,68,0.04)"
                                    : "transparent",
                              }}
                            >
                              <td style={{ fontWeight: 500 }}>
                                {p.stock === 0 && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--danger)",
                                      fontWeight: 700,
                                      marginRight: 6,
                                    }}
                                  >
                                    VIDE
                                  </span>
                                )}
                                {p.design}
                              </td>
                              <td
                                style={{
                                  color: "var(--gold)",
                                  fontWeight: 700,
                                }}
                              >
                                {fmtMoney(p.price)}
                              </td>
                              <td>{stockBadge(p.stock)}</td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    className="btn btn-outline btn-sm btn-icon"
                                    onClick={() => openEdit(p)}
                                  >
                                    <Icon name="edit" size={12} />
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm btn-icon"
                                    onClick={() => onDelete(p.id)}
                                  >
                                    <Icon name="trash" size={12} />
                                  </button>
                                  <button
                                    className="btn btn-success btn-sm"
                                    style={{ fontSize: 11 }}
                                    onClick={() => handleQuickSale(p)}
                                    disabled={p.stock === 0}
                                  >
                                    ⚡ Vente
                                  </button>
                                </div>
                              </td>
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

// ─── PRODUCTS ──────────────────────────────────────────────────────────────

export default Dashboard;
