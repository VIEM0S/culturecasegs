import { useState, useEffect, useCallback, useRef } from "react";
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

// ── Upload Cloudinary ─────────────────────────────────────────────────────────
// Remplace ces deux valeurs par les tiennes dans .env ou en dur ici
const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

async function uploadToCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    // Fallback : URL locale temporaire si Cloudinary non configuré
    return URL.createObjectURL(file);
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("folder", "culturecase/blog");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Upload échoué");
  return data.secure_url;
}

// ── Zone drag-and-drop image ──────────────────────────────────────────────────
function CoverDropzone({ url, onChange }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Fichier non valide — image uniquement.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !url && inputRef.current?.click()}
        style={{
          position: "relative",
          width: "100%",
          height: url ? 200 : 120,
          borderRadius: 10,
          border: dragging
            ? "2px dashed var(--accent, #D94E15)"
            : url ? "none" : "2px dashed var(--border2, #ccc)",
          background: url ? "transparent" : "var(--bg2, #f5f5f5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: url ? "default" : "pointer",
          overflow: "hidden",
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        {uploading && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 13, borderRadius: 10,
          }}>
            Upload en cours…
          </div>
        )}

        {url ? (
          <>
            <img
              src={url}
              alt="couverture"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              style={{
                position: "absolute", top: 8, right: 8,
                background: "rgba(0,0,0,0.55)", color: "#fff",
                border: "none", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              ✕ Supprimer
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              style={{
                position: "absolute", bottom: 8, right: 8,
                background: "rgba(0,0,0,0.55)", color: "#fff",
                border: "none", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              Changer
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text2, #888)" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {dragging ? "Dépose l'image ici" : "Glisse l'image de couverture ici"}
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>ou clique pour choisir un fichier</div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {error && (
        <p style={{ fontSize: 11, color: "var(--danger, red)", marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}

// ── Toolbar Markdown ──────────────────────────────────────────────────────────
function MdToolbar({ textareaRef, onChange }) {
  const wrap = (before, after = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || "texte";
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + selected.length);
    }, 0);
  };

  const insert = (text) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const next = value.slice(0, s) + text + value.slice(s);
    onChange(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + text.length, s + text.length); }, 0);
  };

  const tools = [
    { label: "B",  title: "Gras",        action: () => wrap("**") },
    { label: "I",  title: "Italique",     action: () => wrap("_") },
    { label: "H1", title: "Titre 1",      action: () => insert("\n# ") },
    { label: "H2", title: "Titre 2",      action: () => insert("\n## ") },
    { label: "\"", title: "Citation",     action: () => insert("\n> ") },
    { label: "—",  title: "Séparateur",   action: () => insert("\n---\n") },
    { label: "• ", title: "Liste",        action: () => insert("\n- ") },
  ];

  return (
    <div style={{
      display: "flex", gap: 2, padding: "6px 8px",
      borderBottom: "1px solid var(--border, #e0e0e0)",
      background: "var(--bg2, #f9f9f9)",
      borderRadius: "8px 8px 0 0",
    }}>
      {tools.map(t => (
        <button
          key={t.label}
          title={t.title}
          onClick={t.action}
          type="button"
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 4,
            fontSize: 12, fontWeight: 700,
            color: "var(--text2, #666)",
            fontFamily: t.label === "B" || t.label === "I" ? "serif" : "inherit",
            fontStyle: t.label === "I" ? "italic" : "normal",
          }}
          onMouseEnter={e => e.target.style.background = "var(--border, #eee)"}
          onMouseLeave={e => e.target.style.background = "none"}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Éditeur ───────────────────────────────────────────────────────────────────
function PostEditor({ post, onSave, onCancel }) {
  const [form, setForm] = useState({
    title:     post?.title     || "",
    excerpt:   post?.excerpt   || "",
    content:   post?.content   || "",
    cover:     post?.cover     || "",
    tags:      post?.tags?.join(", ") || "",
    published: post?.published ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const textareaRef = useRef();

  const set = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: "" }));
  };

  const tagPills = form.tags
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

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
        tags:    tagPills,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
          {post ? "Modifier l'article" : "Nouvel article"}
        </h2>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>Annuler</button>
      </div>

      {/* Cover hero drag-and-drop */}
      <CoverDropzone url={form.cover} onChange={(v) => set("cover", v)} />

      {/* Titre */}
      <div style={{ marginBottom: 12 }}>
        <input
          className={`form-input${errors.title ? " error" : ""}`}
          placeholder="Titre de l'article *"
          value={form.title}
          onChange={e => set("title", e.target.value)}
          style={{ fontSize: 17, fontWeight: 700 }}
        />
        {errors.title && <p className="field-error">{errors.title}</p>}
      </div>

      {/* Extrait */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          className="form-input"
          rows={2}
          placeholder="Extrait — résumé affiché sur la liste d'articles…"
          value={form.excerpt}
          onChange={e => set("excerpt", e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {/* Contenu avec toolbar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          border: `1px solid ${errors.content ? "var(--danger)" : "var(--border, #e0e0e0)"}`,
          borderRadius: 8, overflow: "hidden",
        }}>
          <MdToolbar
            textareaRef={textareaRef}
            onChange={(v) => set("content", v)}
          />
          <textarea
            ref={textareaRef}
            rows={14}
            placeholder="Écris ton article ici. Markdown supporté."
            value={form.content}
            onChange={e => set("content", e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              border: "none", outline: "none",
              padding: "12px 14px",
              fontFamily: "monospace", fontSize: 13, lineHeight: 1.75,
              resize: "vertical",
              background: "var(--bg, #fff)",
              color: "var(--text, #1E0900)",
            }}
          />
        </div>
        {errors.content && <p className="field-error">{errors.content}</p>}
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 12 }}>
        <input
          className="form-input"
          placeholder="Tags séparés par des virgules : bogolan, culture, mali"
          value={form.tags}
          onChange={e => set("tags", e.target.value)}
        />
        {tagPills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {tagPills.map(t => (
              <span key={t} style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px",
                borderRadius: 20,
                background: "var(--bg2, #f0f0f0)",
                border: "1px solid var(--border, #ddd)",
                color: "var(--text2, #555)",
              }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Toggle publication */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px",
        background: form.published ? "var(--success-bg, #EDF7F1)" : "var(--bg2, #f5f5f5)",
        border: `1px solid ${form.published ? "var(--success, #52B37A)" : "var(--border, #ddd)"}`,
        borderRadius: 8, marginBottom: 20, transition: "all 0.2s",
      }}>
        <div
          onClick={() => setForm(f => ({ ...f, published: !f.published }))}
          style={{
            width: 40, height: 22, borderRadius: 11, cursor: "pointer",
            transition: "background 0.2s",
            background: form.published ? "var(--success, #52B37A)" : "var(--bg3, #ccc)",
            position: "relative", flexShrink: 0,
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 3,
            left: form.published ? 21 : 3,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {form.published ? "✅ Publié" : "⏸ Brouillon"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>
            {form.published
              ? "Visible sur le site vitrine en temps réel"
              : "Non visible — seul toi peux le voir"}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 140 }}
        >
          {saving ? "Enregistrement…" : post ? "Mettre à jour" : "Publier"}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

// ── Carte article ─────────────────────────────────────────────────────────────
function PostCard({ post, onEdit, onDelete, onTogglePublish }) {
  return (
    <div className="card" style={{ position: "relative", overflow: "hidden", padding: 0 }}>

      {/* Cover */}
      <div style={{
        height: 140, overflow: "hidden",
        background: "var(--bg2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {post.cover
          ? <img src={post.cover} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 32 }}>✍️</span>
        }
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <span className={`badge ${post.published ? "badge-success" : "badge-warn"}`}>
            {post.published ? "Publié" : "Brouillon"}
          </span>
          {post.tags?.map(t => (
            <span key={t} style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 10,
              background: "var(--bg3)", color: "var(--text2)", fontWeight: 600,
            }}>
              {t}
            </span>
          ))}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
          {post.title}
        </h3>

        {post.excerpt && (
          <p style={{
            fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {post.excerpt}
          </p>
        )}

        <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 12 }}>
          {fmtDate(post.createdAt)}
          {post.updatedAt && " · modifié"}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6 }}>
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
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function BlogPage() {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [filter,  setFilter]  = useState("all");
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const db = getDB();
    const q = query(collection(db, "blog_posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => { setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err)  => { console.error(err); setLoading(false); setError("Impossible de charger les articles."); }
    );
    return () => unsub();
  }, []);

  const handleSave = useCallback(async (formData) => {
    const db = getDB();
    if (editing === "new") {
      await addDoc(collection(db, "blog_posts"), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      showToast("Article créé ✓");
    } else {
      await updateDoc(fDoc(db, "blog_posts", editing.id), { ...formData, updatedAt: serverTimestamp() });
      showToast("Article mis à jour ✓");
    }
    setEditing(null);
  }, [editing]);

  const handleDelete = useCallback(async (post) => {
    if (!window.confirm(`Supprimer "${post.title}" ?`)) return;
    await deleteDoc(fDoc(getDB(), "blog_posts", post.id));
    showToast("Article supprimé");
  }, []);

  const handleTogglePublish = useCallback(async (post) => {
    await updateDoc(fDoc(getDB(), "blog_posts", post.id), { published: !post.published, updatedAt: serverTimestamp() });
    showToast(post.published ? "Article dépublié" : "Article publié ✓");
  }, []);

  const published = posts.filter(p => p.published).length;
  const drafts    = posts.filter(p => !p.published).length;
  const filtered  = posts.filter(p =>
    filter === "published" ? p.published :
    filter === "draft"     ? !p.published : true
  );

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
          color: "#fff", padding: "10px 24px", borderRadius: 20,
          fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Articles du blog</h2>
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

      {/* États */}
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
          <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✍️</p>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Aucun article</p>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
            Crée ton premier article pour alimenter le blog du site vitrine.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>Créer un article</button>
        </div>
      )}

      {/* Grille */}
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
