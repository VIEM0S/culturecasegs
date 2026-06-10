import { useState, useEffect, useCallback, useMemo } from "react";
import { getDB } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, onSnapshot,
  doc as fDoc,
} from "firebase/firestore";

// ── Parser Markdown minimal ───────────────────────────────────────────────────
// Pas de dépendance externe — couvre les cas réels d'un blog culturel
function parseMarkdown(md) {
  if (!md) return "";
  let html = md
    // Titres
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm,  "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,   "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,    "<h1>$1</h1>")
    // Gras + italique
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,         "<em>$1</em>")
    // Citation
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Séparateur
    .replace(/^---$/gm, "<hr>")
    // Listes non ordonnées
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
    // Liens
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Images
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0">')
    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>");

  // Envelopper les <li> consécutifs dans <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Paragraphes — lignes sans balise HTML
  html = html
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^<(h[1-4]|ul|ol|li|blockquote|hr|img|p)/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ── Styles de la preview Markdown ────────────────────────────────────────────
const PREVIEW_STYLES = `
  .md-preview { font-family: Georgia, serif; font-size: 15px; line-height: 1.85; color: #1E0900; }
  .md-preview h1 { font-size: 26px; font-weight: 800; margin: 0 0 16px; line-height: 1.2; }
  .md-preview h2 { font-size: 20px; font-weight: 700; margin: 28px 0 12px; border-bottom: 2px solid #E8A020; padding-bottom: 6px; }
  .md-preview h3 { font-size: 17px; font-weight: 700; margin: 22px 0 8px; color: #D94E15; }
  .md-preview h4 { font-size: 15px; font-weight: 700; margin: 16px 0 6px; }
  .md-preview p  { margin: 0 0 14px; }
  .md-preview ul { padding-left: 20px; margin: 0 0 14px; }
  .md-preview li { margin-bottom: 6px; }
  .md-preview blockquote { border-left: 4px solid #E8A020; margin: 16px 0; padding: 10px 16px; background: #FFF8E6; border-radius: 0 8px 8px 0; font-style: italic; color: #555; }
  .md-preview hr { border: none; border-top: 2px solid #EEE; margin: 24px 0; }
  .md-preview code { background: #F5F0E8; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
  .md-preview a { color: #D94E15; text-decoration: underline; }
  .md-preview strong { font-weight: 700; }
  .md-preview em { font-style: italic; }
`;

