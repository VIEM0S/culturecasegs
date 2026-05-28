import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import ImagePicker from "./ImagePicker.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";


// ─── THEME TOGGLE ──────────────────────────────────────────────────────────
function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("cc-theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cc-theme", theme);
  }, [theme]);

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {[
        { id: "dark",  label: "🌙 Mode sombre", desc: "Interface sombre — idéal en intérieur" },
        { id: "light", label: "☀️ Mode clair",  desc: "Interface claire — idéal en plein soleil" },
      ].map(opt => (
        <div
          key={opt.id}
          onClick={() => setTheme(opt.id)}
          style={{
            flex: 1, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
            border: `2px solid ${theme === opt.id ? "var(--accent2)" : "var(--border)"}`,
            background: theme === opt.id ? "rgba(167,139,250,0.08)" : "var(--bg3)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{opt.label}</div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{opt.desc}</div>
          {theme === opt.id && (
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "var(--accent2)" }}>✓ Actif</div>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsPage({ data, onSave, onPersist, onSaveProduct, confirm }) {
  const { settings } = data;
  const [tab, setTab] = useState("prices");
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupDone, setBackupDone]       = useState(false);

  const handleExportBackup = () => {
    setBackupLoading(true);
    setBackupDone(false);
    try {
      exportData(data);
      setBackupDone(true);
    } catch {
      // erreur silencieuse
    } finally {
      setBackupLoading(false);
      setTimeout(() => setBackupDone(false), 4000);
    }
  };
  const [localSettings, setLocalSettings] = useState(() => JSON.parse(JSON.stringify(settings)));
  const [saved, setSaved] = useState(false);
  const [saveDesignsNow, setSaveDesignsNow] = useState(false);

  // ── Sauvegarde auto des designs sans passer par saveSettings (async) ──
  useEffect(() => {
    if (!saveDesignsNow) return;
    setSaveDesignsNow(false);
    // Appel direct à persist via onSave avec les settings mis à jour
    // On utilise un ref pour récupérer localSettings à jour
    // persist direct : met à jour data.settings sans passer par saveSettings (async)
    onPersist({ ...data, settings: localSettingsRef.current });
  }, [saveDesignsNow, onSave]);

  const localSettingsRef = useRef(localSettings);
  useEffect(() => { localSettingsRef.current = localSettings; }, [localSettings]);

  // ── Models ──
  const [newModel, setNewModel] = useState("");
  const [editingModel, setEditingModel] = useState(null); // { original, value }

  const addModel = () => {
    const name = sanitize(newModel, 60);
    if (!name || localSettings.models.includes(name)) return;
    setLocalSettings(s => ({ ...s, models: [...s.models, name].sort() }));
    setNewModel("");
  };

  const removeModel = async (m) => {
    const ok = await confirm(`Supprimer le modèle "${m}" ?`);
    if (!ok) return;
    setLocalSettings(s => ({ ...s, models: s.models.filter(x => x !== m) }));
  };

  const startEditModel = (m) => setEditingModel({ original: m, value: m });

  const confirmEditModel = () => {
    if (!editingModel) return;
    const { original, value } = editingModel;
    const trimmed = value.trim();
    if (!trimmed || (trimmed !== original && localSettings.models.includes(trimmed))) {
      setEditingModel(null); return;
    }
    setLocalSettings(s => ({
      ...s,
      models: s.models.map(m => m === original ? trimmed : m).sort(),
      priceSettings: {
        ...s.priceSettings,
        modelPrices: Object.fromEntries(
          Object.entries(s.priceSettings.modelPrices).map(([k, v]) => [k === original ? trimmed : k, v])
        ),
      },
    }));
    setEditingModel(null);
  };

  // ── Designs ──
  const emptyNewDesign = { id: "", name: "", image: "" };
  const [newDesign, setNewDesign] = useState(emptyNewDesign);
  const [editingDesign, setEditingDesign] = useState(null); // { ...design }

  const nextDesignId = () => {
    const nums = localSettings.designs.map(d => parseInt(d.id.replace(/\D/g, "")) || 0);
    return `D${Math.max(0, ...nums) + 1}`;
  };

  const addDesign = () => {
    if (!newDesign.name.trim()) return;
    const id = newDesign.id.trim() || nextDesignId();
    const design = { id, name: newDesign.name.trim(), image: newDesign.image };
    setLocalSettings(s => ({ ...s, designs: [...s.designs, design] }));
    setSaveDesignsNow(true);
    setNewDesign(emptyNewDesign);

    // Créer automatiquement un produit pour chaque modèle existant
    if (onSaveProduct && typeof onSaveProduct === "function" && data?.settings?.models?.length > 0) {
      const models = data.settings.models;
      const prices = data?.settings?.priceSettings?.modelPrices || {};
      const today  = new Date().toISOString().slice(0, 10);
      const newProducts = models.map(model => ({
        id:        uid(),
        model,
        design:    design.name,
        designId:  design.id,
        stock:     0,
        price:     prices[model] || 5000,
        createdAt: today,
        imageUrl:  design.image || "",
      }));
      onSaveProduct(newProducts);
    }
  };

  const removeDesign = async (id) => {
    const ok = await confirm("Supprimer ce design ?");
    if (!ok) return;
    setLocalSettings(s => ({ ...s, designs: s.designs.filter(d => d.id !== id) }));
    setSaveDesignsNow(true);
  };

  const startEditDesign = (d) => setEditingDesign({ ...d });

  const confirmEditDesign = () => {
    if (!editingDesign) return;
    setLocalSettings(s => ({ ...s, designs: s.designs.map(d => d.id === editingDesign.id ? { ...editingDesign, name: editingDesign.name.trim() || d.name } : d) }));
    setEditingDesign(null);
    setSaveDesignsNow(true);
  };

  // ── Prices ──
  const updateModelPrice = (model, price) => {
    setLocalSettings(s => ({
      ...s,
      priceSettings: { ...s.priceSettings, modelPrices: { ...s.priceSettings.modelPrices, [model]: parseInt(price) || 0 } },
    }));
  };

  // ── Volume discounts ──
  const updateVolumeDiscount = (idx, field, val) => {
    setLocalSettings(s => {
      const vd = [...s.priceSettings.volumeDiscounts];
      vd[idx] = { ...vd[idx], [field]: parseInt(val) || 0 };
      return { ...s, priceSettings: { ...s.priceSettings, volumeDiscounts: vd } };
    });
  };
  const addVolumeDiscount = () => {
    setLocalSettings(s => ({ ...s, priceSettings: { ...s.priceSettings, volumeDiscounts: [...s.priceSettings.volumeDiscounts, { minQty: 1, percent: 5 }] } }));
  };
  const removeVolumeDiscount = (idx) => {
    setLocalSettings(s => ({ ...s, priceSettings: { ...s.priceSettings, volumeDiscounts: s.priceSettings.volumeDiscounts.filter((_, i) => i !== idx) } }));
  };

  const handleSave = () => {
    onSave(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      {/* Edit Model Modal */}
      {editingModel && (
        <Modal title="Modifier le modèle" onClose={() => setEditingModel(null)}
          footer={<>
            <button className="btn btn-outline btn-sm" onClick={() => setEditingModel(null)}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={confirmEditModel}>Enregistrer</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Nom du modèle</label>
            <input
              className="input"
              value={editingModel.value}
              onChange={e => setEditingModel(m => ({ ...m, value: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && confirmEditModel()}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Edit Design Modal */}
      {editingDesign && (
        <Modal title="Modifier le design" onClose={() => setEditingDesign(null)}
          footer={<>
            <button className="btn btn-outline btn-sm" onClick={() => setEditingDesign(null)}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={confirmEditDesign}>Enregistrer</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">ID</label>
            <input className="input" value={editingDesign.id} disabled style={{ opacity: 0.5 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Nom du design *</label>
            <input
              className="input"
              value={editingDesign.name}
              onChange={e => setEditingDesign(d => ({ ...d, name: e.target.value }))}
              autoFocus
            />
          </div>
          <ImagePicker
            label="Image du design"
            value={editingDesign.image}
            onChange={img => setEditingDesign(d => ({ ...d, image: img }))}
          />
        </Modal>
      )}

      <div className="section-header">
        <span className="section-title">Paramètres</span>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? "✓ Enregistré !" : "Enregistrer les modifications"}
        </button>
      </div>
      {saved && <div className="alert alert-success" style={{ marginBottom: 14 }}>✓ Paramètres enregistrés avec succès</div>}

      <div className="tabs">
        <button className={`tab ${tab === "prices" ? "active" : ""}`} onClick={() => setTab("prices")}><Icon name="tag" size={13} /> Prix</button>
        <button className={`tab ${tab === "discounts" ? "active" : ""}`} onClick={() => setTab("discounts")}><Icon name="percent" size={13} /> Remises</button>
        <button className={`tab ${tab === "models" ? "active" : ""}`} onClick={() => setTab("models")}><Icon name="smartphone" size={13} /> Modèles</button>
        <button className={`tab ${tab === "designs" ? "active" : ""}`} onClick={() => setTab("designs")}><Icon name="palette" size={13} /> Designs</button>
        <button className={`tab ${tab === "backup" ? "active" : ""}`} onClick={() => setTab("backup")}><Icon name="download" size={13} /> Backup</button>
        <button className={`tab ${tab === "apparence" ? "active" : ""}`} onClick={() => setTab("apparence")}><Icon name="settings" size={13} /> Apparence</button>
      </div>

      {tab === "prices" && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 16 }}>Prix par modèle iPhone</p>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>Ces prix sont suggérés automatiquement lors de la création d'un produit.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {localSettings.models.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg3)", borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m}</span>
                <input
                  className="input" type="number" min="0"
                  value={localSettings.priceSettings.modelPrices[m] || ""}
                  onChange={e => updateModelPrice(m, e.target.value)}
                  style={{ width: 90, padding: "6px 10px", fontSize: 13 }}
                  placeholder="FCFA"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "discounts" && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 4 }}>Remises automatiques par volume</p>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>Appliquées automatiquement selon la quantité commandée.</p>
          {localSettings.priceSettings.volumeDiscounts.map((vd, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, background: "var(--bg3)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ flex: 1, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--text2)" }}>À partir de</span>
                <input className="input" type="number" min="1" value={vd.minQty} onChange={e => updateVolumeDiscount(i, "minQty", e.target.value)} style={{ width: 70, padding: "6px 10px" }} />
                <span style={{ fontSize: 13, color: "var(--text2)" }}>coques →</span>
                <input className="input" type="number" min="1" max="100" value={vd.percent} onChange={e => updateVolumeDiscount(i, "percent", e.target.value)} style={{ width: 70, padding: "6px 10px" }} />
                <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: 700 }}>% de réduction</span>
              </div>
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeVolumeDiscount(i)}><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={addVolumeDiscount}><Icon name="plus" size={13} /> Ajouter un palier</button>
        </div>
      )}

      {tab === "models" && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 4 }}>Modèles de téléphone ({localSettings.models.length})</p>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>Ajoutez, modifiez ou supprimez n'importe quel modèle.</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              className="input"
              value={newModel}
              onChange={e => setNewModel(e.target.value)}
              placeholder="ex: iPhone 18 Pro Max"
              onKeyDown={e => e.key === "Enter" && addModel()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={addModel}><Icon name="plus" size={13} /> Ajouter</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {localSettings.models.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg3)", borderRadius: 8, padding: "8px 12px" }}>
                <Icon name="smartphone" size={13} />
                <span style={{ flex: 1, fontSize: 13 }}>{m}</span>
                <button className="btn btn-outline btn-sm btn-icon" style={{ padding: "4px 6px" }} title="Modifier" onClick={() => startEditModel(m)}>
                  <Icon name="edit" size={12} />
                </button>
                <button className="btn btn-danger btn-sm btn-icon" style={{ padding: "4px 6px" }} title="Supprimer" onClick={() => removeModel(m)}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "designs" && (
        <div>
          {/* Formulaire ajout */}
          <div className="card" style={{ marginBottom: 14 }}>
            <p className="section-label" style={{ marginBottom: 12 }}>Ajouter un nouveau design</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">ID (optionnel, ex: D43)</label>
                <input
                  className="input"
                  value={newDesign.id}
                  onChange={e => setNewDesign(d => ({ ...d, id: e.target.value }))}
                  placeholder={nextDesignId()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nom du design *</label>
                <input
                  className="input"
                  value={newDesign.name}
                  onChange={e => setNewDesign(d => ({ ...d, name: e.target.value }))}
                  placeholder="Ex: Fleur Tropicale 2"
                  onKeyDown={e => e.key === "Enter" && addDesign()}
                />
              </div>
            </div>
            <ImagePicker
              label="Image du design"
              value={newDesign.image}
              onChange={img => setNewDesign(d => ({ ...d, image: img }))}
            />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={addDesign} disabled={!newDesign.name.trim()}>
              <Icon name="plus" size={13} /> Ajouter ce design
            </button>
          </div>

          {/* Grille designs */}
          <div className="card">
            <p className="section-label" style={{ marginBottom: 14 }}>Designs disponibles ({localSettings.designs.length})</p>
            <div className="designs-grid">
              {localSettings.designs.map(d => (
                <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", position: "relative" }}>
                  <DesignThumb image={d.image} name={d.name} height={80} />
                  <div style={{ padding: "6px 8px", background: "var(--bg3)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent2)", flexShrink: 0 }}>{d.id}</span>
                    <span style={{ fontSize: 10, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <button
                      className="btn btn-outline btn-sm btn-icon"
                      style={{ padding: "3px 5px" }}
                      title="Modifier"
                      onClick={() => startEditDesign(d)}
                    ><Icon name="edit" size={11} /></button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      style={{ padding: "3px 5px" }}
                      title="Supprimer"
                      onClick={() => removeDesign(d.id)}
                    ><Icon name="trash" size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "backup" && (
        <div>
          {/* ── Accès partenaire (viewer) ── */}
          <div className="card" style={{ marginBottom: 14 }}>
            <p className="section-label" style={{ marginBottom: 8 }}>👁️ Accès Iya Choua (lecture seule)</p>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14, lineHeight: 1.6 }}>
              Iya Choua peut se connecter en mode <strong>lecture seule</strong> avec ce code.
              Il verra les produits et stocks disponibles mais ne pourra pas faire de ventes ni de modifications.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Code d'accès Iya Choua</label>
                <input
                  className="input"
                  type="text"
                  value={localSettings.viewerCode || "Bkocase0223"}
                  onChange={e => setLocalSettings(s => ({ ...s, viewerCode: e.target.value }))}
                  placeholder="Bkocase0223"
                  maxLength={30}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSave}>
                Enregistrer
              </button>
            </div>
            {localSettings.viewerCode && (
              <p style={{ fontSize: 12, color: "var(--success)", marginTop: 8 }}>
                ✅ Code actif — partage-le avec ton partenaire pour qu'il puisse accéder en lecture.
              </p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Exporter toutes les données</p>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16, lineHeight: 1.6 }}>
              Télécharge un fichier <strong>.json</strong> contenant l'intégralité de tes données :
              produits, ventes, mouvements, paramètres et images.
              Garde ce fichier en lieu sûr — il permet de tout restaurer.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={handleExportBackup}
                disabled={backupLoading}
              >
                <Icon name="download" size={14} />
                {backupLoading ? "Export en cours…" : "Télécharger le backup"}
              </button>
              {backupDone && (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>
                  ✓ Backup téléchargé avec succès
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ background: "var(--warn2)", border: "1px solid var(--warn)" }}>
            <p style={{ fontSize: 13, color: "var(--gold2)", lineHeight: 1.8 }}>
              <strong style={{ color: "var(--gold)" }}>⚠ Conseils</strong><br />
              • Fais un backup avant chaque mise à jour de l'application<br />
              • Stocke le fichier sur Google Drive ou envoie-le à toi-même sur WhatsApp<br />
              • Le fichier contient des données sensibles — ne le partage pas
            </p>
          </div>
        </div>
      )}


      {tab === "apparence" && (
        <div>
          <div className="card">
            <p className="section-label" style={{ marginBottom: 16 }}>Thème de l'application</p>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20, lineHeight: 1.6 }}>
              Choisis entre le mode sombre (défaut) et le mode clair. Le choix est sauvegardé sur cet appareil.
            </p>
            <ThemeToggle />
          </div>
        </div>
      )}

    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────

export default SettingsPage;
