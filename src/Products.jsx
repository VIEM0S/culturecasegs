import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import { StockView, stockBadge } from "./Dashboard.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl, today, fmtMoney } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";

function Products({ data, onSave, onDelete, onSale }) {
  const { products, settings } = data;
  const { designs, models, priceSettings } = settings;
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [designPickerOpen, setDesignPickerOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // L'image vient uniquement du design sélectionné (designImage). Plus de champ imageUrl dans ce formulaire.
  const emptyForm = { model: "", design: "", designImage: "", price: "", stock: "" };
  const [form, setForm] = useState(emptyForm);

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

  // Pour l'ajout : sélection multi-modèles
  const [selectedModels, setSelectedModels] = useState([]);
  const toggleModel = (m) => setSelectedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const selectAllModels = () => setSelectedModels([...models]);
  const clearModels = () => setSelectedModels([]);

  const openAdd = () => {
    setForm(emptyForm);
    setSelectedModels([]);
    setErrors({});
    setModal("add");
  };
  const openEdit = (p) => {
    setForm({
      ...p,
      price: String(p.price),
      stock: String(p.stock),
    });
    setErrors({});
    setModal("edit");
  };

  const handleModelChange = (modelName) => {
    const suggestedPrice = priceSettings.modelPrices[modelName] || "";
    setForm(f => ({ ...f, model: modelName, price: String(suggestedPrice) }));
    if (errors.model) setErrors(e => ({ ...e, model: undefined }));
  };

  const handleDesignSelect = (d) => {
    setForm(f => ({ ...f, design: d.name, designImage: d.image }));
    setDesignPickerOpen(false);
    if (errors.design) setErrors(e => ({ ...e, design: undefined }));
  };

  const handleSave = () => {
    if (modal === "add") {
      const errs = {};
      if (selectedModels.length === 0) errs.model = "Sélectionnez au moins un modèle";
      if (!form.design?.trim()) errs.design = "Le design est obligatoire";
      if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) errs.price = "Le prix doit être un nombre positif";
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      // Construit TOUS les produits d'un coup → un seul appel onSave
      const newProducts = selectedModels.map(modelName => ({
        id: uid(),
        model: modelName,
        design: form.design,
        designImage: form.designImage || "",
        price: parseInt(form.price) || 0,
        stock: parseInt(form.stock) || 0,
        imageUrl: "", image: null,
        createdAt: today(),
      }));
      onSave(newProducts); // tableau → un seul persist
    } else {
      // Édition : un seul produit
      const errs = validateProductForm(form);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      onSave({
        id: form.id || uid(),
        model: form.model,
        design: form.design,
        designImage: form.designImage || "",
        price: parseInt(form.price) || 0,
        stock: parseInt(form.stock) || 0,
        imageUrl: "", image: null,
        createdAt: form.createdAt || today(),
      });
    }
    setModal(null);
    setSelectedModels([]);
    setErrors({});
  };

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
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Icon name="plus" size={14} /> Ajouter</button>
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
          openEdit={openEdit}
          onDelete={onDelete}
          handleQuickSale={handleQuickSale}
        />
      )}

      {/* ── VUE GRILLE ── */}
      {viewMode === "grid" && (
        <div className="products-grid">
          {filtered.map(p => {
            const imgUrl = getProductImageUrl(p);
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
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(p)}><Icon name="edit" size={13} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(p.id)}><Icon name="trash" size={13} /></button>
                  </div>
                  <button className="btn btn-success btn-sm" style={{ width: "100%", marginTop: 6, justifyContent: "center" }} onClick={() => handleQuickSale(p)} disabled={p.stock === 0}>⚡ Vente rapide</button>
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
                  const imgUrl = getProductImageUrl(p);
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
                          <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(p)}><Icon name="edit" size={13} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(p.id)}><Icon name="trash" size={13} /></button>
                          <button className="btn btn-success btn-sm" onClick={() => handleQuickSale(p)} disabled={p.stock === 0}>⚡ Vente rapide</button>
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

      {modal && (
        <Modal
          title={modal === "add" ? "Ajouter un produit" : "Modifier le produit"}
          onClose={() => { setModal(null); setErrors({}); setSelectedModels([]); }}
          footer={<>
            <button className="btn btn-outline" onClick={() => { setModal(null); setErrors({}); setSelectedModels([]); }}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {modal === "add" && selectedModels.length > 1
                ? `Créer ${selectedModels.length} produits`
                : "Enregistrer"}
            </button>
          </>}
        >
          {/* ── MODÈLE(S) ── */}
          {modal === "add" ? (
            <div className="form-group">
              <label className="form-label">Modèles iPhone * <span style={{ color: "var(--text2)", fontWeight: 400 }}>({selectedModels.length} sélectionné{selectedModels.length > 1 ? "s" : ""})</span></label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={selectAllModels}>Tout sélectionner</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={clearModels}>Tout effacer</button>
              </div>
              <div className="models-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, maxHeight: 220, overflowY: "auto", padding: "8px", background: "var(--bg3)", borderRadius: 8, border: errors.model ? "1px solid var(--danger)" : "1px solid var(--border)" }}>
                {models.map(m => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer", padding: "5px 6px", borderRadius: 6, background: selectedModels.includes(m) ? "rgba(124,58,237,0.15)" : "transparent", border: selectedModels.includes(m) ? "1px solid var(--accent2)" : "1px solid transparent", transition: "all 0.12s" }}>
                    <input type="checkbox" checked={selectedModels.includes(m)} onChange={() => toggleModel(m)} style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
                    {m}
                  </label>
                ))}
              </div>
              <FieldError msg={errors.model} />
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Modèle iPhone *</label>
                <select className={`input${errors.model ? " input-error" : ""}`} value={form.model} onChange={e => handleModelChange(e.target.value)}>
                  <option value="">Choisir un modèle</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <FieldError msg={errors.model} />
              </div>
              <div className="form-group">
                <label className="form-label">Prix (FCFA) *</label>
                <input
                  className={`input${errors.price ? " input-error" : ""}`}
                  type="number" min="1"
                  value={form.price}
                  onChange={e => { setForm(f => ({ ...f, price: e.target.value })); if (errors.price) setErrors(er => ({ ...er, price: undefined })); }}
                  placeholder="3500"
                />
                {form.model && priceSettings.modelPrices[form.model] && (
                  <span style={{ fontSize: 11, color: "var(--accent2)" }}>Suggéré : {fmtMoney(priceSettings.modelPrices[form.model])}</span>
                )}
                <FieldError msg={errors.price} />
              </div>
            </div>
          )}

          {/* ── PRIX (mode add : commun à tous les modèles) ── */}
          {modal === "add" && (
            <div className="form-group">
              <label className="form-label">Prix (FCFA) * <span style={{ color: "var(--text2)", fontWeight: 400, fontSize: 11 }}>— sera appliqué à tous les modèles</span></label>
              <input
                className={`input${errors.price ? " input-error" : ""}`}
                type="number" min="1"
                value={form.price}
                onChange={e => { setForm(f => ({ ...f, price: e.target.value })); if (errors.price) setErrors(er => ({ ...er, price: undefined })); }}
                placeholder="ex: 5000"
              />
              <FieldError msg={errors.price} />
            </div>
          )}

          {/* ── DESIGN ── */}
          <div className="form-group">
            <label className="form-label">Design *</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className={`input${errors.design ? " input-error" : ""}`}
                value={form.design}
                onChange={e => { setForm(f => ({ ...f, design: e.target.value })); if (errors.design) setErrors(er => ({ ...er, design: undefined })); }}
                placeholder="Nom du design"
                style={{ flex: 1 }}
              />
              <button className="btn btn-outline btn-sm" onClick={() => setDesignPickerOpen(true)}><Icon name="palette" size={13} /> Parcourir</button>
            </div>
            <FieldError msg={errors.design} />
            {form.designImage && (
              <img src={form.designImage} alt="" style={{ height: 50, borderRadius: 8, marginTop: 4, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Quantité initiale {modal === "add" && selectedModels.length > 1 ? `(× ${selectedModels.length} modèles)` : ""}</label>
            <input
              className={`input${errors.stock ? " input-error" : ""}`}
              type="number" min="0"
              value={form.stock}
              onChange={e => { setForm(f => ({ ...f, stock: e.target.value })); if (errors.stock) setErrors(er => ({ ...er, stock: undefined })); }}
              placeholder="0"
            />
            <FieldError msg={errors.stock} />
          </div>
        </Modal>
      )}

      {designPickerOpen && (
        <Modal title={`Choisir un design (${designs.length})`} onClose={() => setDesignPickerOpen(false)} wide>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>Cliquez sur un design pour le sélectionner. Les images uploadées depuis vos fichiers s'affichent, les images Unsplash par défaut nécessitent une mise à jour dans Paramètres → Designs.</p>
          <div className="designs-grid">
            {designs.map(d => (
              <div key={d.id} className={`design-card ${form.design === d.name ? "selected" : ""}`} onClick={() => handleDesignSelect(d)}>
                <DesignThumb image={d.image} name={d.name} />
                <div className="design-card-name">{d.id} — {d.name}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── STOCK MOVEMENTS ───────────────────────────────────────────────────────

export default Products;
