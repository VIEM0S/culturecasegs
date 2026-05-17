import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl, today, fmtMoney, fmtDate } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";

const Reports = memo(function Reports({ data }) {
  const { products, sales } = data;
  const [tab, setTab] = useState("stats");

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
      .map(([id, v]) => { const p = productMap[id]; return { id, ...v, name: p ? `${p.model} — ${p.design}` : "—" }; })
      .sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [sales, productMap]);

  const totalRevenue = useMemo(() => sales.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0), [sales]);
  const totalDiscounts = useMemo(() => sales.reduce((s, v) => s + (v.discountAmount || 0), 0), [sales]);
  const totalUnits = useMemo(() => sales.reduce((s, v) => s + v.qty, 0), [sales]);

  const monthlyRevenue = useMemo(() => {
    const map = {};
    sales.forEach(s => { const m = s.date.slice(0, 7); map[m] = (map[m] || 0) + (s.totalAfterDiscount ?? s.total); });
    return Object.entries(map).sort().slice(-6);
  }, [sales]);
  const maxRev = useMemo(() => Math.max(...monthlyRevenue.map(([, v]) => v), 1), [monthlyRevenue]);

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

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Rapports & Statistiques</span>
        <button className="btn btn-outline btn-sm" onClick={exportCSV}><Icon name="download" size={13} /> Export CSV</button>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>Vue d'ensemble</button>
        <button className={`tab ${tab === "top" ? "active" : ""}`} onClick={() => setTab("top")}>Top produits</button>
        <button className={`tab ${tab === "monthly" ? "active" : ""}`} onClick={() => setTab("monthly")}>Par mois</button>
      </div>

      {tab === "stats" && (
        <div>
          <div className="grid-4" style={{ marginBottom: 14 }}>
            <StatCard label="CA net total" value={fmtMoney(totalRevenue)} color="green" />
            <StatCard label="Remises accordées" value={fmtMoney(totalDiscounts)} color="amber" />
            <StatCard label="Unités vendues" value={totalUnits} color="purple" />
            <StatCard label="Nb ventes" value={sales.length} color="blue" />
          </div>
          <div className="card">
            <p className="section-label" style={{ marginBottom: 12 }}>Stock actuel par produit</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Modèle</th><th scope="col">Design</th><th scope="col">Prix</th><th scope="col">Stock</th><th scope="col">Valeur stock</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.model}</td>
                      <td style={{ color: "var(--accent2)" }}>{p.design}</td>
                      <td>{fmtMoney(p.price)}</td>
                      <td>{p.stock === 0 ? <span className="badge badge-danger">0</span> : p.stock <= LOW_STOCK ? <span className="badge badge-warn">{p.stock}</span> : <span className="badge badge-success">{p.stock}</span>}</td>
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

      {tab === "top" && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 14 }}>Produits les plus vendus</p>
          {topProducts.length === 0 && <p className="empty">Aucune vente enregistrée</p>}
          {topProducts.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "var(--gold)" : "var(--text2)", flexShrink: 0 }}>{i + 1}</span>
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
      )}

      {tab === "monthly" && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 14 }}>CA par mois (6 derniers)</p>
          {monthlyRevenue.length === 0 && <p className="empty">Aucune donnée</p>}
          {monthlyRevenue.map(([month, rev]) => (
            <div key={month} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{month}</span>
                <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 700 }}>{fmtMoney(rev)}</span>
              </div>
              <div style={{ height: 7, background: "var(--bg3)", borderRadius: 4 }}>
                <div style={{ height: "100%", borderRadius: 4, background: "var(--accent)", width: `${(rev / maxRev) * 100}%`, transition: "width 0.6s" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── HISTORY PAGE ──────────────────────────────────────────────────────────

export default Reports;
