import { useState, useMemo, useCallback, memo } from "react";
import Icon from "./Icon.jsx";
import { Modal, StatCard, FieldError, DesignThumb } from "./components.jsx";
import { uid, sanitize, getProductImageUrl, today, toDateStr, fmtMoney, fmtDate, fmtDateTime } from "./utils.js";
import { LOW_STOCK } from "./constants.js";

// ─── TICKET DE CAISSE ───────────────────────────────────────────────────────
function TicketModal({ sales, productMap, onClose }) {
  const [imgLoading, setImgLoading] = useState(false);
  const date     = sales[0]?.date   || today();
  const client   = sales[0]?.client || "";
  const phone    = sales[0]?.phone  || "";
  const quartier = sales[0]?.quartier || "";
  const delivery = sales[0]?.delivery || false;
  const remarque = sales[0]?.remarque || "";

  const grandTotal = sales.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0);
  const totalDiscount = sales.reduce((s, v) => s + (v.discountAmount || 0), 0);
  const totalBrut = sales.reduce((s, v) => s + v.total, 0);

  // ── Texte WhatsApp ──────────────────────────────────────────────────────
  const whatsappText = () => {
    const lines = [
      `🧾 *CULTURECASE — Ticket de caisse*`,
      `📅 Date : ${fmtDate(date)}`,
      ``,
      `*Produit(s) :*`,
      ...sales.map(s => {
        const p = productMap[s.productId];
        const nom = p ? `${p.model} — ${p.design}` : "—";
        const remise = s.discountPercent > 0 ? ` _(remise ${s.discountPercent}%)_` : "";
        const motif  = s.discountPercent > 0 && s.discountReason ? ` — _Motif : ${s.discountReason}_` : "";
        return `• ${nom} × ${s.qty} → *${fmtMoney(s.totalAfterDiscount ?? s.total)}*${remise}${motif}`;
      }),
      ``,
      totalDiscount > 0 ? `💸 Remise totale : -${fmtMoney(totalDiscount)}` : null,
      `✅ *Total payé : ${fmtMoney(grandTotal)}*`,
      ``,
      client   ? `👤 Client : ${client}`                  : null,
      phone    ? `📞 Tél : ${phone}`                      : null,
      quartier ? `📍 Quartier : ${quartier}`              : null,
      delivery ? `🚚 *Livraison à domicile*`              : null,
      remarque ? `📝 Remarque : ${remarque}`              : null,
      ``,
      `_Merci pour votre achat ! 🙏_`,
    ].filter(l => l !== null).join("\n");

    const encoded = encodeURIComponent(lines);
    const url = phone
      ? `https://wa.me/${phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // ── Impression ──────────────────────────────────────────────────────────
  const printTicket = () => {
    const printWin = window.open("", "_blank", "width=400,height=600");
    printWin.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Ticket — Culturecase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 20px 16px;
      max-width: 300px;
      margin: 0 auto;
    }
    .center  { text-align: center; }
    .bold    { font-weight: 700; }
    .sep     { border: none; border-top: 1px dashed #888; margin: 10px 0; }
    .row     { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .label   { color: #555; }
    .total   { font-size: 16px; font-weight: 700; }
    .success { color: #059669; }
    .small   { font-size: 11px; color: #777; }
    h1       { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    h1 span  { color: #7c3aed; }
    .badge   { display: inline-block; background: #f3f0ff; color: #7c3aed; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom: 14px;">
    <img src="data:image/png;base64,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zLU+7deZRofunmQXYykxZHyu2vDyZi0CZufVRpEuxboDe4A3ddn+TQrt6h4f3YvzbFYTYF8vXfN237axdK4tvt+tvs80j+SOinjHt6oJni2l8tjoZXt7af+v+377y9b9+e7BtWRVPaxUNzaLyD7gbqxuPIQZ7vfXnVLZT4Nv5ECkwFrKDKau78Ac+/YCbfeDWYzf0v4RTFvevoWism3wylfep8XSkdmDOo4PI/0m4M1Y92LaB0VGQaTWfjP27h/BJjApl01nubVK2xa9rDeU9inXmdh+mG9TltaLRazB3IPVvVPpbvifalJgLSVatkOwEItulEdqurWCZc/lsi9Vr306PZ0jMPo3MHeLNNKOhrAdHg38hpdB5/exXLlFwHMvm3D46d3MUk/1bpyPzXaUmlYHKbAOJOIBX4tF+y/pOrt/DPTOO7SkgnWq913U/fK2Oe9CngFchxlss8KODsHe+XWqeoaXxVzH9m5/A8vHBPq5RESuxTT3OQ/zKh8bGSZeSw60dCUFVndavryrFOs173atM3BPdxHZo+aRPId5LocDadB2z+UFF3pzJW/4YNGPm8ecDzcAF1BU2BRYoyMaIcWcgjfgTqBeRp3lNktR7lG2Zc1rtlQ3NrgH+/OwbmNDVc90QTUPbPS69i6K+pd0kAKrO9GynaaqZwObPAmcAm/17RtV9UoPyYlEamHniNZyi6o+RlUP9/32qOpWigBagO1+/F7vhpwEnE22sOMiBNbZwEliSRL3etluL+233UN29nj57VHVQzEbJgAi8rNS3dinqo8G3oQJqBksL5d63dqrNpnxaaX7SDpIP6z++A7wfmwWnlf7uogFfL9vj2Dqi7HEauHTFb/vAb6HheUcTTGS+HPgLdhH8mzMdrVIerSPm4gA+VPgb7DyvpKisRFM+OwuHfNOPJUvHr5DEVs4g2lP8yz1u/ooNrK8CbjK16XdsgcpsJYn3k2vypPe58mwSWG1DCmw+iO8oLt5HXcmT+uVlyr268xdFEn46HH+ZLxE7iw4sOy6xZEut72be0q5/qT7ygqkwEqSpDZkdyZJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJ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" alt="logo" style="width:54px;height:auto;display:block;margin:0 auto 8px;filter:brightness(0);opacity:0.8"/>
    <h1>Culture<span>case</span></h1>
    <p class="small">Ticket de caisse</p>
  </div>

  <hr class="sep" />

  <div class="row"><span class="label">Date</span><span>${fmtDate(date)}</span></div>
  ${client   ? `<div class="row"><span class="label">Client</span><span>${client}</span></div>` : ""}
  ${phone    ? `<div class="row"><span class="label">Tél</span><span>${phone}</span></div>` : ""}
  ${quartier ? `<div class="row"><span class="label">Quartier</span><span>${quartier}</span></div>` : ""}
  ${delivery ? `<div class="row"><span class="label">Livraison</span><span class="badge">À domicile</span></div>` : ""}
  ${remarque ? `<div class="row"><span class="label">Remarque</span><span style="font-style:italic;color:#555;">${remarque}</span></div>` : ""}

  <hr class="sep" />

  <p class="bold" style="margin-bottom: 8px;">Produit(s)</p>
  ${sales.map(s => {
    const p = productMap[s.productId];
    const nom = p ? `${p.model} — ${p.design}` : "—";
    const remise = s.discountPercent > 0
      ? `<div class="row small"><span>Remise ${s.discountPercent}%</span><span>-${fmtMoney(s.discountAmount || 0)}</span></div>` : "";
    const motif = s.discountPercent > 0 && s.discountReason
      ? `<div class="row small" style="font-style:italic;color:#888;"><span>Motif</span><span>${s.discountReason}</span></div>` : "";
    return `
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dotted #ddd;">
        <div class="bold">${nom}</div>
        <div class="row small" style="margin-top: 4px;">
          <span>${s.qty} × ${fmtMoney(s.price)}</span>
          <span>${fmtMoney(s.total)}</span>
        </div>
        ${remise}
        ${motif}
        <div class="row bold" style="margin-top: 2px;">
          <span>Sous-total</span>
          <span class="success">${fmtMoney(s.totalAfterDiscount ?? s.total)}</span>
        </div>
      </div>`;
  }).join("")}

  <hr class="sep" />

  ${totalDiscount > 0 ? `<div class="row"><span class="label">Remise totale</span><span>-${fmtMoney(totalDiscount)}</span></div>` : ""}
  <div class="row total">
    <span>TOTAL PAYÉ</span>
    <span class="success">${fmtMoney(grandTotal)}</span>
  </div>

  <hr class="sep" />

  <div class="center small" style="margin-top: 12px; line-height: 1.8;">
    Merci pour votre achat ! 🙏<br/>
    <span style="color: #7c3aed; font-weight: 700;">Culturecase</span>
  </div>
</body>
</html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
  };


  // ── Partage image WhatsApp ──────────────────────────────────────────────
  // On génère dynamiquement un canvas HTML du ticket puis on l'ouvre
  // dans un nouvel onglet → l'utilisateur fait "Enregistrer" et envoie sur WA.
  const shareAsImage = async () => {
    setImgLoading(true);
    try {
      // Charger html2canvas depuis CDN (pas de dépendance npm nécessaire)
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      // Générer le HTML du ticket dans un div temporaire hors écran
      const wrap = document.createElement("div");
      wrap.style.cssText = [
        "position:fixed", "left:-9999px", "top:0",
        "width:360px", "background:#fff",
        "font-family:'Courier New',monospace",
        "font-size:13px", "color:#111",
        "padding:24px 20px", "line-height:1.6",
      ].join(";");

      const rows = (label, val) => val
        ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
             <span style="color:#666">${label}</span><span>${val}</span>
           </div>` : "";

      const sep = `<hr style="border:none;border-top:1px dashed #aaa;margin:12px 0"/>`;

      wrap.innerHTML = `
        <div style="text-align:center;margin-bottom:14px">
          <img src="data:image/png;base64,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zLU+7deZRofunmQXYykxZHyu2vDyZi0CZufVRpEuxboDe4A3ddn+TQrt6h4f3YvzbFYTYF8vXfN237axdK4tvt+tvs80j+SOinjHt6oJni2l8tjoZXt7af+v+377y9b9+e7BtWRVPaxUNzaLyD7gbqxuPIQZ7vfXnVLZT4Nv5ECkwFrKDKau78Ac+/YCbfeDWYzf0v4RTFvevoWism3wylfep8XSkdmDOo4PI/0m4M1Y92LaB0VGQaTWfjP27h/BJjApl01nubVK2xa9rDeU9inXmdh+mG9TltaLRazB3IPVvVPpbvifalJgLSVatkOwEItulEdqurWCZc/lsi9Vr306PZ0jMPo3MHeLNNKOhrAdHg38hpdB5/exXLlFwHMvm3D46d3MUk/1bpyPzXaUmlYHKbAOJOIBX4tF+y/pOrt/DPTOO7SkgnWq913U/fK2Oe9CngFchxlss8KODsHe+XWqeoaXxVzH9m5/A8vHBPq5RESuxTT3OQ/zKh8bGSZeSw60dCUFVndavryrFOs173atM3BPdxHZo+aRPId5LocDadB2z+UFF3pzJW/4YNGPm8ecDzcAF1BU2BRYoyMaIcWcgjfgTqBeRp3lNktR7lG2Zc1rtlQ3NrgH+/OwbmNDVc90QTUPbPS69i6K+pd0kAKrO9GynaaqZwObPAmcAm/17RtV9UoPyYlEamHniNZyi6o+RlUP9/32qOpWigBagO1+/F7vhpwEnE22sOMiBNbZwEliSRL3etluL+233UN29nj57VHVQzEbJgAi8rNS3dinqo8G3oQJqBksL5d63dqrNpnxaaX7SDpIP6z++A7wfmwWnlf7uogFfL9vj2Dqi7HEauHTFb/vAb6HheUcTTGS+HPgLdhH8mzMdrVIerSPm4gA+VPgb7DyvpKisRFM+OwuHfNOPJUvHr5DEVs4g2lP8yz1u/ooNrK8CbjK16XdsgcpsJYn3k2vypPe58mwSWG1DCmw+iO8oLt5HXcmT+uVlyr268xdFEn46HH+ZLxE7iw4sOy6xZEut72be0q5/qT7ygqkwEqSpDZkdyZJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJ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" alt="logo" style="width:60px;height:auto;filter:brightness(0);opacity:0.75;margin-bottom:8px"/>
          <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px">
            Culture<span style="color:#7c3aed">case</span>
          </div>
        </div>
        ${sep}
        ${rows("Date", fmtDate(date))}
        ${rows("Client", client)}
        ${rows("Tél", phone)}
        ${rows("Quartier", quartier)}
        ${delivery ? rows("Livraison", "🚚 À domicile") : ""}
        ${remarque ? rows("Remarque", `<em>${remarque}</em>`) : ""}
        ${sep}
        <div style="font-weight:700;margin-bottom:8px">Produit(s)</div>
        ${sales.map(s => {
          const p = productMap[s.productId];
          const nom = p ? `${p.model} — ${p.design}` : "—";
          const remise = s.discountPercent > 0
            ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#888">
                 <span>Remise ${s.discountPercent}%</span>
                 <span>-${fmtMoney(s.discountAmount || 0)}</span>
               </div>` : "";
          const motif = s.discountPercent > 0 && s.discountReason
            ? `<div style="font-size:11px;color:#aaa;font-style:italic">Motif : ${s.discountReason}</div>` : "";
          return `
            <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dotted #eee">
              <div style="font-weight:700">${nom}</div>
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:3px">
                <span>${s.qty} × ${fmtMoney(s.price)}</span>
                <span>${fmtMoney(s.total)}</span>
              </div>
              ${remise}${motif}
              <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:3px">
                <span>Sous-total</span>
                <span style="color:#059669">${fmtMoney(s.totalAfterDiscount ?? s.total)}</span>
              </div>
            </div>`;
        }).join("")}
        ${sep}
        ${totalDiscount > 0
          ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px">
               <span style="color:#666">Remise totale</span>
               <span>-${fmtMoney(totalDiscount)}</span>
             </div>` : ""}
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:900">
          <span>TOTAL PAYÉ</span>
          <span style="color:#059669">${fmtMoney(grandTotal)}</span>
        </div>
        ${sep}
        <div style="text-align:center;font-size:12px;color:#888;margin-top:8px;line-height:1.8">
          Merci pour votre achat ! 🙏<br/>
          <span style="color:#7c3aed;font-weight:700">Culturecase</span>
        </div>
      `;

      document.body.appendChild(wrap);

      const canvas = await window.html2canvas(wrap, {
        scale: 2, // haute résolution pour mobile
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(wrap);

      // ── Partage natif iOS/Android (Web Share API) ──────────────────────────
      // Sur iPhone/Android : ouvre le menu de partage natif avec WhatsApp dedans
      // Sur desktop : télécharge l'image directement
      const imgUrl = canvas.toDataURL("image/png");

      // Convertir le dataURL en Blob pour navigator.share
      const res  = await fetch(imgUrl);
      const blob = await res.blob();
      const file = new File([blob], `ticket-culturecase-${date?.slice(0,10) || "ticket"}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // ✅ Web Share API disponible (iPhone Safari, Android Chrome)
        await navigator.share({
          files: [file],
          title: "Ticket Culturecase",
          text: `Ticket du ${fmtDate(date)}${client ? " — " + client : ""}`,
        });
      } else {
        // 🖥️ Fallback desktop : téléchargement direct
        const a = document.createElement("a");
        a.href = imgUrl;
        a.download = `ticket-culturecase-${date?.slice(0,10) || "ticket"}.png`;
        a.click();
      }
    } catch (err) {
      console.error("Erreur génération image ticket:", err);
      alert("Impossible de générer l'image. Utilise le bouton WhatsApp texte à la place.");
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <Modal
      title="🧾 Ticket de caisse"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          <button
            onClick={shareAsImage}
            disabled={imgLoading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "linear-gradient(135deg, #25D366, #128C7E)",
              color: "#fff", border: "none", borderRadius: 12,
              padding: "8px 16px", fontSize: 13, fontWeight: 700,
              cursor: imgLoading ? "not-allowed" : "pointer",
              opacity: imgLoading ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(37,211,102,0.35)",
              marginTop: 0,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 20 }}>📲</span>
            {imgLoading ? "Génération de l'image…" : "Partager sur WhatsApp"}
          </button>
          <button className="btn btn-primary" onClick={printTicket}>
            <Icon name="download" size={13} /> Imprimer
          </button>
        </>
      }
    >
      {/* Aperçu du ticket dans la modale */}
      <div style={{
        background: "var(--bg3)", borderRadius: 10,
        padding: "18px 20px", fontFamily: "'Courier New', monospace",
        fontSize: 13, lineHeight: 1.7,
      }}>
        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <img
            src="data:image/png;base64,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zLU+7deZRofunmQXYykxZHyu2vDyZi0CZufVRpEuxboDe4A3ddn+TQrt6h4f3YvzbFYTYF8vXfN237axdK4tvt+tvs80j+SOinjHt6oJni2l8tjoZXt7af+v+377y9b9+e7BtWRVPaxUNzaLyD7gbqxuPIQZ7vfXnVLZT4Nv5ECkwFrKDKau78Ac+/YCbfeDWYzf0v4RTFvevoWism3wylfep8XSkdmDOo4PI/0m4M1Y92LaB0VGQaTWfjP27h/BJjApl01nubVK2xa9rDeU9inXmdh+mG9TltaLRazB3IPVvVPpbvifalJgLSVatkOwEItulEdqurWCZc/lsi9Vr306PZ0jMPo3MHeLNNKOhrAdHg38hpdB5/exXLlFwHMvm3D46d3MUk/1bpyPzXaUmlYHKbAOJOIBX4tF+y/pOrt/DPTOO7SkgnWq913U/fK2Oe9CngFchxlss8KODsHe+XWqeoaXxVzH9m5/A8vHBPq5RESuxTT3OQ/zKh8bGSZeSw60dCUFVndavryrFOs173atM3BPdxHZo+aRPId5LocDadB2z+UFF3pzJW/4YNGPm8ecDzcAF1BU2BRYoyMaIcWcgjfgTqBeRp3lNktR7lG2Zc1rtlQ3NrgH+/OwbmNDVc90QTUPbPS69i6K+pd0kAKrO9GynaaqZwObPAmcAm/17RtV9UoPyYlEamHniNZyi6o+RlUP9/32qOpWigBagO1+/F7vhpwEnE22sOMiBNbZwEliSRL3etluL+233UN29nj57VHVQzEbJgAi8rNS3dinqo8G3oQJqBksL5d63dqrNpnxaaX7SDpIP6z++A7wfmwWnlf7uogFfL9vj2Dqi7HEauHTFb/vAb6HheUcTTGS+HPgLdhH8mzMdrVIerSPm4gA+VPgb7DyvpKisRFM+OwuHfNOPJUvHr5DEVs4g2lP8yz1u/ooNrK8CbjK16XdsgcpsJYn3k2vypPe58mwSWG1DCmw+iO8oLt5HXcmT+uVlyr268xdFEn46HH+ZLxE7iw4sOy6xZEut72be0q5/qT7ygqkwEqSpDZkdyZJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJktqQAitJ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"
            alt="logo"
            style={{ width: 54, height: "auto", filter: "brightness(0)", opacity: 0.8, marginBottom: 6 }}
          />
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Culture<span style={{ color: "var(--accent2)" }}>case</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>Ticket de caisse</div>
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "10px 0" }} />

        {/* Infos vente */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          <Row label="Date"      value={fmtDate(date)} />
          {client   && <Row label="Client"    value={client} />}
          {phone    && <Row label="Tél"       value={phone} />}
          {quartier && <Row label="Quartier"  value={quartier} />}
          {delivery && <Row label="Livraison" value="🚚 À domicile" accent />}
          {remarque && <Row label="Remarque"  value={remarque} italic />}
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "10px 0" }} />

        {/* Lignes produits */}
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Produit(s)
        </div>
        {sales.map(s => {
          const p = productMap[s.productId];
          return (
            <div key={s.id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px dotted var(--border)" }}>
              <div style={{ fontWeight: 700 }}>{p ? `${p.model} — ${p.design}` : "—"}</div>
              <Row label={`${s.qty} × ${fmtMoney(s.price)}`} value={fmtMoney(s.total)} small />
              {s.discountPercent > 0 && (
                <Row label={`Remise ${s.discountPercent}%`} value={`-${fmtMoney(s.discountAmount || 0)}`} small warn />
              )}
              {s.discountPercent > 0 && s.discountReason && (
                <Row label="Motif" value={s.discountReason} small italic />
              )}
              <Row label="Sous-total" value={fmtMoney(s.totalAfterDiscount ?? s.total)} bold success />
            </div>
          );
        })}

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "10px 0" }} />

        {/* Totaux */}
        {totalDiscount > 0 && (
          <Row label="Remise totale" value={`-${fmtMoney(totalDiscount)}`} warn />
        )}
        <Row label="TOTAL PAYÉ" value={fmtMoney(grandTotal)} bold success large />

        <hr style={{ border: "none", borderTop: "1px dashed var(--border2)", margin: "12px 0 8px" }} />

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text2)" }}>
          Merci pour votre achat ! 🙏
        </div>
      </div>
    </Modal>
  );
}

// ── Ligne de ticket ──────────────────────────────────────────────────────────
function Row({ label, value, bold, small, success, warn, accent, large, italic }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: small ? 11 : large ? 14 : 13,
      color: success ? "var(--success)" : warn ? "var(--warn)" : accent ? "var(--accent2)" : "var(--text)",
      fontWeight: bold || large ? 700 : 400,
      fontStyle: italic ? "italic" : "normal",
      marginBottom: 2,
    }}>
      <span style={{ color: bold || large ? "inherit" : "var(--text2)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── SALES PAGE ─────────────────────────────────────────────────────────────
function SalesPage({ data, onSale, onCancel, toast }) {
  const { products, sales, settings } = data;
  const { priceSettings } = settings;
  const designs = settings?.designs || [];

  const [modal, setModal]         = useState(false);
  const [ticket, setTicket]       = useState(null); // sales[] à afficher dans le ticket
  const [client, setClient]       = useState({ name: "", phone: "", quartier: "", delivery: false, remarque: "" });

  // ── Normalise le numéro de téléphone : ajoute +223 si aucun indicatif
  const normalizePhone = (raw) => {
    if (!raw || !raw.trim()) return "";
    const trimmed = raw.trim();
    // Déjà un indicatif (commence par + ou 00)
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) return trimmed;
    // Pas d'indicatif → on préfixe avec +223 (Mali)
    return "+223" + trimmed.replace(/^0/, ""); // supprime le 0 initial si présent
  };
  const [cartLines, setCartLines] = useState([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDelivery, setFilterDelivery] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null); // group[] à annuler
  const PAGE_SIZE = 50;

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  const addCartLine    = () => setCartLines(l => [...l, { id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  const removeCartLine = (id) => setCartLines(l => l.filter(x => x.id !== id));
  const updateCartLine = (id, field, val) => {
    setCartLines(l => l.map(x => x.id === id ? { ...x, [field]: val } : x));
    setErrors(e => { const ne = { ...e }; delete ne[`${id}_${field}`]; return ne; });
  };

  const lineCalcs = useMemo(() => cartLines.map(line => {
    const prod      = productMap[line.productId];
    const qty       = parseInt(line.qty) || 1;
    const basePrice = prod?.price || 0;
    const baseTotal = basePrice * qty;
    const autoVol   = priceSettings?.volumeDiscounts
      ? (priceSettings.volumeDiscounts.filter(vd => qty >= vd.minQty).sort((a, b) => b.percent - a.percent)[0]?.percent || 0)
      : 0;
    const effectivePct   = line.discountType === "none" ? 0 : line.discountType === "volume" ? autoVol : parseInt(line.discountPercent) || 0;
    const discountAmount = Math.round(baseTotal * effectivePct / 100);
    return { prod, qty, basePrice, baseTotal, autoVol, effectivePct, discountAmount, total: baseTotal - discountAmount };
  }), [cartLines, productMap, priceSettings]);

  const grandTotal = useMemo(() => lineCalcs.reduce((s, l) => s + l.total, 0), [lineCalcs]);

  const handleSale = () => {
    if (submitting) return;
    const errs = {};
    cartLines.forEach((line, i) => {
      const calc = lineCalcs[i];
      if (!line.productId) errs[`${line.id}_productId`] = "Sélectionnez un produit";
      else {
        if (!line.qty || isNaN(parseInt(line.qty)) || parseInt(line.qty) < 1) errs[`${line.id}_qty`] = "Quantité ≥ 1";
        else if (calc.prod && parseInt(line.qty) > calc.prod.stock) errs[`${line.id}_qty`] = `Stock insuffisant (${calc.prod.stock} dispo)`;
      }
      if (line.discountType === "custom") {
        const pct = parseInt(line.discountPercent);
        if (isNaN(pct) || pct < 1 || pct > 100) errs[`${line.id}_discountPercent`] = "Entre 1 et 100%";
      }
    });
    if (client.phone && !/^[\d\s\+\-\(\)\.]{6,20}$/.test(normalizePhone(client.phone).trim())) errs.phone = "Numéro invalide";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    for (let i = 0; i < cartLines.length; i++) {
      const line = cartLines[i];
      const calc = lineCalcs[i];
      const qty  = parseInt(line.qty) || 0;
      if (calc.prod && qty > calc.prod.stock) {
        (toast || window.alert)(`❌ Stock insuffisant pour "${calc.prod.model} — ${calc.prod.design}" (${calc.prod.stock} dispo).`);
        return;
      }
    }

    const saleDate = today();
    const groupId  = uid(); // identifiant commun à toutes les lignes de cet achat
    const newSales = cartLines.map((line, i) => {
      const calc = lineCalcs[i];
      return {
        id: uid(), groupId, date: saleDate,
        productId: line.productId, qty: calc.qty,
        price: calc.basePrice, total: calc.baseTotal,
        discountType: line.discountType,
        discountPercent: calc.effectivePct,
        discountAmount: calc.discountAmount,
        totalAfterDiscount: calc.total,
        discountReason: line.discountReason,
        client: sanitize(client.name, 100), phone: sanitize(normalizePhone(client.phone), 20),
        quartier: sanitize(client.quartier, 100), delivery: client.delivery,
        remarque: sanitize(client.remarque, 300),
      };
    });

    setSubmitting(true);
    onSale(newSales);
    setModal(false);

    // ── Ouvre le ticket après la vente ──────────────────────────────────
    setTicket(newSales);

    setClient({ name: "", phone: "", quartier: "", delivery: false, remarque: "" });
    setCartLines([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
    setErrors({});
    setTimeout(() => setSubmitting(false), 600);
  };

  const filtered = useMemo(() =>
    sales.filter(s => {
      const prod = productMap[s.productId];
      const q    = search.toLowerCase();
      const sDate = toDateStr(s.date);
      const matchText = !q
        || (prod && (`${prod.model} ${prod.design}`).toLowerCase().includes(q))
        || (s.client || "").toLowerCase().includes(q)
        || (s.quartier || "").toLowerCase().includes(q);
      const matchDate = (!dateFrom || sDate >= dateFrom) && (!dateTo || sDate <= dateTo);
      const matchDelivery = filterDelivery === "" ? true : filterDelivery === "yes" ? s.delivery : !s.delivery;
      const matchMin = !filterAmountMin || (s.totalAfterDiscount ?? s.total) >= Number(filterAmountMin);
      const matchMax = !filterAmountMax || (s.totalAfterDiscount ?? s.total) <= Number(filterAmountMax);
      return matchText && matchDate && matchDelivery && matchMin && matchMax;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sales, productMap, search, dateFrom, dateTo, filterDelivery, filterAmountMin, filterAmountMax]
  );

  // ── Groupement par groupId (un achat multi-produits = une seule ligne) ──────
  const groupedSales = useMemo(() => {
    const groups = new Map();
    filtered.forEach(s => {
      const key = s.groupId || s.id; // rétrocompat : ventes sans groupId = leur propre groupe
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    return Array.from(groups.values()).sort((a, b) => new Date(b[0].date) - new Date(a[0].date));
  }, [filtered]);

  const totalRev = useMemo(() => filtered.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0), [filtered]);

  const totalPages = Math.max(1, Math.ceil(groupedSales.length / PAGE_SIZE));
  const paginated  = groupedSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page quand le filtre change
  const resetPage = () => setCurrentPage(1);

  const openModal  = () => { setModal(true); setErrors({}); };
  const closeModal = () => {
    setModal(false); setErrors({});
    setClient({ name: "", phone: "", quartier: "", delivery: false, remarque: "" });
    setCartLines([{ id: uid(), productId: "", qty: "1", discountType: "none", discountPercent: "0", discountReason: "", _model: "" }]);
  };

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Ventes ({groupedSales.length})</span>
        <button className="btn btn-primary btn-sm" onClick={openModal}>
          <Icon name="plus" size={14} /> Nouvelle vente
        </button>
      </div>

      <div className="filter-row">
        <input className="input" placeholder="Rechercher produit, client, quartier..." value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} style={{ flex: 2 }} />
        <input className="input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); resetPage(); }} style={{ flex: 1 }} />
        <input className="input" type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   resetPage(); }} style={{ flex: 1 }} />
      </div>
      <div className="filter-row" style={{ marginTop: 6 }}>
        <select className="input" value={filterDelivery} onChange={e => { setFilterDelivery(e.target.value); resetPage(); }} style={{ flex: 1 }}>
          <option value="">Livraison : tous</option>
          <option value="yes">Livraison : oui</option>
          <option value="no">Livraison : non</option>
        </select>
        <input className="input" type="number" min="0" placeholder="Montant min (FCFA)" value={filterAmountMin} onChange={e => { setFilterAmountMin(e.target.value); resetPage(); }} style={{ flex: 1 }} />
        <input className="input" type="number" min="0" placeholder="Montant max (FCFA)" value={filterAmountMax} onChange={e => { setFilterAmountMax(e.target.value); resetPage(); }} style={{ flex: 1 }} />
        {(dateFrom || dateTo || search || filterDelivery || filterAmountMin || filterAmountMax) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setFilterDelivery(""); setFilterAmountMin(""); setFilterAmountMax(""); resetPage(); }} title="Effacer tous les filtres">✕ Effacer</button>
        )}
      </div>

      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--text2)" }}>CA filtré :</span>
        <span style={{ fontWeight: 800, color: "var(--success)", fontSize: 16 }}>{fmtMoney(totalRev)}</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Produit</th>
                <th scope="col">Qté</th>
                <th scope="col">Total</th>
                <th scope="col">Remise</th>
                <th scope="col">Client / Quartier</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedSales.length === 0 && <tr><td colSpan={7} className="empty">Aucune vente</td></tr>}
              {paginated.map(group => {
                const s    = group[0]; // données communes (date, client…)
                const isMulti = group.length > 1;
                const groupTotal = group.reduce((sum, v) => sum + (v.totalAfterDiscount ?? v.total), 0);
                const hasDiscount = group.some(v => v.discountPercent > 0);
                const prodLabel = isMulti
                  ? `${group.length} produits`
                  : (() => { const p = productMap[s.productId]; return p ? `${p.model} — ${p.design}` : "—"; })();
                const totalQty = group.reduce((sum, v) => sum + (v.qty || 0), 0);
                return (
                  <tr key={s.groupId || s.id}>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      <div>{fmtDate(s.date)}</div>
                      {s.date && s.date.length > 10 && (
                        <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 1 }}>
                          {new Date(s.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {prodLabel}
                      {isMulti && (
                        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                          {group.map((v, i) => {
                            const p = productMap[v.productId];
                            return (
                              <span key={v.id} style={{ display: "block" }}>
                                {i + 1}. {p ? `${p.model} — ${p.design}` : "—"} ×{v.qty}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td>{totalQty}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(groupTotal)}</td>
                    <td>
                      {hasDiscount
                        ? <span className="badge badge-gold"><Icon name="percent" size={10} /> remise</span>
                        : <span style={{ color: "var(--text2)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div style={{ fontWeight: 500 }}>{s.client || "—"}</div>
                      <div style={{ color: "var(--text2)", fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        {s.quartier && <span>{s.quartier}</span>}
                        {s.delivery && <span className="badge badge-info" style={{ fontSize: 10 }}>🚚</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="btn btn-outline btn-sm btn-icon"
                          title="Voir le ticket"
                          onClick={() => setTicket(group)}
                        >
                          🧾
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          title="Annuler cette vente"
                          onClick={() => setCancelTarget(group)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >← Préc.</button>
          <span style={{ fontSize: 13, color: "var(--text2)" }}>
            Page <strong>{currentPage}</strong> / {totalPages}
            <span style={{ marginLeft: 8, color: "var(--text2)" }}>({groupedSales.length} achats)</span>
          </span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >Suiv. →</button>
        </div>
      )}
      {modal && (
        <Modal title="Enregistrer une vente" onClose={closeModal} wide footer={<>
          <button className="btn btn-outline" onClick={closeModal}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSale} disabled={submitting}>
            {submitting ? "Enregistrement..." : `Valider la vente — ${fmtMoney(grandTotal)}`}
          </button>
        </>}>

          <p className="section-label">Produits *</p>
          {cartLines.map((line, i) => {
            const calc = lineCalcs[i];
            const lineModel = line._model || "";
            const designsForModel = lineModel ? products.filter(p => p.model === lineModel && p.stock > 0) : [];
            return (
              <div key={line.id} style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 2 }}>
                    <select className="input" value={lineModel} onChange={e => { const m = e.target.value; setCartLines(l => l.map(x => x.id === line.id ? { ...x, _model: m, productId: "" } : x)); }} style={{ fontSize: 12 }}>
                      <option value="">① Modèle</option>
                      {[...new Set(products.filter(p => p.stock > 0).map(p => p.model))].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <select className={`input${errors[`${line.id}_productId`] ? " input-error" : ""}`} value={line.productId} onChange={e => updateCartLine(line.id, "productId", e.target.value)} disabled={!lineModel} style={{ fontSize: 12 }}>
                      <option value="">② Design</option>
                      {designsForModel.map(p => <option key={p.id} value={p.id}>{p.design} — {p.stock} dispo — {fmtMoney(p.price)}</option>)}
                    </select>
                    {errors[`${line.id}_productId`] && <FieldError msg={errors[`${line.id}_productId`]} />}
                    {line.productId && (() => { const prod = products.find(p => p.id === line.productId); const img = prod ? getProductImageUrl(prod, designs) : ""; return img ? <img src={img} alt="" loading="lazy" style={{ marginTop: 5, height: 40, borderRadius: 6, objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : null; })()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input className={`input${errors[`${line.id}_qty`] ? " input-error" : ""}`} type="number" min="1" value={line.qty} onChange={e => updateCartLine(line.id, "qty", e.target.value)} placeholder="Qté" style={{ fontSize: 12 }} />
                    {errors[`${line.id}_qty`] && <FieldError msg={errors[`${line.id}_qty`]} />}
                  </div>
                  {cartLines.length > 1 && (
                    <button className="btn btn-danger btn-sm btn-icon" style={{ marginTop: 1 }} onClick={() => removeCartLine(line.id)}><Icon name="trash" size={13} /></button>
                  )}
                </div>

                <div className="tabs" style={{ marginBottom: 8 }}>
                  <button className={`tab ${line.discountType === "none" ? "active" : ""}`} onClick={() => updateCartLine(line.id, "discountType", "none")}>Sans remise</button>
                  {calc.autoVol > 0 && (
                    <button className={`tab ${line.discountType === "volume" ? "active" : ""}`} onClick={() => updateCartLine(line.id, "discountType", "volume")}>Volume (-{calc.autoVol}%)</button>
                  )}
                  <button className={`tab ${line.discountType === "custom" ? "active" : ""}`} onClick={() => updateCartLine(line.id, "discountType", "custom")}>Exceptionnelle</button>
                </div>
                {line.discountType === "custom" && (
                  <div className="form-grid" style={{ marginBottom: 8 }}>
                    <div className="form-group">
                      <input className={`input${errors[`${line.id}_discountPercent`] ? " input-error" : ""}`} type="number" min="1" max="100" value={line.discountPercent} onChange={e => updateCartLine(line.id, "discountPercent", e.target.value)} placeholder="% remise" />
                      {errors[`${line.id}_discountPercent`] && <FieldError msg={errors[`${line.id}_discountPercent`]} />}
                    </div>
                    <div className="form-group">
                      <input className="input" value={line.discountReason} onChange={e => updateCartLine(line.id, "discountReason", e.target.value)} placeholder="Motif (optionnel)" />
                    </div>
                  </div>
                )}

                {calc.prod && (
                  <div style={{ fontSize: 12, color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
                    <span>{calc.qty} × {fmtMoney(calc.basePrice)}{calc.effectivePct > 0 ? ` — remise ${calc.effectivePct}%` : ""}</span>
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(calc.total)}</span>
                  </div>
                )}
              </div>
            );
          })}

          <button className="btn btn-outline btn-sm" onClick={addCartLine} style={{ marginBottom: 4 }}>
            <Icon name="plus" size={13} /> Ajouter un produit
          </button>

          <div className="discount-preview">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>Total à payer ({cartLines.length} ligne{cartLines.length > 1 ? "s" : ""})</span>
              <span style={{ fontWeight: 800, color: "var(--success)", fontSize: 16 }}>{fmtMoney(grandTotal)}</span>
            </div>
          </div>

          <div className="divider" />
          <p className="section-label">Client (optionnel)</p>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nom client</label>
              <input className="input" value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} placeholder="Moussa Diallo" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <div style={{ position: "relative" }}>
                <input
                  className={`input${errors.phone ? " input-error" : ""}`}
                  value={client.phone}
                  onChange={e => { setClient(c => ({ ...c, phone: e.target.value })); setErrors(er => ({ ...er, phone: undefined })); }}
                  placeholder="76 XXX XX XX"
                  style={{ paddingRight: 110 }}
                />
                {!client.phone.trim().startsWith("+") && !client.phone.trim().startsWith("00") && client.phone.trim() && (
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text2)", pointerEvents: "none", background: "var(--bg2)", padding: "2px 6px", borderRadius: 4 }}>
                    → +223 auto
                  </span>
                )}
              </div>
              <FieldError msg={errors.phone} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Quartier</label>
            <input className="input" value={client.quartier} onChange={e => setClient(c => ({ ...c, quartier: e.target.value }))} placeholder="Plateau, Médina..." />
          </div>
          <div className="form-group">
            <label className="form-label">Remarque</label>
            <input className="input" value={client.remarque} onChange={e => setClient(c => ({ ...c, remarque: e.target.value }))} placeholder="Livraison express, couleur spéciale..." />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={client.delivery} onChange={e => setClient(c => ({ ...c, delivery: e.target.checked }))} />
            <Icon name="truck" size={14} /> Livraison à domicile
          </label>
        </Modal>
      )}

      {/* ── Modale ticket de caisse ── */}
      {ticket && (
        <TicketModal
          sales={ticket}
          productMap={productMap}
          onClose={() => setTicket(null)}
        />
      )}

      {/* ── Modale annulation de vente ── */}
      {cancelTarget && (
        <Modal
          title="❌ Annuler cette vente ?"
          onClose={() => setCancelTarget(null)}
          footer={<>
            <button className="btn btn-outline" onClick={() => setCancelTarget(null)}>Garder</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (onCancel) onCancel(cancelTarget);
                setCancelTarget(null);
              }}
            >
              Confirmer l'annulation
            </button>
          </>}
        >
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
            <p style={{ marginBottom: 12 }}>
              Tu es sur le point d'annuler l'achat du <strong>{fmtDate(cancelTarget[0].date)}</strong>
              {cancelTarget[0].client ? <> pour <strong>{cancelTarget[0].client}</strong></> : ""}.
            </p>
            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
              {cancelTarget.map(s => {
                const p = productMap[s.productId];
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span>{p ? `${p.model} — ${p.design}` : "—"} × {s.qty}</span>
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmtMoney(s.totalAfterDiscount ?? s.total)}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 6, marginTop: 4, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: "var(--success)" }}>{fmtMoney(cancelTarget.reduce((s, v) => s + (v.totalAfterDiscount ?? v.total), 0))}</span>
              </div>
            </div>
            <p style={{ color: "var(--warn)", fontSize: 12 }}>
              ⚠️ Le stock sera remis à jour automatiquement. Cette action est irréversible.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SalesPage;
