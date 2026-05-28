import { useState, useMemo } from "react";
import Icon from "./Icon.jsx";
import { StockView, stockBadge } from "./StockView.jsx";
import { StatCard, DesignThumb } from "./components.jsx";
import { uid, getProductImageUrl, today, fmtMoney } from "./utils.js";
import { LOW_STOCK } from "./constants.js";

function Products({ data, onSale, onDelete, isViewer = false }) {
  const { products, settings } = data;
  const { designs, models, priceSettings } = settings;

  // Produits dont le designId ne correspond à aucun design dans les paramètres (orphelins)
  const designIds = useMemo(() => new Set((designs || []).map(d => d.id)), [designs]);
  const isOrphan = (p) => p.designId && !designIds.has(p.designId);
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  // L'image vient uniquement du design sélectionné (designImage). Plus de champ imageUrl dans ce formulaire.

  // Modèles dans l'ordre défini dans les paramètres (pas calculé depuis les produits)
  const uniqueModels = useMemo(() => {
    const fromSettings = models || [];
    // Ajoute aussi les modèles présents dans les produits mais absents des settings (legacy)
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


  // ⚡ Vente rapide — 2 clics sans ouvrir le formulaire complet
  const handleQuickSale = (p) => {
    if (p.stock === 0) { alert("Stock insuffisant — ce produit est en rupture."); return; }
    const input = window.prompt(`Vente rapide : ${p.model} — ${p.design}\nStock disponible : ${p.stock}\nQuantité à vendre ?`, "1");
    if (input === null) return; // annulé
    const qty = parseInt(input);
    if (isNaN(qty) || qty < 1) { alert("Quantité invalide. Veuillez saisir un nombre ≥ 1."); return; }
    if (qty > p.stock) { alert(`Stock insuffisant. Seulement ${p.stock} unité(s) disponible(s).`); return; }
    const sale = {
      id: uid(), date: today(),
      productId: p.id, qty,
      price: p.price, total: p.price * qty,
      discountType: "none", discountPercent: 0, discountAmount: 0,
      totalAfterDiscount: p.price * qty,
      discountReason: "", client: "", phone: "", quartier: "", delivery: false,
    };
    onSale([sale]);
    alert(`✅ Vente enregistrée — ${qty} × ${p.model} (${p.design}) pour ${fmtMoney(p.price * qty)}`);
  };


  return (
    <div>
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
          onDelete={onDelete}
          isOrphan={isOrphan}
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
                  {!isViewer && isOrphan(p) && (
                    <button className="btn btn-danger btn-sm" style={{ width: "100%", marginTop: 4, justifyContent: "center" }} onClick={() => onDelete(p.id)} title="Design supprimé — produit orphelin">
                      🗑️ Supprimer (doublon)
                    </button>
                  )}
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
                          {!isViewer && isOrphan(p) && (
                            <button className="btn btn-danger btn-sm" onClick={() => onDelete(p.id)} title="Design supprimé — produit orphelin">🗑️ Doublon</button>
                          )}
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
