import { useState, useEffect, useCallback } from "react";
import { getDB } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, onSnapshot,
  doc as fDoc,
} from "firebase/firestore";

// ── Utilitaires ───────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ── Éditeur de post ───────────────────────────────────────────────────────────
function PostEditor({ post, onSave, onCancel }) {
  const [form, setForm] = useState({
    title:    post?.title    || "",
    excerpt:  post?.excerpt  || "",
    content:  post?.content  || "",
    cover:    post?.cover    || "",
    tags:     post?.tags?.join(", ") || "",
    published: post?.published ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.title.trim())   e.title   = "Titre requis";
    if (!form.content.trim()) e.content = "Contenu requis";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        title:   form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        cover:   form.cover.trim(),
        tags:    form.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };

  const inp = (field) => ({
    value: form[field],
    onChange: (e) => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: "" })); },
  });

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{post ? "Modifier l'article" : "Nouvel article"}</h3>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>Annuler</button>
      </div>

      {/* Titre */}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Titre *</label>
        <input className={`form-input${errors.title ? " error" : ""}`} placeholder="Titre de l'article" {...inp("title")} />
        {errors.title && <p className="field-error">{errors.title}</p>}
      </div>

      {/* Extrait */}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Extrait <span style={{ color: "var(--text2)", fontWeight: 400 }}>(affiché sur la liste)</span></label>
        <textarea className="form-input" rows={2} placeholder="Résumé court de l'article…" {...inp("excerpt")} style={{ resize: "vertical", fontFamily: "inherit" }} />
      </div>

      {/* Image de couverture */}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Image de couverture <span style={{ color: "var(--text2)", fontWeight: 400 }}>(URL Cloudinary)</span></label>
        <input className="form-input" placeholder="https://res.cloudinary.com/..." {...inp("cover")} />
        {form.cover && (
          <img src={form.cover} alt="couverture" style={{ marginTop: 8, width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
        )}
      </div>

      {/* Contenu */}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Contenu *</label>
        <textarea
          className={`form-input${errors.content ? " error" : ""}`}
          rows={10}
          placeholder="Écris l'article ici. Tu peux utiliser du Markdown ou du texte simple."
          {...inp("content")}
          style={{ resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.7 }}
        />
        {errors.content && <p className="field-error">{errors.content}</p>}
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Tags <span style={{ color: "var(--text2)", fontWeight: 400 }}>(séparés par des virgules)</span></label>
        <input className="form-input" placeholder="bogolan, culture, mali" {...inp("tags")} />
      </div>

      {/* Statut de publication */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <div
          onClick={() => setForm(f => ({ ...f, published: !f.published }))}
          style={{
            width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s",
            background: form.published ? "var(--success)" : "var(--bg3)",
            border: "1px solid var(--border2)", position: "relative", flexShrink: 0,
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 2,
            left: form.published ? 20 : 2,
            transition: "left 0.2s",
          }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {form.published ? "✅ Publié — visible sur le site vitrine" : "⏸ Brouillon — non visible"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 120 }}
        >
          {saving ? "Enregistrement…" : (post ? "Mettre à jour" : "Publier")}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

// ── Carte d'article ───────────────────────────────────────────────────────────
function PostCard({ post, onEdit, onDelete, onTogglePublish }) {
  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
      {post.cover && (
        <div style={{ margin: "-20px -20px 16px", height: 140, overflow: "hidden" }}>
          <img src={post.cover} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span className={`badge ${post.published ? "badge-success" : "badge-warn"}`}>
              {post.published ? "Publié" : "Brouillon"}
            </span>
            {post.tags?.map(t => (
              <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "var(--bg3)", color: "var(--text2)", fontWeight: 600 }}>
                {t}
              </span>
            ))}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{post.title}</h3>
          {post.excerpt && (
            <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {post.excerpt}
            </p>
          )}
          <p style={{ fontSize: 11, color: "var(--text2)" }}>
            {fmtDate(post.createdAt)}
            {post.updatedAt && post.updatedAt !== post.createdAt && " · modifié"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-outline btn-sm" onClick={() => onEdit(post)}>✏️ Modifier</button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onTogglePublish(post)}
          style={{ color: post.published ? "var(--warn)" : "var(--success)" }}
        >
          {post.published ? "⏸ Dépublier" : "✅ Publier"}
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onDelete(post)}
          style={{ color: "var(--danger)", marginLeft: "auto" }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ── Page principale Blog ──────────────────────────────────────────────────────
export default function BlogPage() {
  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [editing,  setEditing]  = useState(null);   // null | "new" | post
  const [filter,   setFilter]   = useState("all");  // "all" | "published" | "draft"
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Écoute Firestore temps réel ──────────────────────────────────────────
  useEffect(() => {
    const db = getDB();
    const q = query(collection(db, "blog_posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Blog Firestore error:", err);
        setLoading(false);
        setError("Impossible de charger les articles. Vérifie ta connexion ou les règles Firestore.");
      }
    );
    return () => unsub();
  }, []);

  // ── Sauvegarder (créer ou modifier) ─────────────────────────────────────
  const handleSave = useCallback(async (formData) => {
    const db = getDB();
    if (editing === "new") {
      await addDoc(collection(db, "blog_posts"), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast("Article créé ✓");
    } else {
      await updateDoc(fDoc(db, "blog_posts", editing.id), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      showToast("Article mis à jour ✓");
    }
    setEditing(null);
  }, [editing]);

  // ── Supprimer ────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (post) => {
    if (!window.confirm(`Supprimer "${post.title}" ?`)) return;
    const db = getDB();
    await deleteDoc(fDoc(db, "blog_posts", post.id));
    showToast("Article supprimé");
  }, []);

  // ── Publier / Dépublier ──────────────────────────────────────────────────
  const handleTogglePublish = useCallback(async (post) => {
    const db = getDB();
    await updateDoc(fDoc(db, "blog_posts", post.id), {
      published: !post.published,
      updatedAt: serverTimestamp(),
    });
    showToast(post.published ? "Article dépublié" : "Article publié ✓");
  }, []);

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const filtered = posts.filter(p => {
    if (filter === "published") return p.published;
    if (filter === "draft")     return !p.published;
    return true;
  });

  const published = posts.filter(p => p.published).length;
  const drafts    = posts.filter(p => !p.published).length;

  // ── Rendu éditeur ────────────────────────────────────────────────────────
  if (editing !== null) {
    return (
      <PostEditor
        post={editing === "new" ? null : editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "var(--success)" : "var(--danger)",
          color: "#fff", padding: "10px 20px", borderRadius: 20,
          fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Articles du blog</h2>
          <p style={{ fontSize: 12, color: "var(--text2)" }}>
            {published} publié(s) · {drafts} brouillon(s) · synchronisé avec le site vitrine
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          + Nouvel article
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[
          { id: "all",       label: `Tous (${posts.length})` },
          { id: "published", label: `Publiés (${published})` },
          { id: "draft",     label: `Brouillons (${drafts})` },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`btn btn-sm ${filter === f.id ? "btn-primary" : "btn-outline"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
          Chargement…
        </div>
      )}

      {!loading && error && (
        <div className="card" style={{ textAlign: "center", padding: 32, borderColor: "var(--danger)" }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>⚠️</p>
          <p style={{ fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>Erreur de chargement</p>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>{error}</p>
          <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✍️</p>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Aucun article</p>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
            Crée ton premier article pour alimenter le blog du site vitrine.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            Créer un article
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onEdit={setEditing}
            onDelete={handleDelete}
            onTogglePublish={handleTogglePublish}
          />
        ))}
      </div>
    </div>
  );
}