// ── Toolbar boutons Markdown ──────────────────────────────────────────────────
function insertMarkdown(textarea, before, after = "", placeholder = "texte") {
  const el = document.getElementById(textarea);
  if (!el) return;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const sel   = el.value.substring(start, end) || placeholder;
  const newVal = el.value.substring(0, start) + before + sel + after + el.value.substring(end);
  el.value = newVal;
  el.focus();
  el.selectionStart = start + before.length;
  el.selectionEnd   = start + before.length + sel.length;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function Toolbar({ textareaId }) {
  const tools = [
    { label: "H2",   title: "Titre",          action: () => insertMarkdown(textareaId, "## ", "", "Titre de section") },
    { label: "H3",   title: "Sous-titre",      action: () => insertMarkdown(textareaId, "### ", "", "Sous-titre") },
    { label: "B",    title: "Gras",            action: () => insertMarkdown(textareaId, "**", "**", "texte en gras"), style: { fontWeight: 800 } },
    { label: "I",    title: "Italique",        action: () => insertMarkdown(textareaId, "*", "*", "texte en italique"), style: { fontStyle: "italic" } },
    { label: "❝",   title: "Citation",        action: () => insertMarkdown(textareaId, "\n> ", "", "citation ou proverbe") },
    { label: "—",    title: "Séparateur",      action: () => insertMarkdown(textareaId, "\n---\n", "", "") },
    { label: "• ",   title: "Liste",           action: () => insertMarkdown(textareaId, "\n- ", "", "élément") },
    { label: "🔗",   title: "Lien",            action: () => insertMarkdown(textareaId, "[", "](https://)", "texte du lien") },
    { label: "🖼",    title: "Image (URL)",     action: () => insertMarkdown(textareaId, "![", "](https://)", "description") },
  ];

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 4,
      padding: "6px 8px",
      background: "var(--bg2)", borderBottom: "1px solid var(--border)",
      borderRadius: "8px 8px 0 0",
    }}>
      {tools.map(t => (
        <button
          key={t.label}
          type="button"
          title={t.title}
          onClick={t.action}
          style={{
            padding: "4px 9px", borderRadius: 5, border: "1px solid var(--border)",
            background: "var(--bg)", cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "var(--text1)",
            lineHeight: 1.4,
            ...t.style,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Éditeur de post ───────────────────────────────────────────────────────────
function PostEditor({ post, onSave, onCancel }) {
  const [form, setForm] = useState({
    title:     post?.title     || "",
    excerpt:   post?.excerpt   || "",
    content:   post?.content   || "",
    cover:     post?.cover     || "",
    tags:      post?.tags?.join(", ") || "",
    published: post?.published ?? false,
  });
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState({});
  const [preview,  setPreview]  = useState(false); // mobile : toggle write/preview

  const previewHtml = useMemo(() => parseMarkdown(form.content), [form.content]);

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

  const field = (name) => ({
    value: form[name],
    onChange: (e) => {
      setForm(f => ({ ...f, [name]: e.target.value }));
      setErrors(er => ({ ...er, [name]: "" }));
    },
  });

  return (
    <>
      {/* Injection styles preview */}
      <style>{PREVIEW_STYLES}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {post ? "Modifier l'article" : "Nouvel article"}
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={onCancel}>Annuler</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
              style={{ minWidth: 110 }}
            >
              {saving ? "Enregistrement…" : post ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Métadonnées — rangée du haut */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Titre */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Titre *</label>
              <input
                className={`form-input${errors.title ? " error" : ""}`}
                placeholder="Titre de l'article"
                style={{ fontSize: 16, fontWeight: 600 }}
                {...field("title")}
              />
              {errors.title && <p className="field-error">{errors.title}</p>}
            </div>

            {/* Extrait */}
            <div>
              <label className="form-label">
                Extrait <span style={{ color: "var(--text2)", fontWeight: 400 }}>(affiché sur la liste)</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Résumé court — 1 ou 2 phrases…"
                {...field("excerpt")}
                style={{ resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
              />
            </div>

            {/* Tags + Statut */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">
                  Tags <span style={{ color: "var(--text2)", fontWeight: 400 }}>(séparés par des virgules)</span>
                </label>
                <input className="form-input" placeholder="bogolan, culture, mali" {...field("tags")} />
              </div>

              {/* Toggle publié */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <div
                  onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                  style={{
                    width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                    transition: "background 0.2s",
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
                  {form.published ? "✅ Publié — visible sur le site" : "⏸ Brouillon — non visible"}
                </span>
              </div>
            </div>

            {/* Image de couverture */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">
                Image de couverture <span style={{ color: "var(--text2)", fontWeight: 400 }}>(URL Cloudinary)</span>
              </label>
              <input className="form-input" placeholder="https://res.cloudinary.com/…" {...field("cover")} />
              {form.cover && (
                <img
                  src={form.cover} alt="couverture"
                  style={{ marginTop: 8, width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Éditeur split-view */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>

          {/* Header de l'éditeur */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderBottom: "1px solid var(--border)",
            background: "var(--bg2)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: 1, textTransform: "uppercase" }}>
              Contenu
            </span>
            {/* Toggle mobile write/preview */}
            <div style={{ display: "flex", gap: 4 }} className="editor-mobile-toggle">
              {["Écrire", "Aperçu"].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setPreview(i === 1)}
                  style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: "1px solid var(--border)", cursor: "pointer",
                    background: preview === (i === 1) ? "var(--accent2)" : "var(--bg)",
                    color:      preview === (i === 1) ? "#fff" : "var(--text2)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Split */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 480 }}
               className="editor-split">

            {/* Colonne gauche — écriture */}
            <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}
                 className={preview ? "editor-col-hidden" : ""}>
              <Toolbar textareaId="blog-content-editor" />
              <textarea
                id="blog-content-editor"
                className={`form-input${errors.content ? " error" : ""}`}
                placeholder={`Écris l'article ici en Markdown.\n\n# Grand titre\n## Section\nTexte normal\n**gras** *italique*\n> citation ou proverbe malien`}
                {...field("content")}
                style={{
                  flex: 1, resize: "none",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  fontSize: 13, lineHeight: 1.75,
                  padding: 16,
                  border: "none", borderRadius: 0, outline: "none",
                  background: "var(--bg)",
                  color: "var(--text1)",
                  minHeight: 440,
                }}
              />
              {errors.content && <p className="field-error" style={{ padding: "4px 12px" }}>{errors.content}</p>}
            </div>

            {/* Colonne droite — aperçu */}
            <div
              className={`md-preview ${!preview ? "editor-col-preview-desktop" : ""}`}
              style={{
                padding: 24,
                overflowY: "auto",
                background: "#FDFAF5", // teinte chaude proche du site vitrine
                minHeight: 480,
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="color:#BBB;font-style:italic">L\'aperçu apparaît ici au fil de l\'écriture…</p>' }}
            />
          </div>
        </div>

        {/* Aide Markdown */}
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: "var(--text2)", cursor: "pointer", userSelect: "none" }}>
            Aide Markdown
          </summary>
          <div style={{
            marginTop: 8, padding: "10px 14px",
            background: "var(--bg2)", borderRadius: 8,
            fontSize: 12, color: "var(--text2)", lineHeight: 2,
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 24px",
          }}>
            {[
              ["# Titre",       "Grand titre"],
              ["## Section",    "Titre de section"],
              ["**gras**",      "Texte en gras"],
              ["*italique*",    "Texte en italique"],
              ["> texte",       "Citation"],
              ["- élément",     "Liste"],
              ["---",           "Séparateur"],
              ["[lien](url)",   "Lien cliquable"],
              ["![alt](url)",   "Image"],
              ["`code`",        "Code inline"],
            ].map(([syntax, desc]) => (
              <div key={syntax}>
                <code style={{ background: "var(--bg3)", padding: "1px 5px", borderRadius: 3 }}>{syntax}</code>
                {" → "}{desc}
              </div>
            ))}
          </div>
        </details>

        {/* CSS responsive split-view */}
        <style>{`
          @media (max-width: 700px) {
            .editor-split { grid-template-columns: 1fr !important; }
            .editor-col-preview-desktop { display: none; }
            .editor-col-hidden { display: none; }
            .editor-mobile-toggle { display: flex !important; }
          }
          @media (min-width: 701px) {
            .editor-mobile-toggle { display: none !important; }
            .editor-col-hidden { display: flex !important; flex-direction: column; }
          }
        `}</style>

      </div>
    </>
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
              <span key={t} style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 10,
                background: "var(--bg3)", color: "var(--text2)", fontWeight: 600,
              }}>
                {t}
              </span>
            ))}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{post.title}</h3>
          {post.excerpt && (
            <p style={{
              fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
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
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [editing, setEditing] = useState(null);  // null | "new" | post
  const [filter,  setFilter]  = useState("all"); // "all" | "published" | "draft"
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const db = getDB();
    const q = query(collection(db, "blog_posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => { setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); setError(null); },
      (err)  => { console.error("Blog Firestore error:", err); setLoading(false); setError("Impossible de charger les articles. Vérifie ta connexion ou les règles Firestore."); }
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

  const filtered  = posts.filter(p => filter === "published" ? p.published : filter === "draft" ? !p.published : true);
  const published = posts.filter(p => p.published).length;
  const drafts    = posts.filter(p => !p.published).length;

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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Articles du blog</h2>
          <p style={{ fontSize: 12, color: "var(--text2)" }}>
            {published} publié(s) · {drafts} brouillon(s) · synchronisé avec le site vitrine
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Nouvel article</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[
          { id: "all",       label: `Tous (${posts.length})` },
          { id: "published", label: `Publiés (${published})` },
          { id: "draft",     label: `Brouillons (${drafts})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`btn btn-sm ${filter === f.id ? "btn-primary" : "btn-outline"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Chargement…</div>}

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(post => (
          <PostCard key={post.id} post={post} onEdit={setEditing} onDelete={handleDelete} onTogglePublish={handleTogglePublish} />
        ))}
      </div>
    </div>
  );
}
