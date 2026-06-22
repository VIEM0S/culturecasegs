import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "./components.jsx";
import { LOW_STOCK } from "./constants.js";
import { fmtDate, fmtMoney, toDateStr, today } from "./utils.js";
throw new Error("test error boundary");

// ── Tooltip recharts custom ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border2)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <p style={{ color: "var(--text2)", marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700 }}>
          {money ? fmtMoney(p.value) : `${p.value} vente(s)`}
        </p>
      ))}
    </div>
  );
}

const Dashboard = memo(function Dashboard({ data, isViewer = false }) {
  const { products, sales, movements } = data;
  const todayStr = toDateStr(today());
  const monthStr = todayStr.slice(0, 7);

  // ── Stats principales ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + p.stock, 0);
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const lowStock = products.filter(
      (p) => p.stock > 0 && p.stock <= LOW_STOCK,
    ).length;
    const salesToday = sales.filter((s) => toDateStr(s.date) === todayStr);
    const salesMonth = sales.filter((s) =>
      toDateStr(s.date).startsWith(monthStr),
    );
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

  // ── Données graphique 30 jours ───────────────────────────────────────────
  const chart30 = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateStr(d.toISOString());
      const label = d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
      const daySales = sales.filter((s) => toDateStr(s.date) === key);
      const revenue = daySales.reduce(
        (s, v) => s + (v.totalAfterDiscount ?? v.total),
        0,
      );
      const qty = daySales.reduce((s, v) => s + v.qty, 0);
      days.push({ label, revenue, qty });
    }
    return days;
  }, [sales]);

  // ── Top 5 produits ───────────────────────────────────────────────────────
  const top5 = useMemo(() => {
    const totals = {};
    sales.forEach((s) => {
      totals[s.productId] = totals[s.productId] || { qty: 0, revenue: 0 };
      totals[s.productId].qty += s.qty;
      totals[s.productId].revenue += s.totalAfterDiscount ?? s.total;
    });
    const productMap = {};
    products.forEach((p) => {
      productMap[p.id] = p;
    });
    return Object.entries(totals)
      .map(([id, v]) => {
        const p = productMap[id];
        return {
          id,
          ...v,
          name: p ? `${p.design}` : "—",
          fullName: p ? `${p.model} — ${p.design}` : "—",
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales, products]);

  // ── Dernières opérations ─────────────────────────────────────────────────
  const recentOps = useMemo(() => {
    const saleGroups = new Map();
    sales.forEach((s) => {
      const key = s.groupId || s.id;
      if (!saleGroups.has(key)) saleGroups.set(key, []);
      saleGroups.get(key).push(s);
    });
    const groupedSales = Array.from(saleGroups.values()).map((group) => {
      const first = group[0];
      const groupTotal = group.reduce(
        (sum, v) => sum + (v.totalAfterDiscount ?? v.total),
        0,
      );
      const totalQty = group.reduce((sum, v) => sum + v.qty, 0);
      return {
        ...first,
        _type: "sale",
        _group: group,
        _groupTotal: groupTotal,
        _totalQty: totalQty,
        _isMulti: group.length > 1,
      };
    });
    return [...groupedSales, ...movements.map((m) => ({ ...m, _type: "mov" }))]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }, [sales, movements]);

  const productMap = useMemo(() => {
    const m = {};
    products.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [products]);

  // ── Tendance : comparer cette semaine vs semaine dernière ────────────────
  const trend = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const thisWeek = sales.filter((s) => new Date(s.date) >= weekAgo);
    const lastWeek = sales.filter(
      (s) => new Date(s.date) >= twoWeeksAgo && new Date(s.date) < weekAgo,
    );
    const revThis = thisWeek.reduce(
      (s, v) => s + (v.totalAfterDiscount ?? v.total),
      0,
    );
    const revLast = lastWeek.reduce(
      (s, v) => s + (v.totalAfterDiscount ?? v.total),
      0,
    );
    const diff =
      revLast > 0 ? Math.round(((revThis - revLast) / revLast) * 100) : null;
    return { revThis, revLast, diff };
  }, [sales]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Stat cards ── */}
      <div className="grid-4">
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
        {!isViewer && (
          <StatCard
            label="CA du jour"
            value={fmtMoney(stats.revenueToday)}
            sub={`${stats.salesToday.length} vente(s)`}
            color="green"
          />
        )}
      </div>

      {/* ── CA mensuel + tendance + alertes ── */}
      <div className="grid-2">
        {!isViewer && (
          <div className="card">
            <p className="section-label">CA du mois</p>
            <p
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "var(--success)",
                lineHeight: 1.1,
              }}
            >
              {fmtMoney(stats.revenueMonth)}
            </p>
            <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
              {stats.salesMonth.length} vente(s) en {monthStr}
            </p>
            {trend.diff !== null && (
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background:
                    trend.diff >= 0
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(239,68,68,0.1)",
                  color: trend.diff >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {trend.diff >= 0 ? "▲" : "▼"} {Math.abs(trend.diff)}% vs semaine
                dernière
              </div>
            )}
          </div>
        )}
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

      {/* ── Graphique CA 30 jours ── */}
      {!isViewer && sales.length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 16 }}>
            Chiffre d'affaires — 30 derniers jours
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={chart30}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--success)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--success)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text2)" }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(chart30.length / 6)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text2)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                }
                width={36}
              />
              <Tooltip content={<ChartTooltip money />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--success)"
                strokeWidth={2}
                fill="url(#gradCA)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top 5 produits + dernières opérations ── */}
      <div className="grid-2">
        {/* Top 5 */}
        {sales.length > 0 && (
          <div className="card">
            <p className="section-label" style={{ marginBottom: 14 }}>
              Top 5 produits vendus
            </p>
            {top5.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text2)" }}>
                Aucune vente enregistrée
              </p>
            )}
            {top5.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: i === 0 ? "var(--gold)" : "var(--bg3)",
                    color: i === 0 ? "#000" : "var(--text2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.fullName}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text2)",
                      marginTop: 1,
                    }}
                  >
                    {p.qty} vendu(s) · {fmtMoney(p.revenue)}
                  </div>
                </div>
                {/* Mini barre */}
                <div
                  style={{
                    width: 50,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--bg3)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 2,
                      width: `${Math.round((p.qty / top5[0].qty) * 100)}%`,
                      background: i === 0 ? "var(--gold)" : "var(--accent2)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dernières opérations */}
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
                  {!isViewer && <th scope="col">Détail</th>}
                </tr>
              </thead>
              <tbody>
                {recentOps.map((op) => {
                  if (op._type === "sale") {
                    const prodLabel = op._isMulti
                      ? `${op._group.length} produits`
                      : (() => {
                          const p = productMap[op.productId];
                          return p ? `${p.model} — ${p.design}` : "—";
                        })();
                    const hasDiscount = op._group.some(
                      (v) => v.discountPercent > 0,
                    );
                    return (
                      <tr key={op.groupId || op.id}>
                        <td style={{ color: "var(--text2)", fontSize: 12 }}>
                          <div>{fmtDate(op.date)}</div>
                          {op.date && op.date.length > 10 && (
                            <div style={{ fontSize: 10, marginTop: 1 }}>
                              {new Date(op.date).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-success">Vente</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{prodLabel}</span>
                          {op._isMulti && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text2)",
                                marginTop: 2,
                              }}
                            >
                              {op._group
                                .map((v) => {
                                  const p = productMap[v.productId];
                                  return p ? p.design : "—";
                                })
                                .join(", ")}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>-{op._totalQty}</td>
                        {!isViewer && (
                          <td style={{ color: "var(--text2)", fontSize: 12 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: "var(--success)",
                                }}
                              >
                                {fmtMoney(op._groupTotal)}
                              </span>
                              {op.client && <span>{op.client}</span>}
                              {hasDiscount && (
                                <span className="badge badge-gold">remise</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  }
                  const prod = productMap[op.productId];
                  if (!prod) return null;
                  return (
                    <tr key={op.id}>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>
                        {fmtDate(op.date)}
                      </td>
                      <td>
                        {op.type === "in" ? (
                          <span className="badge badge-info">Entrée</span>
                        ) : (
                          <span className="badge badge-danger">Sortie</span>
                        )}
                      </td>
                      <td>
                        {prod.model} — {prod.design}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {op.type === "in" ? `+${op.qty}` : `-${op.qty}`}
                      </td>
                      {!isViewer && (
                        <td style={{ color: "var(--text2)", fontSize: 12 }}>
                          {op.reason || "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Dashboard;
