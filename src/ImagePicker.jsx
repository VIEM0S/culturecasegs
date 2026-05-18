import { useState, useRef } from "react";
import Icon from "./Icon.jsx";
import { uploadImageToStorage } from "./firebase.js";

// ── Génère une clé unique pour Firebase Storage ──────────────────────────────
function makeKey() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Compresse l'image côté client avant l'upload ─────────────────────────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Fichier invalide"));
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600; // px max
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImagePicker({ value, onChange, label = "Image du design", storageKey }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState(null); // null | "compress" | "upload" | "error"

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setStatus("compress");
    try {
      const dataUrl = await compressImage(file);
      setStatus("upload");
      // Upload vers Firebase Storage → URL https:// accessible partout
      const key = storageKey || makeKey();
      const url = await uploadImageToStorage(key, dataUrl);
      onChange(url);
      setStatus(null);
    } catch (e) {
      console.error("ImagePicker upload:", e);
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const statusLabel = {
    compress: "Compression…",
    upload:   "Upload en cours…",
    error:    "❌ Erreur — réessaie",
  }[status] ?? null;

  const isLoading = status === "compress" || status === "upload";

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      <div
        onClick={() => !isLoading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border2)"}`,
          borderRadius: 10,
          cursor: isLoading ? "wait" : "pointer",
          transition: "border 0.15s",
          background: dragOver ? "rgba(124,58,237,0.07)" : "var(--bg3)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 6, minHeight: 90, padding: 10,
          overflow: "hidden", position: "relative",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {statusLabel ? (
          <span style={{ fontSize: 12, color: status === "error" ? "var(--danger)" : "var(--text2)" }}>
            {statusLabel}
          </span>
        ) : value && (value.startsWith("https://") || value.startsWith("data:")) ? (
          <img
            src={value}
            alt="aperçu"
            style={{ maxHeight: 80, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
          />
        ) : (
          <>
            <Icon name="image" size={24} />
            <span style={{ fontSize: 11.5, color: "var(--text2)", textAlign: "center", lineHeight: 1.5 }}>
              Cliquer ou glisser une image<br />
              <span style={{ color: "var(--accent2)", fontWeight: 600 }}>JPG · PNG · WEBP</span>
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {value && !isLoading && (
        <button
          className="btn btn-danger btn-sm"
          style={{ marginTop: 6, width: "100%", justifyContent: "center" }}
          onClick={e => { e.stopPropagation(); onChange(""); }}
        >
          <Icon name="trash" size={12} /> Supprimer l'image
        </button>
      )}

      <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 5 }}>
        ☁️ Image synchronisée sur tous vos appareils via Firebase
      </p>
    </div>
  );
}

export default ImagePicker;
