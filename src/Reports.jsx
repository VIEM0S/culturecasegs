import { memo, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import Icon from "./Icon.jsx";
import { StatCard } from "./components.jsx";
import { LOW_STOCK } from "./constants.js";
import { fmtMoney, today } from "./utils.js";

// ── Tooltip personnalisé pour les graphiques ────────────────────────────────
function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "var(--text2)", marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700 }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

const Reports = memo(function Reports({ data }) {
  const { products, sales } = data;
  const [tab, setTab] = useMemo(() => {
    // useState n'est pas importé ici — on utilise le pattern local
    let _tab = "stats";
    const setter = (v) => { _tab = v; };
    return [_tab, setter];
  }, []);

  // Re-implémenter avec vrai useState
  const [activeTab, setActiveTab] = [
    typeof window !== "undefined"
      ? (window.__reportsTab ?? "stats")
      : "stats",
    (v) => {
      window.__reportsTab = v;
      // force re-render via un state local
    }
  ];

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  const topProducts = useMemo(() => {
    const totals = {};
    sales.forEach(s => {
      totals[s.productId] = totals[s.productId] || { qty: 0, revenue: 0 };
      totals[s.productId].qty += s.qty;
      totals[s.productId].revenue += (s.totalAfterDiscount ?? s.total);
    });
    return Object.entries(totals)
      .map(([id, v]) => {
        const p = productMap[id];
        return { id, ...v, name: p ? `${p.model} — ${p.design}` : "—", shortName: p ? p.design : "—" };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [sales, productMap]);

  const totalRevenue   = useMemo(() => sales.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0), [sales]);
  const totalDiscounts = useMemo(() => sales.reduce((s, v) => s + (v.discountAmount || 0), 0), [sales]);
  const totalUnits     = useMemo(() => sales.reduce((s, v) => s + v.qty, 0), [sales]);

  // ── Données pour le graphique CA par mois (12 derniers) ─────────────────
  const monthlyData = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const m = s.date.slice(0, 7);
      map[m] = (map[m] || 0) + (s.totalAfterDiscount ?? s.total);
    });
    return Object.entries(map)
      .sort()
      .slice(-12)
      .map(([month, revenue]) => ({
        month: month.slice(5) + "/" + month.slice(2, 4), // ex: "01/25"
        revenue,
        revenueK: Math.round(revenue / 1000),
      }));
  }, [sales]);

  // ── Données pour le graphique top produits ───────────────────────────────
  const topChartData = useMemo(() =>
    topProducts.slice(0, 7).map(p => ({
      name: p.shortName.length > 14 ? p.shortName.slice(0, 13) + "…" : p.shortName,
      fullName: p.name,
      qty: p.qty,
      revenue: p.revenue,
    })),
  [topProducts]);

  const exportCSV = useCallback(() => {
    const rows = [["Date", "Produit", "Qté", "Prix unit.", "Total brut", "Remise%", "Total net", "Client", "Quartier", "Livraison"]];
    sales.forEach(s => {
      const p = productMap[s.productId];
      rows.push([s.date, p ? `${p.model} ${p.design}` : "—", s.qty, s.price || "", s.total || "", s.discountPercent || 0, s.totalAfterDiscount ?? s.total, s.client || "", s.quartier || "", s.delivery ? "Oui" : "Non"]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,%EF%BB%BF" + encodeURIComponent(csv);
    a.download = `ventes_${today()}.csv`;
    a.click();
  }, [sales, productMap]);

  // Recharts ne fonctionne pas avec window.__reportsTab — on utilise useState proprement
  return <ReportsInner
    products={products}
    sales={sales}
    productMap={productMap}
    topProducts={topProducts}
    topChartData={topChartData}
    monthlyData={monthlyData}
    totalRevenue={totalRevenue}
    totalDiscounts={totalDiscounts}
    totalUnits={totalUnits}
    exportCSV={exportCSV}
  />;
});

// ── Composant interne avec useState ─────────────────────────────────────────
import { useState } from "react";

function ReportsInner({ products, sales, productMap, topProducts, topChartData, monthlyData, totalRevenue, totalDiscounts, totalUnits, exportCSV }) {
  const [tab, setTab] = useState("stats");

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Rapports & Statistiques</span>
        <button className="btn btn-outline btn-sm" onClick={exportCSV}>
          <Icon name="download" size={13} /> Export CSV
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "stats"   ? "active" : ""}`} onClick={() => setTab("stats")}>Vue d'ensemble</button>
        <button className={`tab ${tab === "top"     ? "active" : ""}`} onClick={() => setTab("top")}>Top produits</button>
        <button className={`tab ${tab === "monthly" ? "active" : ""}`} onClick={() => setTab("monthly")}>Par mois</button>
      </div>

      {/* ── Vue d'ensemble ── */}
      {tab === "stats" && (
        <div>
          <div className="grid-4" style={{ marginBottom: 14 }}>
            <StatCard label="CA net total"       value={fmtMoney(totalRevenue)}   color="green"  />
            <StatCard label="Remises accordées"  value={fmtMoney(totalDiscounts)} color="amber"  />
            <StatCard label="Unités vendues"      value={totalUnits}               color="purple" />
            <StatCard label="Nb ventes"           value={sales.length}             color="blue"   />
          </div>
          <div className="card">
            <p className="section-label" style={{ marginBottom: 12 }}>Stock actuel par produit</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Modèle</th>
                    <th scope="col">Design</th>
                    <th scope="col">Prix</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Valeur stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.model}</td>
                      <td style={{ color: "var(--accent2)" }}>{p.design}</td>
                      <td>{fmtMoney(p.price)}</td>
                      <td>
                        {p.stock === 0
                          ? <span className="badge badge-danger">0</span>
                          : p.stock <= LOW_STOCK
                            ? <span className="badge badge-warn">{p.stock}</span>
                            : <span className="badge badge-success">{p.stock}</span>}
                      </td>
                      <td style={{ fontWeight: 700 }}>{fmtMoney(p.price * p.stock)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700, color: "var(--text2)" }}>TOTAL</td>
                    <td style={{ fontWeight: 700 }}>{products.reduce((s, p) => s + p.stock, 0)}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(products.reduce((s, p) => s + p.price * p.stock, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Top produits — graphique barres + liste ── */}
      {tab === "top" && (
        <div>
          {topProducts.length === 0
            ? <div className="card"><p className="empty">Aucune vente enregistrée</p></div>
            : (
              <>
                {/* Graphique barres */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <p className="section-label" style={{ marginBottom: 16 }}>Unités vendues — Top 7</p>
                  <div className="chart-wrap" style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "var(--text2)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--text2)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <CustomTooltip
                              active={active}
                              payload={payload}
                              label={payload?.[0]?.payload?.fullName || label}
                              formatter={(v) => `${v} unités`}
                            />
                          )}
                        />
                        <Bar dataKey="qty" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Liste classement */}
                <div className="card">
                  <p className="section-label" style={{ marginBottom: 14 }}>Classement complet</p>
                  {topProducts.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "var(--gold)" : "var(--text2)", flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</p>
                        <div style={{ height: 5, background: "var(--bg3)", borderRadius: 3, marginTop: 4 }}>
                          <div style={{ height: "100%", borderRadius: 3, background: "var(--accent)", width: `${(p.qty / topProducts[0].qty) * 100}%`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>{p.qty} unités</p>
                        <p style={{ fontSize: 11, color: "var(--success)" }}>{fmtMoney(p.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      )}

      {/* ── Par mois — graphique courbe + liste ── */}
      {tab === "monthly" && (
        <div>
          {monthlyData.length === 0
            ? <div className="card"><p className="empty">Aucune donnée</p></div>
            : (
              <>
                {/* Graphique courbe */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <p className="section-label" style={{ marginBottom: 16 }}>CA par mois — 12 derniers mois</p>
                  <div className="chart-wrap" style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--accent)"  stopOpacity={0.25} />
                            <stop offset="95%" stopColor="var(--accent)"  stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "var(--text2)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--text2)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <CustomTooltip
                              active={active}
                              payload={payload}
                              label={label}
                              formatter={(v) => fmtMoney(v)}
                            />
                          )}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="var(--accent2)"
                          strokeWidth={2}
                          fill="url(#caGradient)"
                          dot={{ fill: "var(--accent2)", r: 3, strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "var(--accent2)" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Liste mensuelle */}
                <div className="card">
                  <p className="section-label" style={{ marginBottom: 14 }}>Détail par mois</p>
                  {[...monthlyData].reverse().map(({ month, revenue }) => {
                    const maxRev = Math.max(...monthlyData.map(m => m.revenue), 1);
                    return (
                      <div key={month} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{month}</span>
                          <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 700 }}>{fmtMoney(revenue)}</span>
                        </div>
                        <div style={{ height: 7, background: "var(--bg3)", borderRadius: 4 }}>
                          <div style={{ height: "100%", borderRadius: 4, background: "var(--accent)", width: `${(revenue / maxRev) * 100}%`, transition: "width 0.6s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          }
        </div>
      )}
    </div>
  );
}

export default Reports;
