import { memo, useMemo } from "react";
import { StatCard } from "./components.jsx";
import { LOW_STOCK } from "./constants.js";
import { fmtDate, fmtMoney, today, toDateStr } from "./utils.js";

const Dashboard = memo(function Dashboard({ data, isViewer = false }) {
  const { products, sales, movements } = data;
  const todayStr = toDateStr(today());
  const monthStr = todayStr.slice(0, 7);

  const stats = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + p.stock, 0);
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const lowStock   = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length;
    const salesToday = sales.filter((s) => toDateStr(s.date) === todayStr);
    const salesMonth = sales.filter((s) => toDateStr(s.date).startsWith(monthStr));
    const revenueToday = salesToday.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0);
    const revenueMonth = salesMonth.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0);
    return { totalStock, outOfStock, lowStock, salesToday, salesMonth, revenueToday, revenueMonth };
  }, [products, sales, todayStr, monthStr]);

  const recentOps = useMemo(() => {
    // Grouper les ventes par groupId → un achat multi-produits = une seule ligne
    const saleGroups = new Map();
    sales.forEach(s => {
      const key = s.groupId || s.id;
      if (!saleGroups.has(key)) saleGroups.set(key, []);
      saleGroups.get(key).push(s);
    });
    const groupedSales = Array.from(saleGroups.values()).map(group => {
      const first = group[0];
      const groupTotal = group.reduce((sum, v) => sum + (v.totalAfterDiscount ?? v.total), 0);
      const totalQty   = group.reduce((sum, v) => sum + v.qty, 0);
      return {
        ...first,
        _type: "sale",
        _group: group,
        _groupTotal: groupTotal,
        _totalQty: totalQty,
        _isMulti: group.length > 1,
      };
    });
    return [
      ...groupedSales,
      ...movements.map((m) => ({ ...m, _type: "mov" })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }, [sales, movements]);

  const productMap = useMemo(() => {
    const m = {};
    products.forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Stock total"  value={stats.totalStock}            sub="unités en stock"              color="purple" />
        <StatCard label="Rupture"      value={stats.outOfStock}            sub="produits épuisés"             color="red"    />
        <StatCard label="Stock faible" value={stats.lowStock}              sub={`≤ ${LOW_STOCK} unités`}      color="amber"  />
        {!isViewer && <StatCard label="CA du jour"   value={fmtMoney(stats.revenueToday)} sub={`${stats.salesToday.length} vente(s)`} color="green" />}
      </div>

      <div className="grid-2" style={{ marginBottom: 18 }}>
        {!isViewer && (
          <div className="card">
            <p className="section-label">CA du mois</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: "var(--success)" }}>
              {fmtMoney(stats.revenueMonth)}
            </p>
            <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
              {stats.salesMonth.length} vente(s) en {monthStr}
            </p>
          </div>
        )}
        <div className="card">
          <p className="section-label">Alertes Stock</p>
          {stats.outOfStock === 0 && stats.lowStock === 0 && (
            <p style={{ color: "var(--success)", fontSize: 13 }}>✓ Tout le stock est OK</p>
          )}
          {products.filter((p) => p.stock === 0).slice(0, 3).map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13 }}>{p.model} — {p.design}</span>
              <span className="badge badge-danger">Rupture</span>
            </div>
          ))}
          {products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).slice(0, 3).map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13 }}>{p.model} — {p.design}</span>
              <span className="badge badge-warn">{p.stock} restant(s)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="section-label" style={{ marginBottom: 14 }}>Dernières opérations</p>
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
              {recentOps.map((op) => {
                if (op._type === "sale") {
                  const prodLabel = op._isMulti
                    ? `${op._group.length} produits`
                    : (() => { const p = productMap[op.productId]; return p ? `${p.model} — ${p.design}` : "—"; })();
                  const hasDiscount = op._group.some(v => v.discountPercent > 0);
                  return (
                    <tr key={op.groupId || op.id}>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>
                        <div>{fmtDate(op.date)}</div>
                        {op.date && op.date.length > 10 && (
                          <div style={{ fontSize: 10, marginTop: 1 }}>
                            {new Date(op.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </td>
                      <td><span className="badge badge-success">Vente</span></td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{prodLabel}</span>
                        {op._isMulti && (
                          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                            {op._group.map(v => { const p = productMap[v.productId]; return p ? `${p.design}` : "—"; }).join(", ")}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>-{op._totalQty}</td>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(op._groupTotal)}</span>
                          {op.client && <span>{op.client}</span>}
                          {hasDiscount && <span className="badge badge-gold">remise</span>}
                        </div>
                      </td>
                    </tr>
                  );
                }
                const prod = productMap[op.productId];
                if (!prod) return null;
                return (
                  <tr key={op.id}>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>{fmtDate(op.date)}</td>
                    <td>
                      {op.type === "in"
                        ? <span className="badge badge-info">Entrée</span>
                        : <span className="badge badge-danger">Sortie</span>}
                    </td>
                    <td>{prod.model} — {prod.design}</td>
                    <td style={{ fontWeight: 600 }}>{op.type === "in" ? `+${op.qty}` : `-${op.qty}`}</td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>{op.reason || "—"}</td>
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

export default Dashboard;
