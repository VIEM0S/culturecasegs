import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { useDialog, useToast } from "./hooks.jsx";
import { uid, sanitize, validateImageUrl, validateProductForm, validateSaleForm, validateMovementForm, getProductImageUrl } from "./utils.js";
import { DEFAULT_MODELS, DEFAULT_DESIGNS, DEFAULT_PRICE_SETTINGS, LOW_STOCK } from "./constants.js";
import { exportData, importData } from "./data.js";

function ImagePicker({ value, onChange, label = "Image du design" }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const compressAndLoad = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400; // px max side
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        onChange(compressed);
        setLoading(false);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); compressAndLoad(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border2)"}`,
          borderRadius: 10, cursor: "pointer", transition: "border 0.15s",
          background: dragOver ? "rgba(124,58,237,0.07)" : "var(--bg3)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 6, minHeight: 90, padding: 10,
          overflow: "hidden", position: "relative",
        }}
      >
        {loading ? (
          <span style={{ fontSize: 12, color: "var(--text2)" }}>Compression…</span>
        ) : value && (value.startsWith("data:") || value.startsWith("http")) ? (
          <img src={value} alt="aperçu" style={{ maxHeight: 80, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }} />
        ) : (
          <>
            <Icon name="image" size={24} />
            <span style={{ fontSize: 11.5, color: "var(--text2)", textAlign: "center", lineHeight: 1.5 }}>
              Cliquer ou glisser une image<br />
              <span style={{ color: "var(--accent2)", fontWeight: 600 }}>JPG · PNG · WEBP</span>
            </span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => compressAndLoad(e.target.files[0])} />
      </div>
      {value && (
        <button className="btn btn-danger btn-sm" style={{ marginTop: 6, width: "100%", justifyContent: "center" }}
          onClick={e => { e.stopPropagation(); onChange(""); }}>
          <Icon name="trash" size={12} /> Supprimer l'image
        </button>
      )}
      <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 5 }}>
        📁 Depuis votre téléphone ou ordinateur — fonctionne toujours, sans problème réseau
      </p>
    </div>
  );
}

// ─── SETTINGS PAGE ──────────────────────────────────────────────────────────

export default ImagePicker;
