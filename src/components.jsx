import { memo } from "react";

export const Modal = memo(({ title, children, footer, onClose, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 16, width: "100%", maxWidth: wide ? 700 : 480, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border2)" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{title}</span>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }}>✕</button>
      </div>
      <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
      {footer && <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border2)", display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
    </div>
  </div>
));

export const StatCard = memo(({ label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={color ? { color } : {}}>{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
));

export const FieldError = ({ msg }) => msg
  ? <span style={{ color: "var(--danger)", fontSize: 11, marginTop: 2 }}>{msg}</span>
  : null;

export function DesignThumb({ image, name, height = 80 }) {
  if (!image) return (
    <div style={{ width: height, height, borderRadius: 8, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text2)" }}>
      {name?.[0] || "?"}
    </div>
  );
  return (
    <img src={image} alt={name} style={{ width: height, height, objectFit: "cover", borderRadius: 8, background: "var(--bg3)" }}
      onError={e => { e.target.style.display = "none"; }} />
  );
}
