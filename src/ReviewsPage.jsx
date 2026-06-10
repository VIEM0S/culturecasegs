import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getDB } from "./firebase";
const db = getDB();
// ─── Constantes ──────────────────────────────────────────────────────────────
const TABS = [
  { key: "pending", label: "En attente", color: "#E8A020" },
  { key: "published", label: "Publiés", color: "#1E5C35" },
  { key: "rejected", label: "Rejetés", color: "#999" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Stars({ n = 5 }) {
  return (
    <span style={{ color: "#E8A020", letterSpacing: 1 }}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}

function formatDate(val) {
  if (!val) return "—";
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const map = {
    pending: {
      label: "En attente",
      bg: "#FFF8E6",
      color: "#8B6300",
      border: "#F5C842",
    },
    published: {
      label: "Publié",
      bg: "#EDF7F1",
      color: "#1E5C35",
      border: "#52B37A",
    },
    rejected: { label: "Rejeté", bg: "#F5F5F5", color: "#666", border: "#CCC" },
  };
  const s = map[status] || map.pending;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Card avis ───────────────────────────────────────────────────────────────
function ReviewCard({ review, onPublish, onReject, onDelete, loading }) {
  const { id, nom, loc, txt, stars, status, createdAt } = review;
  const initials = (nom || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #E8E4DC",
        borderRadius: 12,
        padding: "1.1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        opacity: loading ? 0.6 : 1,
        transition: "opacity .2s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#D94E15",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1E0900" }}>
              {nom}
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              {loc || "Bamako, Mali"}
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Note */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Stars n={stars || 5} />
        <span style={{ fontSize: 10, color: "#AAA" }}>
          {formatDate(createdAt)}
        </span>
      </div>

      {/* Texte */}
      <p
        style={{
          fontSize: 13.5,
          color: "#333",
          lineHeight: 1.7,
          margin: 0,
          fontStyle: "italic",
          borderLeft: "3px solid #E8A020",
          paddingLeft: 12,
        }}
      >
        « {txt} »
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {status !== "published" && (
          <button
            onClick={() => onPublish(id)}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 100,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: "#1E5C35",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            ✓ Publier
          </button>
        )}
        {status !== "rejected" && (
          <button
            onClick={() => onReject(id)}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 100,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1.5px solid #DDD",
              cursor: "pointer",
              background: "#F9F9F9",
              color: "#666",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            ✕ Rejeter
          </button>
        )}
        {status === "published" && (
          <button
            onClick={() => onReject(id)}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 100,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1.5px solid #DDD",
              cursor: "pointer",
              background: "#F9F9F9",
              color: "#666",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            ↩ Dépublier
          </button>
        )}
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
          title="Supprimer définitivement"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(null); // id en cours d'action
  const [error, setError] = useState(null);

  // Écoute temps réel — toute la collection, triée par date desc
  useEffect(() => {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(err.message),
    );
    return unsub;
  }, []);

  async function handlePublish(id) {
    setLoading(id);
    try {
      await updateDoc(doc(db, "reviews", id), { status: "published" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleReject(id) {
    setLoading(id);
    try {
      await updateDoc(doc(db, "reviews", id), { status: "rejected" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer définitivement cet avis ?")) return;
    setLoading(id);
    try {
      await deleteDoc(doc(db, "reviews", id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  const counts = {
    pending: reviews.filter((r) => r.status === "pending").length,
    published: reviews.filter((r) => r.status === "published").length,
    rejected: reviews.filter((r) => r.status === "rejected").length,
  };
  const filtered = reviews.filter((r) => r.status === tab);

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
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 32,
            letterSpacing: 2,
            color: "#1E0900",
            margin: 0,
          }}
        >
          AVIS CLIENTS
        </h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          Modérez les avis soumis depuis le site. Seuls les avis publiés
          apparaissent sur l'accueil.
        </p>
      </div>

      {/* Erreur */}
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

      {/* Onglets */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: "1.5rem",
          borderBottom: "2px solid #EEE",
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: tab === t.key ? t.color : "#AAA",
              borderBottom:
                tab === t.key
                  ? `2.5px solid ${t.color}`
                  : "2.5px solid transparent",
              marginBottom: -2,
              transition: "color .15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                style={{
                  background: tab === t.key ? t.color : "#DDD",
                  color: tab === t.key ? "#fff" : "#888",
                  fontSize: 10,
                  fontWeight: 900,
                  padding: "1px 6px",
                  borderRadius: 20,
                  transition: "background .15s, color .15s",
                }}
              >
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "#BBB",
            fontSize: 14,
          }}
        >
          {tab === "pending"
            ? "Aucun avis en attente — vous êtes à jour."
            : tab === "published"
              ? "Aucun avis publié pour l'instant."
              : "Aucun avis rejeté."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              loading={loading === r.id}
              onPublish={handlePublish}
              onReject={handleReject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
