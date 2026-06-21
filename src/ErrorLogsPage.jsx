import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { getDB } from "./firebase";
const db = getDB();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Card erreur ─────────────────────────────────────────────────────────────
function ErrorCard({ log, onDelete, loading }) {
  const { id, message, page, userAgent, createdAt } = log;

  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #E8E4DC",
        borderRadius: 12,
        padding: "1.1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        opacity: loading ? 0.6 : 1,
        transition: "opacity .2s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 20,
            background: "#FFF5F5",
            color: "#C62828",
            border: "1px solid #FFCDD2",
            flexShrink: 0,
          }}
        >
          Erreur
        </span>
        <span style={{ fontSize: 10, color: "#AAA", whiteSpace: "nowrap" }}>
          {formatDate(createdAt)}
        </span>
      </div>

      <p
        style={{
          fontSize: 13.5,
          color: "#1E0900",
          lineHeight: 1.6,
          margin: 0,
          fontFamily: "monospace",
          wordBreak: "break-word",
          borderLeft: "3px solid #C62828",
          paddingLeft: 12,
        }}
      >
        {message}
      </p>

      {(page || userAgent) && (
        <div style={{ fontSize: 11, color: "#999", display: "flex", flexDirection: "column", gap: 2 }}>
          {page && <span>Page : {page}</span>}
          {userAgent && (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userAgent}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onDelete(id)}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1.5px solid #FFCDD2",
            cursor: "pointer",
            background: "#FFF5F5",
            color: "#C62828",
            fontSize: 12,
            fontWeight: 700,
          }}
          title="Supprimer ce log"
        >
          🗑 Supprimer
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ErrorLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(null); // id en cours de suppression
  const [error, setError] = useState(null);

  // Écoute temps réel — triée par date desc
  useEffect(() => {
    const q = query(collection(db, "error_logs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(err.message),
    );
    return unsub;
  }, []);

  async function handleDelete(id) {
    if (!window.confirm("Supprimer définitivement ce log ?")) return;
    setLoading(id);
    try {
      await deleteDoc(doc(db, "error_logs", id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleClearAll() {
    if (logs.length === 0) return;
    if (!window.confirm(`Supprimer définitivement les ${logs.length} logs ?`)) return;
    setLoading("__all__");
    try {
      await Promise.all(logs.map((l) => deleteDoc(doc(db, "error_logs", l.id))));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      style={{
        padding: "1.5rem 2rem",
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* En-tête */}
      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 32,
              letterSpacing: 2,
              color: "#1E0900",
              margin: 0,
            }}
          >
            ERREURS
          </h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            Crashs capturés automatiquement par le backoffice.
          </p>
        </div>
        {logs.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={loading === "__all__"}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1.5px solid #DDD",
              cursor: "pointer",
              background: "#F9F9F9",
              color: "#666",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Tout effacer ({logs.length})
          </button>
        )}
      </div>

      {/* Erreur de chargement */}
      {error && (
        <div
          style={{
            background: "#FFF5F5",
            border: "1px solid #FFCDD2",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#C62828",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#C62828",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Liste */}
      {logs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "#BBB",
            fontSize: 14,
          }}
        >
          Aucune erreur enregistrée — tout va bien.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {logs.map((l) => (
            <ErrorCard
              key={l.id}
              log={l}
              loading={loading === l.id || loading === "__all__"}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
