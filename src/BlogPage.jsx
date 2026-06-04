import { useState, useCallback } from "react";
import Icon from "./Icon.jsx";

const CATS = ["CULTURE", "TEXTILE", "HISTOIRE", "ART", "MODE", "LIFESTYLE"];

const EMPTY = {
  id: "", title: "", tag: "CULTURE", date: "", read: "3 min de lecture",
  img: "", excerpt: "", content: "",
};

function uid() {
  return "B" + Date.now().toString(36).toUpperCase();
}

// ── Formulaire article ────────────────────────────────────────────────────────
function ArticleForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [err,  setErr]  = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim())   e.title   = "Titre requis";
    if (!form.excerpt.trim()) e.excerpt  = "Résumé requis";
    if (!form.content.trim()) e.content  = "Contenu requis";
    if (!form.date.trim())    e.date     = "Date requise";
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ ...form, id: form.id || uid() });
  };

  const inp = {
    background: "var(--bg3)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "10px 12px", color: "var(--text1)",
    fontSize: 14, width: "100%", fontFamily: "inherit",
  };
  const lbl = { fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4, display: "block" };
  const errStyle = { fontSize: 11, color: "var(--warn)", marginTop: 3 };
  const fieldWrap = { marginBottom: 16 };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Icon name="arrow_up" size={14} style={{ transform: "rotate(-90deg)" }} /> Retour
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text1)" }}>
          {form.id ? "Modifier l'article" : "Nouvel article"}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Titre */}
        <div style={{ ...fieldWrap, gridColumn: "1/-1" }}>
          <label style={lbl}>Titre *</label>
          <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="ex: Le Bogolan, un art ancestral" />
          {err.title && <div style={errStyle}>{err.title}</div>}
        </div>

        {/* Catégorie */}
        <div style={fieldWrap}>
          <label style={lbl}>Catégorie</label>
          <select style={inp} value={form.tag} onChange={e => set("tag", e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Date */}
        <div style={fieldWrap}>
          <label style={lbl}>Date *</label>
          <input style={inp} value={form.date} onChange={e => set("date", e.target.value)} placeholder="ex: Juin 2026" />
          {err.date && <div style={errStyle}>{err.date}</div>}
        </div>

        {/* Temps de lecture */}
        <div style={fieldWrap}>
          <label style={lbl}>Temps de lecture</label>
          <input style={inp} value={form.read} onChange={e => set("read", e.target.value)} placeholder="ex: 5 min de lecture" />
        </div>

        {/* Image URL */}
        <div style={fieldWrap}>
          <label style={lbl}>URL image (Cloudinary)</label>
          <input style={inp} value={form.img} onChange={e => set("img", e.target.value)} placeholder="https://res.cloudinary.com/..." />
        </div>

        {/* Aperçu image */}
        {form.img && (
          <div style={{ gridColumn: "1/-1", marginBottom: 16 }}>
            <label style={lbl}>Aperçu image</label>
            <img
              src={form.img} alt="aperçu"
              onError={e => { e.target.style.display = "none"; }}
              style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
            />
          </div>
        )}

        {/* Résumé */}
        <div style={{ ...fieldWrap, gridColumn: "1/-1" }}>
          <label style={lbl}>Résumé * <span style={{ fontWeight: 400, color: "var(--text2)" }}>(affiché sur la liste)</span></label>
          <textarea
            style={{ ...inp, resize: "vertical", minHeight: 80 }}
            value={form.excerpt}
            onChange={e => set("excerpt", e.target.value)}
            placeholder="Courte description de l'article (2-3 phrases)…"
          />
          {err.excerpt && <div style={errStyle}>{err.excerpt}</div>}
        </div>

        {/* Contenu */}
        <div style={{ ...fieldWrap, gridColumn: "1/-1" }}>
          <label style={lbl}>Contenu complet * <span style={{ fontWeight: 400, color: "var(--text2)" }}>(corps de l'article)</span></label>
          <textarea
            style={{ ...inp, resize: "vertical", minHeight: 220, lineHeight: 1.7 }}
            value={form.content}
            onChange={e => set("content", e.target.value)}
            placeholder="Rédigez votre article ici…"
          />
          {err.content && <div style={errStyle}>{err.content}</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={onCancel}
          style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text1)", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "var(--accent2)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}
        >
          {form.id ? "Enregistrer" : "Publier l'article"}
        </button>
      </div>
    </div>
  );
}

