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
    <img src="data:image/png;base64,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" alt="logo" style="width:54px;height:auto;display:block;margin:0 auto 8px;filter:brightness(0);opacity:0.8"/>
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
          <img src="data:image/png;base64,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" alt="logo" style="width:60px;height:auto;filter:brightness(0);opacity:0.75;margin-bottom:8px"/>
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
            src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAFOAhsDASIAAhEBAxEB/8QAHAABAAICAwEAAAAAAAAAAAAAAAcIBQYBAgQD/8QATBAAAQMCAgUDEAcECQUAAAAAAAECAwQFBhEHEhMhMUFRshQiMjU2QlJTYXFyc3SRkrEVM1RigaHBI2ODkxYkJSY0gqLR4UNERdLw/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAHREBAQACAwEBAQAAAAAAAAAAAAERMTJBQgJhUf/aAAwDAQACEQMRAD8ApkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM5gzDs+I7otJE/ZRsarpJMs0anIYy6UU1uuE9FUNylherHfgTRousbrThyOokYiVFWuu5V4tTkQ1nTPYnRzRXyGJUY/9nPlyO5FAjQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM7gW0/TGJaWle1Vha7Xl3d6n/ANkYIlvQlbNjbKm6va3aVD9lEruZOP5gSM1GNYjWoiIiZNQx2ILe26Waqt8qNVJY3NanM5N6KZAfeArJVQSU1TLTyt1ZInqxycyouR8jc9Llo+jsS9UsTKOsZtPM7vkNMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZCwWisvVyjoaJmtI/iq8GpzqBjwZTEdir7DXdS1seWaZsenYvTnQxYAAAAAAAAAAAAAAAAAAAAAAAAAAAcsar3o1qZqq5IWMwtQMtmHaKja3eyJuflcu9SCsF0iVuKrdTr2KzI5fMm9fkWHj63iFjkABGi6aKDqnDUde1M3U8rVVfuuTL/AGIZLHYqo+rsO3Cmy7OncjW+VN6FclTJcgtcAAIAAAAAAAAAAAAAAAAAAAAAAAAAGzYYwVdb9bp66nWOKNifs9ouW0XmQDWQfSohkp53wTMVkjHK1zV4oqHzAAAAAAAAAAAAAAAAAAADvFG+WVsUbVc96o1rU4qpO+j3DcNgs7NtG1ayduvK5yddnyNT7ppWhzDyVNat7q484YV1YUVOLvC/Al3Ny9kFjA4zsMeILRLTSom2azWgkd3ru9TW5lIBrKaajqpaWoYrJYnK17V5FQs40irTRYEjkivlNErUf1lQnMvIoKjIABAAAAAAAAAAAAAAAAAAAAAAAAG3aI4NtjOB3io3v/LL9SciHtCMKPxFVSqmaR0/zchMPALAABHV7GyMka7sXorCtV1h6nudVB4uZ7fcqlmWldMZRLDiq5xryVL/AM1zC1iAAEAAAAAAAAAAAAAAAAAAAAAAA5RFVUREzVQMxg+xzX+9RUUaKkaLrTP8FicVJ/o6WnpKOKmpYmxRRt1Ea013Rph36EsTZJm5VdT10yLyJyNNqyBf4i/S7hpFYl8oocnoqpVNb+TiLyz1TDHUQSQysa9siaj0Ur7jaxvsN+mpMl2Dl1oXLytUKwYACAAAAAAAAAAAAAAem10c1wuEFFA3OSZ6Mb+J5iRdCVqZPdKm5zx6zYGake7v1/4+YEo2WhgtdpprfBHkyGPLJOVeCqexp1747ADy3ahhuVuqKGdutHMzUVObynqDgK0Xegntlxnoqhjmvierd6ZZ+U8hZeooaOqd/WaOmld99mt0j4LY7OnG2Uf8lgMxW8Fjn4esbtzrTRu/goRppYwrS2xsV0tkKRQPescrG9i1eRQI8AAAAAAAAAAAAAAAAAAAEuaLsI0S2OO63KjjnkqXKsSSN1smp5DdUslnTha6ZP4SBcI30Fo5tfcpNV2qsTWoqJy6xK58qamgpm6lPBHEnMxmR9QAACOzSvukRjmYzuWs1W5y5pu4pkhYA89Tb6Cqk2k1HTyv8N8WYX8VnBZT6Htb26v0dSP/AIKf+pEeljDsVpuENbR06QU1SmSsTg16ccvOEaOAAAAAAAAAAAAAAAAAAAJt0eYRttLhyGquFDFLWTN2j9s3NWtXgiIbMlptCN6y20afwUArYbforsf0riJs88aupqRNo7duV3IhMbrLaF/8dTfy0PTTwU9MzZ08DIWK7W1WM1APr91Vb1vetAAA1HSnYvpbDazQxf1qjTaMy4qzlQ244VjXorH72LucBWAGcx3als2KKykRurEr9eL0V3oYMAAAAAAAAAAAAAAE/aN7alswfSty1ZJm7Z+7vl4fkQRb4eqK6CDxkjW+9SysEaRU8cTNzWsRgWPoAAjsDqAAAAHkulupbnQSUFbGkkMiZKirkqLznrAEe3fRha+oJn0E9QyoRusxHrm3zLuIjkY6OR0b0VHNVUVF5FLQZdaV+0h0H0fi6ujazVjkftWeZ28LWvAAIAAAAAAAAAAD1WqimuVxgoadM5Jnoxvk8pL9u0X2OnSN1XLUVMjezbro1qrzbjUtCtD1RiSarVuaU0C6vpO3J+pMjuPWhXSKJkLGRwMRkbUyRidih3ACAAAAAAdjqAO2fW6rTHX2z0F4oXUVfFtInLmiouStXnRT3gCL8T6NaSltM9XbKiodNC1XrE9UcionmIvLPuajmqxzc0VNRUK54qoVtuIa6j1dVscy6qfdXen5BaxgACAAAAAAAAAAAymFrPJfL3Bb2O1GvXOR/gtTipLNBo3w9TVEUj0nnVitdk+RERTXtBtBrVFfcnszRrUhavn3r+hKmQXTqjURGo1GtRvWnZoAQzAAAAAB0gAIw04W5NShurU374Xr+afqRcTvpVpUqcF1SoiK6JWyNXmRF3kEAoAAAAAAAAAAAAAzeBIUnxfbI1brJt2qqebeWF1syCNFkevjehXwNZ3uapO4XoAAQAAAAAAAB2MXfMO2a9ubJcKFkz2pkjkVWq1PwMkPSAjLSFgOgpbO+42aFYXU6ZyR66u1k5VTPmIsLO1EbZ45IHsV7XblZ90jC96OLXQyT1U96SkpNbrddE3LzZ5hdoxM3iKxOtFBa6h0iudW06TK3Lsc8lRPcpnaXDOEX1DI3Yqa7N2WSNRM/wAVN3x/Y7DU2aiZcK5LeynRGU8ivzzbqpuyXzIDCKcG2b6dv8NvVVaxyOc9UXJckTMxdVEsFTLAq5rG9W5+ZciVdGFisVLe5KulvbK6VkaojWIiaqLxXeYnF2HMKsu9S/8ApAlLM56ukhVEfquVd6ZoDDV1w/ImDkxDtU1Vn2ep5OGfvMGTYlgsC6PmUL7h/UPrVq9bdnrdll+hpEmGcJ62TMXxKnljLgw0tEVVRETNV4IS/hbRza2WiGW9Qulq5kzVu0VqM5k3HTDGjalpbjT3GW5MroWok0KMZ1ruZV8hIuqQ0xtis1sssCw2ykbEirm7fmr/AL2ZkOy7IfdAQAAAAAAAAAAAAADC3rC9ivFQlTcaBr5kbq67XK3Pz5GaO3gqBEOk3BlHaaCO52qN7ImuRkzNZXInlRV8pHZZm5UMFdb56Kpj2kUzNRyInAiS66Pqe2SLJX3yCnpnP1WOc3iFrQTM4nsv0OlAqSOelTTpKuacF5UNkpMJ4TkniZ/SyJ6uVM2pkmaryG16QLDYqm3W9K66MoFgbs4Xqjevb5i4MIzwXZWX27PonvVmUD5GqnOibjCysdFK+N6ZOY5WqnlQl/R7h+wUte+ptt26vn1FY9qOamq1eKoa3XYdwtJiGpiqMRpBnKquYrE61VXemfAhhrdZY5KfC9Je1eqtqJnRq3LgnIv45KYYnTEGHbG7AkdEtckFDBqPjnV7V3789/LnmpH8OF8NSuaxmKotdy5Jm1ET5gw0+mglqaiOngYr5ZHI1jU4qq8CZbDo5skNuhbcYFqapUa6VdorcvCRETmOMG6P6WyXNtxqqxtVK3fAiNyRv3zeAaea1W2gtdI2moIEghaueqi5Ki86qes6jMIAAAAAAAAAADGYrjSbC9yj8KmeifCVyLMXJuvbKlvPE9v+grQ9MnuTyhenAACAAAAAAAAAAA3HRA3WxlGvgwvX8ibyFdDLdbF6+Snev5oTUC6AAAAAAAAAAAAAA13SLZXXvDM0MSLtol20TU75ycU9xsQdmBWByK1ytcioqLkqG46SJpH0WH2Pe52VvY7fzqiG+XfR3ZbhdVrlfLDtF15I48mo5fJzGQxNg+2X2kpoZteBaZupE+LvW8ylwsRfojk2eM4d6ojoZEXL0TXLy9X3eseqqquneu/0lJpwhgagw7clr2Ty1Eitcxm0RERE5zzXfRvZbhWPq2TVFO6V6vejN6b+OWaEOmpPei6F2NzXWSsVPw1jSKGmmrayGkgarpZXoxqeVSeH4RtTsNJYmo/qZF1tbPrtbnPJhbAlqsNwbXMllqJ0zazaoiozy7ilZ+w0K2uy0tvz19ixG5+VOtU9rQCIAAAAAAAAAAAAAAAAHY6jMA5pp2laxyXXDu3pmZy0a7RGN5UXibiFRFTJ+9FArAmaL5TeNLc75am0azs06hY73m31+jazVNyfWJNNE2R2vsW5aqLzKvIZHFeCbZfGUyOlkp5IGajXsTPNvMF6RloqkSPFSK5VRFgk4eY1qvcr66oevF0rlX3k3YawJarHVLVRSzVEqsVqLIqIrc+ZEMVV6MLdPcZahKydkb3uesbUTJEz4Zg/GuX2VztEdpRFdktSrXLnxy1jUsO26S7Xqlt8eec0iIqpyJyr7ic7jhW01mHI7Fs3xU8Wqsbmr1yO5zx4PwVb8PTvq45JKmod1rXPVEVieRC4K2aJiRwxQoiajGtYh3AIgAAAAAAAAAAAAA+dZvo5/Vr8is0+6Z/pL8yzVV/hpPVqVnqt1VKn31+YOnyAAAAAAAAAAAAAb1oU7rJfZndJpMxDOhTurm9ld0mkzBbxAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH3QAAAAAAAAAAAAAAAAAOs/wBS/wBBSs9burJ0/eO+ZZif6iTzKVor/wDHVHrXfMLXwAAQAAAAAAAAAAG96Eu6qb2V3SaTKQ3oR7qp/ZXdJpMga8gADIAAAAAAAAAAAH+b8jhZIk3LOxicyuQDkHz6ppvtEPxIcdU032mL4kA+oPl1RT/aIviQ529P9oaB9AfLqmm+0xfkcLWUqcaiD4kA+wPkk9O52qyZjneRyKfUAAAAAAAAAAAAAAAAAAAAB8VqaZsjmuqI9b0kA+wPj1VT+Ph+JDulRAvCpi/IDuDrtYvGtOdpH4xvuA5BxtI/GN9wzZ4ae4DkHDXNd2L2L5lOQAAAAAAAAAAAAADrUfUP9BStNx7YVHrXfNSy8v1L/RK03XtnVeuf81M/K15gAaQAAAAAAAAAAG+aEe6mo9kd0mkyEN6Ee6io9kd0mkyBbxAAEAAAAAAAAA5uS9j2II10kY1udovq221uiiWJibR+rmusqZ5AbZpBvDLHhyeZHtSqe3ZxeErl4L+CEBS1NRLI6SWeR73LmrnOVVU9t9vt0vcrJLlVOmVnYJkiI3zIhjQtrttH+G73nO0k8N3vOgCO+1l8Y/4lOdtN42T4lPmAO+0k8Y/3nGu/w3e86gD0UdZVUdSypp55I5WLm1zXFh8M3GO72Gkr2K3OWPrt/ByblQrgZmw4nvVkidDb6vUicuaxuajm58+SgWHBoWjHGFZfame33LZrK1mvG5jMlfzopv4HUHY6gAAAAAAAAAAAGYIjxxju8Q36oo7XU7CCndqa2qiuc5OKrn5QNs0r3yS04d2FNKsdVVO1Ec1d6NTipCTpJHOVzpHKq8VVT1Xe6V92qeqLhUvnkyyRV4InkQ8QHbaSeG73nO2lT/qv+JToAPslVUpwqJfjUdV1X2mb41PiAPulXVJwqZvjU56trPtU/wDMU84AythvlfarrBWRVM3WPRXNVyqjm8qKWGt9TDXUcVXA/XjmZro5pWQztmxbfbTTpTUlauwTckb2o5qe8LFgwajo0xRUYgoZ21molRTvTWRqZNc1eXI24IAAAAAAAAAADh/1S+YrTde2dV65/wA1LLS/VP8AMVqu3bWr9c/5qZ+VrygA0gAAAAAAAAAAN80I91NR7I7pNJkIb0I91NR7I7pNJkC3iAAIAAAAAABpmknGH0DGykoNV1bKzfrJ1rG+Fq86gbfVzw01NLUVLkbFEmu9VK54ir3XS+Vle5VXbSq5M+bk/I+11xHe7nG6OtuM0kbuLM8mr+CGJAAAAAAAAAAAAAAM/o/uTbXiujqHu1Y3O2b18jt3zyLAI5FRFRc0UrAZigxRf6FWdT3SpRGJkjXP1ky5slC5WKOprej7ErMR2pFk1W1cHWzMTgvM5DZtUI6g7HUAAAAAAAEdaTMaz2yp+ibTMiVDU/azcVZ91AN5vNcy3Weetlc1rYmPeq868hW+qmfUVMs8i5vker3edVzPdcr7eLjFsq241E8arnqOfuz8xjQAAAAAAAAAAAAADb9FV4ZbMRpBO/Ugq27Ny8y8Wr7ycWMyXXb2JWBFVFzRclM/a8Y4it7o9lcpXxx8I5F1mqnNvCxYAGIwdfIMQWWKuZk2ROtkjV3Yu8HzGXCAAAAAAAAOHfVqVrvHbas9e/pKWUXsFK13ntvWevf0lB08gAAAAAAAAAAAADfNCPdTUeyO6TSZCG9CPdRUeyO6TSZAt4gACAAAADvgPFfblFabXUXGdco4W56q8q8iFeL1cam7XOavq5FfLK7NVVeHkJA013rXqILLA/rWptZsuVV4IRmFoAAgAAAAAAAAAAAAAAADM4Pvc1hvkNbG5dnnqzNTvmLxQsNSzRz00dTBJrxysR7HlYCYdDV66stElqndnJRrrxp4TV5PwULEgnVx2OoQAAAAAYXGd6ZYbFPW59enWQp4T1K+1M0tTUSTzPV8kjlc5y8VVTdNL95WuvyW6J6rBRpkqciyLxU0cAAAAAAAAAAAAAAAAAAANn0c4hksV9jR716kqHIyZvJ5F/Anlio9Ee13WOKvk56Lb468YabBK7OopP2T1Xiqd6oWNtAAQAAAAAcL2BWy99uK317+kpZZexK03zt1W+0P6SgmnjAAAAAAAAAAAAAb5oR7qaj2R3SaTIQ3oS7qKn2R3SaTIFvEAAQAAA+dVO2nppKp65NjYr19Fp9DV9J1ctDg2rVMtefKJq+R3H8gIVv9e+53mqr5FVVmlVyZ8iZ7jwgAAAAAAAAAAAAAAAAAAAANg0fXT6JxTSTucqRyO2Unmdu+eRr5y1Va5FTim8C0LXcqHUxuEa36Rw5b6xFze+But503KZIAAAB4r/XR2yzVde/e2KJzsudeQ9pommiudT4ahomyZ9Uzb08jd/8AsCIfqp5KmplqJV1pJHq9y86qp8gAAAAAAAAAAAAAAAAAAAAG6aILr1BidKSR2UVYzZr6XFqmln3t9Q+kroKmNcnRSNen4LmBZloPlRyJLSRSpwexrz6gAAAAABewK2X3t3Xe0P6Slk17ArXe+3Nb69/SUE08YAAAAAAAAAAAADfNCPdTUeyO6TSZCGtCfdTP7K7pNJlC3iAAIAAARtpwqsrdQUmt1z5FkVPIiZfqSSQ/pvle7EFJEqrqsp80ReTNQI/AAAAAAAAAAAAAAAAAAAAAAABN2hurbPhJsHfQSuavm4/qbk4jbQZPnQ19N4MqP97VT9CSQAAAEQ6b6raXukpE4RQq5fO5f+CXiCtK06zYzqW8kTGRp+CAaoAAAAAAAAAAAAAAAAAAAAAAACwWj2q6swdbZO+bGjF8uS5GeNO0Oyq/BsbF4Mme33uRTcQAAAAADl/YO9ErVe+3Nb69/SUso/sHFar123rPXv6ShenkAAQAAAAAAAAAAG96E+6ub2V3SaTKQzoU7rJfZndJpMwW8QABAAACGtNq/wB7Ik5qdOkpMpDWm7uvj9lZ+oa8tEAAZAAAAAAAAAAAAAAAAAAAAAEl6Ct9Zc0/dsVPepKpFWgdf7RuafumfNSVQoAAgQBpHXWxrcvJIif6UJ/K+6Qu7O5+u/RBNLWBAAQAAAAAAAAAAAAAAAAAAAAATLoY67Cz/u1C/ob2aLoUTPCs3tLuihvQAAAAAAk+rf6BWm8dtqv17+kpZV3Yr6JWq79tav17+koJp5QAAAAAAAAAAAAG8aFu6yT2V/zQmghbQv3XO9mf+hNILoAAAAACGdNvdg32dvzUmYhrTcmWLo/ZWfqGvLRAAGQAAAAAAAAAAAAAAAAAAAABJGgntrcfUN6RLDiJtBXbe4epb8yWQsAAECvukLu0unr1+SFgivukHfjO5+uX5IFrAgAIAAAAAAAAAAAAAAAAAAAAAJn0I9y83tLuihvJo2hHuXm9of0UN5AAAAAAOJPqn+iVqu3bSr9c/wCallZPqX+iVpunbKq9c/5qCaeYAAAAAAAAAAAABu+hfuud7M/5oTSQroY7r3ezP/QmoLAABAAACGtNvddH7Kz9SZSGdNndbH7M35qGvLRQAGQAAAAAAAAAAAAAAAAAAAABI+grtvX+qb8yWSJ9BCf2vcF/cJ81JYcFAAECvmP+7G5+vUsGV8x93Y3P1y/JAtYIABAAAAAAAAAAAAAAAAAAAAABNGhHuVn9qXoobwaLoSX+68/tLuihvQAAAAABxJ9S/wBErRcu2NT613zUsvL9Q/0FKz3Bc66oXnld8wdPgAAAAAAAAAAAAA3LQ/NHFi9No9rdeB7UVy5b9xNbZYuy2jPiQrG1VaubVVFTlQ7rPOvGaRf8ygWY6pp/tMPxIdeq6T7ZD/MaVo2knjHe8413+G73hcrMJVUi9jVQ/wAxp221P3ssXxIVl13+G73nO2l8a/4lCYizjHsXg9nxIQxppe1+ME1VRcqZiLl+JpqVVSnComTzPU6SySTSLJLI6R68XOXNVA6AAAAAAAAAAAAAAAAAAAAAAAAkPQhPDDeK5JZWsV0CZIq5Z9cSy6ogT/uIviQrIiqi5oqp5jnaSeG73gWZbV0/Y9VRfEw56opvtMPxIVl2j/Dd7xtJPDd7wYizm3ga3PqiP4kK944kZLi25Pjcj2LO7JU5TEbWTxj/AHnQAAAAAAAAAAAAAAAAAAAAAAAACZNCCp/RupRFTNKhc/hQ3p0kfht+MrPBU1MCKkFRLEjuKMeqZ+4LVVK8aiX41Ass6eBOymi+JBt6fx8XxIVnWaZeMsi/5lONrL41/wASgxFmdvT+Ph+NDjb032iL4kKz7WXxr/iUbSTxj/eDEWVqKqlbTSKtRGm5e+QrbWK1ayZWrm1ZHZLz7z5rI9UyV7lTznUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//Z"
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
