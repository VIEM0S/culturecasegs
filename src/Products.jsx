import { useState, useMemo, useRef, useEffect } from "react";
import Icon from "./Icon.jsx";
import { StockView, stockBadge } from "./StockView.jsx";
import { StatCard, DesignThumb } from "./components.jsx";
import { uid, getProductImageUrl, today, fmtMoney } from "./utils.js";
import { LOW_STOCK } from "./constants.js";

// ─── MINI-MODAL VENTE RAPIDE ────────────────────────────────────────────────
function QuickSaleModal({ product, onConfirm, onClose }) {
  const [qty, setQty] = useState(1);
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const total = product.price * qty;
  const canConfirm = qty >= 1 && qty <= product.stock;

  const handleQty = (delta) => setQty(q => Math.min(product.stock, Math.max(1, q + delta)));

  const handleSubmit = () => {
    if (!canConfirm) return;
    onConfirm({ qty, client: client.trim(), phone: phone.trim(), delivery });
  };

  const handleKey = (e) => { if (e.key === "Enter" && canConfirm) handleSubmit(); if (e.key === "Escape") onClose(); };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }} onKeyDown={handleKey}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>⚡ Vente rapide</div>
            <div style={{ fontSize: 12, color: "var(--accent2)", marginTop: 2 }}>{product.model} — {product.design}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: "18px 18px 0" }}>

          {/* Quantité */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 8 }}>
              QUANTITÉ <span style={{ color: "var(--text2)", fontWeight: 400 }}>({product.stock} en stock)</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 0, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
              <button
                onClick={() => handleQty(-1)} disabled={qty <= 1}
                style={{ width: 48, height: 48, background: "none", border: "none", color: qty <= 1 ? "var(--text3)" : "var(--text1)", fontSize: 20, cursor: qty <= 1 ? "default" : "pointer", flexShrink: 0 }}
              >−</button>
              <input
                ref={inputRef}
                type="number" min="1" max={product.stock}
                value={qty}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setQty(Math.min(product.stock, Math.max(1, v))); }}
                style={{ flex: 1, textAlign: "center", background: "none", border: "none", outline: "none", fontSize: 22, fontWeight: 800, color: "var(--text1)", padding: 0 }}
              />
              <button
                onClick={() => handleQty(1)} disabled={qty >= product.stock}
                style={{ width: 48, height: 48, background: "none", border: "none", color: qty >= product.stock ? "var(--text3)" : "var(--text1)", fontSize: 20, cursor: qty >= product.stock ? "default" : "pointer", flexShrink: 0 }}
              >+</button>
            </div>
          </div>

          {/* Total */}
          <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)" }}>{fmtMoney(total)}</span>
          </div>

          {/* Client (optionnel) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>NOM CLIENT <span style={{ fontWeight: 400 }}>(optionnel)</span></label>
            <input
              className="input"
              placeholder="ex: Aminata"
              value={client}
              onChange={e => setClient(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Téléphone (optionnel) */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>TÉLÉPHONE <span style={{ fontWeight: 400 }}>(optionnel)</span></label>
            <input
              className="input"
              placeholder="ex: +223 XX XX XX XX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              style={{ width: "100%" }}
            />
          </div>

          {/* Livraison toggle */}
          <div
            onClick={() => setDelivery(d => !d)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: delivery ? "rgba(124,58,237,0.1)" : "var(--bg3)", border: `1px solid ${delivery ? "var(--accent2)" : "var(--border)"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 18, cursor: "pointer", transition: "all 0.15s" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🛵</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Livraison</div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>{delivery ? "Oui — à livrer" : "Non — vente sur place"}</div>
              </div>
            </div>
            <div style={{ width: 40, height: 22, borderRadius: 11, background: delivery ? "var(--accent2)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: delivery ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 18px 18px", display: "flex", gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
          <button className="btn btn-success" style={{ flex: 2, justifyContent: "center", fontWeight: 700 }} onClick={handleSubmit} disabled={!canConfirm}>
            ✅ Confirmer {fmtMoney(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────
function Products({ data, onSale, onDelete, isViewer = false }) {
  const { products, settings } = data;
  const { designs, models, priceSettings } = settings;
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [quickSaleProduct, setQuickSaleProduct] = useState(null); // produit sélectionné pour le modal

  // Produits dont le designId ne correspond à aucun design dans les paramètres (orphelins)
  const designIds = useMemo(() => new Set((designs || []).map(d => d.id)), [designs]);
  const isOrphan = (p) => p.designId && !designIds.has(p.designId);

  // Modèles dans l'ordre défini dans les paramètres (pas calculé depuis les produits)
  const uniqueModels = useMemo(() => {
    const fromSettings = models || [];
    const fromProducts = [...new Set(products.map(p => p.model))];
    const extra = fromProducts.filter(m => !fromSettings.includes(m));
    return [...fromSettings, ...extra];
  }, [models, products]);

  const filtered = useMemo(() => products.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.model.toLowerCase().includes(q) || p.design.toLowerCase().includes(q))
      && (!filterModel || p.model === filterModel);
  }), [products, search, filterModel]);

  // Modèles qui ont au moins un produit (pour le filtre)
  const modelsWithProducts = useMemo(() =>
    uniqueModels.filter(m => products.some(p => p.model === m)),
    [uniqueModels, products]
  );

  // ⚡ Ouvre le mini-modal
  const handleQuickSale = (p) => {
    if (p.stock === 0) return;
    setQuickSaleProduct(p);
  };

  // ✅ Confirme la vente depuis le modal
  const handleQuickSaleConfirm = ({ qty, client, phone, delivery }) => {
    const p = quickSaleProduct;
    const sale = {
      id: uid(), date: today(),
      productId: p.id, qty,
      price: p.price, total: p.price * qty,
      discountType: "none", discountPercent: 0, discountAmount: 0,
      totalAfterDiscount: p.price * qty,
      discountReason: "",
      client, phone,
      quartier: "", delivery,
    };
    onSale([sale]);
    setQuickSaleProduct(null);
  };


  return (
    <div>
      {/* Mini-modal vente rapide */}
      {quickSaleProduct && (
        <QuickSaleModal
          product={quickSaleProduct}
          onConfirm={handleQuickSaleConfirm}
          onClose={() => setQuickSaleProduct(null)}
        />
      )}

      <div className="section-header">
        <span className="section-title">Produits ({viewMode === "stock" ? products.length : filtered.length})</span>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Sélecteur de vue : grille / liste / stock */}
          <div style={{ display: "flex", border: "1px solid var(--border2)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { mode: "grid",  icon: "grid_view",  title: "Vue grille" },
              { mode: "list",  icon: "list_view",  title: "Vue liste"  },
              { mode: "stock", icon: "stock_view", title: "Vue stock"  },
            ].map((v, i) => (
              <button key={v.mode} title={v.title} onClick={() => setViewMode(v.mode)}
                className="btn btn-sm"
                style={{ borderRadius: 0, border: "none", padding: "6px 11px", borderLeft: i > 0 ? "1px solid var(--border2)" : "none", background: viewMode === v.mode ? "var(--accent)" : "transparent", color: viewMode === v.mode ? "#fff" : "var(--text2)" }}
              ><Icon name={v.icon} size={14} /></button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-row">
        <div style={{ position: "relative", flex: 2 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text2)" }}><Icon name="search" size={14} /></span>
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Rechercher..." aria-label="Rechercher" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {viewMode !== "stock" && (
          <select className="input" style={{ flex: 1 }} value={filterModel} onChange={e => setFilterModel(e.target.value)}>
            <option value="">Tous les modèles</option>
            {modelsWithProducts.map(m => <option key={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* ── VUE STOCK ── */}
      {viewMode === "stock" && (
        <StockView
          products={products}
          modelsWithProducts={modelsWithProducts}
          search={search}
          handleQuickSale={handleQuickSale}
          isViewer={isViewer}
        />
      )}

      {/* ── VUE GRILLE ── */}
      {viewMode === "grid" && (
        <div className="products-grid">
          {filtered.map(p => {
            const imgUrl = getProductImageUrl(p, designs);
            return (
              <div key={p.id} className="product-card">
                <div className="product-img">
                  {imgUrl && imgUrl.startsWith("data:")
                    ? <img src={imgUrl} alt={p.design} loading="lazy" onError={e => { e.target.style.display = "none"; }} />
                    : <div className="product-img-placeholder"><DesignThumb image={imgUrl} name={p.design} height={120} /></div>}
                </div>
                <div className="product-card-body">
                  <p style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 1 }}>{p.model}</p>
                  <p style={{ fontSize: 12, color: "var(--accent2)", marginBottom: 8 }}>{p.design}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: 13 }}>{fmtMoney(p.price)}</span>
                    {stockBadge(p.stock)}
                  </div>

                  {!isViewer && <button className="btn btn-success btn-sm" style={{ width: "100%", marginTop: 6, justifyContent: "center" }} onClick={() => handleQuickSale(p)} disabled={p.stock === 0}>⚡ Vente rapide</button>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty" style={{ gridColumn: "1/-1" }}>Aucun produit trouvé</div>}
        </div>
      )}

      {/* ── VUE LISTE ── */}
      {viewMode === "list" && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Image</th><th scope="col">Modèle</th><th scope="col">Design</th><th scope="col">Prix</th><th scope="col">Stock</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {filtered.map(p => {
                  const imgUrl = getProductImageUrl(p, designs);
                  return (
                    <tr key={p.id}>
                      <td>
                        {imgUrl
                          ? <img src={imgUrl} alt="" loading="lazy" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                          : <div style={{ width: 44, height: 44, borderRadius: 6, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={14} /></div>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.model}</td>
                      <td style={{ color: "var(--accent2)" }}>{p.design}</td>
                      <td style={{ color: "var(--gold)", fontWeight: 700 }}>{fmtMoney(p.price)}</td>
                      <td>{stockBadge(p.stock)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>

                          {!isViewer && <button className="btn btn-success btn-sm" onClick={() => handleQuickSale(p)} disabled={p.stock === 0}>⚡ Vente rapide</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={6} className="empty">Aucun produit trouvé</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── STOCK MOVEMENTS ───────────────────────────────────────────────────────

export default Products;