// ── Carte article ─────────────────────────────────────────────────────────────
function ArticleCard({ article, onEdit, onDelete }) {
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12,
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {article.img && (
        <img
          src={article.img} alt={article.title}
          onError={e => { e.target.style.display = "none"; }}
          style={{ width: "100%", height: 160, objectFit: "cover" }}
        />
      )}
      {!article.img && (
        <div style={{ width: "100%", height: 100, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="image" size={32} style={{ color: "var(--text2)", opacity: 0.4 }} />
        </div>
      )}
      <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent2)", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>
            {article.tag}
          </span>
          <span style={{ fontSize: 11, color: "var(--text2)" }}>{article.date}</span>
          <span style={{ fontSize: 11, color: "var(--text2)" }}>· {article.read}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", lineHeight: 1.4 }}>{article.title}</div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, flex: 1 }}>
          {article.excerpt?.slice(0, 120)}{article.excerpt?.length > 120 ? "…" : ""}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => onEdit(article)}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text1)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Icon name="edit" size={13} /> Modifier
          </button>
          <button
            onClick={() => onDelete(article.id)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--warn)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale Blog ──────────────────────────────────────────────────────
export default function BlogPage({ data, onPersist }) {
  const [view,    setView]    = useState("list"); // "list" | "form"
  const [editing, setEditing] = useState(null);

  const articles = data?.settings?.blog || [];

  const saveArticle = useCallback((article) => {
    const existing = articles.find(a => a.id === article.id);
    const updated = existing
      ? articles.map(a => a.id === article.id ? article : a)
      : [...articles, article];

    onPersist({
      ...data,
      settings: { ...data.settings, blog: updated },
    });
    setView("list");
    setEditing(null);
  }, [articles, data, onPersist]);

  const deleteArticle = useCallback((id) => {
    if (!window.confirm("Supprimer cet article ? Cette action est irréversible.")) return;
    onPersist({
      ...data,
      settings: { ...data.settings, blog: articles.filter(a => a.id !== id) },
    });
  }, [articles, data, onPersist]);

  const handleEdit = (article) => {
    setEditing(article);
    setView("form");
  };

  const handleNew = () => {
    setEditing(null);
    setView("form");
  };

  // ── Vue formulaire ──────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div style={{ padding: 24 }}>
        <ArticleForm
          initial={editing || {}}
          onSave={saveArticle}
          onCancel={() => { setView("list"); setEditing(null); }}
        />
      </div>
    );
  }

  // ── Vue liste ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text1)", marginBottom: 4 }}>Articles du Blog</h2>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            {articles.length} article{articles.length !== 1 ? "s" : ""} · Les modifications s'affichent sur le site client en temps réel
          </p>
        </div>
        <button
          onClick={handleNew}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent2)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}
        >
          <Icon name="plus" size={15} /> Nouvel article
        </button>
      </div>

      {/* Liste vide */}
      {articles.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✍️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text1)" }}>Aucun article pour l'instant</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Créez votre premier article pour qu'il apparaisse sur le site.</div>
          <button
            onClick={handleNew}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "var(--accent2)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}
          >
            Créer un article
          </button>
        </div>
      )}

      {/* Grille articles */}
      {articles.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {articles.map(a => (
            <ArticleCard key={a.id} article={a} onEdit={handleEdit} onDelete={deleteArticle} />
          ))}
        </div>
      )}
    </div>
  );
}
