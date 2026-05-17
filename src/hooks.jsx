import { useState, useCallback, memo } from "react";

// ── Dialog (confirm / alert) ──────────────────────────────────────────────────
// Composant défini au NIVEAU MODULE pour que memo() soit réellement efficace.
// (Défini dans le hook = nouvelle référence à chaque render = memo inutile)
const DialogView = memo(function DialogView({ state, setState }) {
  if (!state) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16
    }}>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border2)",
        borderRadius: 14, padding: 24, maxWidth: 360, width: "100%"
      }}
        role="dialog"
        aria-modal="true"
        aria-label={state.type === "confirm" ? "Confirmation" : "Information"}
      >
        <p style={{ color: "var(--text)", marginBottom: 20, lineHeight: 1.5 }}>
          {state.msg}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {state.type === "confirm" && (
            <button
              className="btn btn-outline"
              onClick={() => { setState(null); state.resolve(false); }}
            >
              Annuler
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => { setState(null); state.resolve(true); }}
          >
            {state.type === "confirm" ? "Confirmer" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
});

export function useDialog() {
  const [state, setState] = useState(null);

  const confirm = useCallback((msg) => new Promise(resolve => {
    setState({ type: "confirm", msg, resolve });
  }), []);

  const alert = useCallback((msg) => new Promise(resolve => {
    setState({ type: "alert", msg, resolve });
  }), []);

  const Dialog = useCallback(() => <DialogView state={state} setState={setState} />, [state]);
  Dialog.displayName = "Dialog";

  return { confirm, alert, Dialog };
}

// ── Toast notifications ───────────────────────────────────────────────────────
const ToastsView = memo(function ToastsView({ toasts }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed", bottom: 80, right: 16,
        zIndex: 500, display: "flex", flexDirection: "column", gap: 8
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error"   ? "var(--danger)"
                    : t.type === "success" ? "var(--success2)"
                    : "var(--bg3)",
          border: `1px solid ${
            t.type === "error"   ? "var(--danger)"
            : t.type === "success" ? "var(--success)"
            : "var(--border2)"
          }`,
          color: "var(--text)",
          borderRadius: 10, padding: "10px 16px",
          fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          animation: "slideUp 0.3s ease"
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
});

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = "info") => {
    const id = crypto.randomUUID();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const Toasts = useCallback(() => <ToastsView toasts={toasts} />, [toasts]);
  Toasts.displayName = "Toasts";

  return { toast, Toasts };
}
