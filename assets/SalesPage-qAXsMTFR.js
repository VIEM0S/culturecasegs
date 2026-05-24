import{r as h,u as Y,t as $e,j as e,I as O,f as c,b as H,g as we,a as he,s as ie}from"./index-BvEmT3kb.js";import{M as ce,F as re}from"./components-DPD6rm97.js";import"./firebase-Bx5SM082.js";function Ce({sales:v,productMap:R,onClose:D}){var $,A,F,Z,M,J;const[_,q]=h.useState(!1),z=(($=v[0])==null?void 0:$.date)||he(),b=((A=v[0])==null?void 0:A.client)||"",x=((F=v[0])==null?void 0:F.phone)||"",S=((Z=v[0])==null?void 0:Z.quartier)||"",V=((M=v[0])==null?void 0:M.delivery)||!1,w=((J=v[0])==null?void 0:J.remarque)||"",E=v.reduce((o,i)=>o+(i.totalAfterDiscount??i.total),0),C=v.reduce((o,i)=>o+(i.discountAmount||0),0);v.reduce((o,i)=>o+i.total,0);const f=()=>{const o=["🧾 *CULTURECASE GS — Ticket de caisse*",`📅 Date : ${H(z)}`,"","*Produit(s) :*",...v.map(m=>{const k=R[m.productId],P=k?`${k.model} — ${k.design}`:"—",p=m.discountPercent>0?` _(remise ${m.discountPercent}%)_`:"",j=m.discountPercent>0&&m.discountReason?` — _Motif : ${m.discountReason}_`:"";return`• ${P} × ${m.qty} → *${c(m.totalAfterDiscount??m.total)}*${p}${j}`}),"",C>0?`💸 Remise totale : -${c(C)}`:null,`✅ *Total payé : ${c(E)}*`,"",b?`👤 Client : ${b}`:null,x?`📞 Tél : ${x}`:null,S?`📍 Quartier : ${S}`:null,V?"🚚 *Livraison à domicile*":null,w?`📝 Remarque : ${w}`:null,"","_Merci pour votre achat ! 🙏_"].filter(m=>m!==null).join(`
`),i=encodeURIComponent(o),u=x?`https://wa.me/${x.replace(/[\s\-\(\)\.]/g,"").replace(/^\+/,"")}?text=${i}`:`https://wa.me/?text=${i}`;window.open(u,"_blank")},I=()=>{const o=window.open("","_blank","width=400,height=600");o.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Ticket — Culturecase GS</title>
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
    <h1>Culture<span>case</span> GS</h1>
    <p class="small">Gestion de stock — Ticket de caisse</p>
  </div>

  <hr class="sep" />

  <div class="row"><span class="label">Date</span><span>${H(z)}</span></div>
  ${b?`<div class="row"><span class="label">Client</span><span>${b}</span></div>`:""}
  ${x?`<div class="row"><span class="label">Tél</span><span>${x}</span></div>`:""}
  ${S?`<div class="row"><span class="label">Quartier</span><span>${S}</span></div>`:""}
  ${V?'<div class="row"><span class="label">Livraison</span><span class="badge">À domicile</span></div>':""}
  ${w?`<div class="row"><span class="label">Remarque</span><span style="font-style:italic;color:#555;">${w}</span></div>`:""}

  <hr class="sep" />

  <p class="bold" style="margin-bottom: 8px;">Produit(s)</p>
  ${v.map(i=>{const u=R[i.productId],m=u?`${u.model} — ${u.design}`:"—",k=i.discountPercent>0?`<div class="row small"><span>Remise ${i.discountPercent}%</span><span>-${c(i.discountAmount||0)}</span></div>`:"",P=i.discountPercent>0&&i.discountReason?`<div class="row small" style="font-style:italic;color:#888;"><span>Motif</span><span>${i.discountReason}</span></div>`:"";return`
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dotted #ddd;">
        <div class="bold">${m}</div>
        <div class="row small" style="margin-top: 4px;">
          <span>${i.qty} × ${c(i.price)}</span>
          <span>${c(i.total)}</span>
        </div>
        ${k}
        ${P}
        <div class="row bold" style="margin-top: 2px;">
          <span>Sous-total</span>
          <span class="success">${c(i.totalAfterDiscount??i.total)}</span>
        </div>
      </div>`}).join("")}

  <hr class="sep" />

  ${C>0?`<div class="row"><span class="label">Remise totale</span><span>-${c(C)}</span></div>`:""}
  <div class="row total">
    <span>TOTAL PAYÉ</span>
    <span class="success">${c(E)}</span>
  </div>

  <hr class="sep" />

  <div class="center small" style="margin-top: 12px; line-height: 1.8;">
    Merci pour votre achat ! 🙏<br/>
    <span style="color: #7c3aed; font-weight: 700;">Culturecase GS</span>
  </div>
</body>
</html>`),o.document.close(),o.focus(),setTimeout(()=>{o.print(),o.close()},400)},te=async()=>{q(!0);try{window.html2canvas||await new Promise((p,j)=>{const T=document.createElement("script");T.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",T.onload=p,T.onerror=j,document.head.appendChild(T)});const o=document.createElement("div");o.style.cssText=["position:fixed","left:-9999px","top:0","width:360px","background:#fff","font-family:'Courier New',monospace","font-size:13px","color:#111","padding:24px 20px","line-height:1.6"].join(";");const i=(p,j)=>j?`<div style="display:flex;justify-content:space-between;margin-bottom:4px">
             <span style="color:#666">${p}</span><span>${j}</span>
           </div>`:"",u='<hr style="border:none;border-top:1px dashed #aaa;margin:12px 0"/>';o.innerHTML=`
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px">
            Culture<span style="color:#7c3aed">case</span> GS
          </div>
          <div style="font-size:11px;color:#888;margin-top:2px">Ticket de caisse</div>
        </div>
        ${u}
        ${i("Date",H(z))}
        ${i("Client",b)}
        ${i("Tél",x)}
        ${i("Quartier",S)}
        ${V?i("Livraison","🚚 À domicile"):""}
        ${w?i("Remarque",`<em>${w}</em>`):""}
        ${u}
        <div style="font-weight:700;margin-bottom:8px">Produit(s)</div>
        ${v.map(p=>{const j=R[p.productId],T=j?`${j.model} — ${j.design}`:"—",se=p.discountPercent>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#888">
                 <span>Remise ${p.discountPercent}%</span>
                 <span>-${c(p.discountAmount||0)}</span>
               </div>`:"",W=p.discountPercent>0&&p.discountReason?`<div style="font-size:11px;color:#aaa;font-style:italic">Motif : ${p.discountReason}</div>`:"";return`
            <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dotted #eee">
              <div style="font-weight:700">${T}</div>
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:3px">
                <span>${p.qty} × ${c(p.price)}</span>
                <span>${c(p.total)}</span>
              </div>
              ${se}${W}
              <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:3px">
                <span>Sous-total</span>
                <span style="color:#059669">${c(p.totalAfterDiscount??p.total)}</span>
              </div>
            </div>`}).join("")}
        ${u}
        ${C>0?`<div style="display:flex;justify-content:space-between;margin-bottom:6px">
               <span style="color:#666">Remise totale</span>
               <span>-${c(C)}</span>
             </div>`:""}
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:900">
          <span>TOTAL PAYÉ</span>
          <span style="color:#059669">${c(E)}</span>
        </div>
        ${u}
        <div style="text-align:center;font-size:12px;color:#888;margin-top:8px;line-height:1.8">
          Merci pour votre achat ! 🙏<br/>
          <span style="color:#7c3aed;font-weight:700">Culturecase GS</span>
        </div>
      `,document.body.appendChild(o);const m=await window.html2canvas(o,{scale:2,useCORS:!0,backgroundColor:"#ffffff"});document.body.removeChild(o);const k=m.toDataURL("image/png"),P=window.open("","_blank");P&&(P.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8"/>
            <meta name="viewport" content="width=device-width,initial-scale=1"/>
            <title>Ticket Culturecase GS</title>
            <style>
              body { margin:0; background:#1a1a2e; display:flex; flex-direction:column;
                     align-items:center; justify-content:center; min-height:100vh; gap:16px; }
              img  { max-width:100%; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.5); }
              p    { color:#aaa; font-family:sans-serif; font-size:13px; text-align:center; padding:0 20px; }
            </style>
          </head>
          <body>
            <img src="${k}" alt="Ticket de caisse"/>
            <p>📥 Appuyez longuement sur l'image pour l'enregistrer, puis envoyez-la sur WhatsApp</p>
          </body>
          </html>
        `),P.document.close())}catch(o){console.error("Erreur génération image ticket:",o),alert("Impossible de générer l'image. Utilise le bouton WhatsApp texte à la place.")}finally{q(!1)}};return e.jsx(ce,{title:"🧾 Ticket de caisse",onClose:D,footer:e.jsxs(e.Fragment,{children:[e.jsx("button",{className:"btn btn-outline",onClick:D,children:"Fermer"}),e.jsxs("button",{className:"btn btn-success",onClick:f,style:{gap:6},children:[e.jsx("span",{style:{fontSize:15},children:"📲"})," Texte"]}),e.jsxs("button",{className:"btn btn-success",onClick:te,disabled:_,style:{gap:6,background:"var(--success)",opacity:_?.7:1},children:[e.jsx("span",{style:{fontSize:15},children:"🖼️"})," ",_?"Génération…":"Image WA"]}),e.jsxs("button",{className:"btn btn-primary",onClick:I,children:[e.jsx(O,{name:"download",size:13})," Imprimer"]})]}),children:e.jsxs("div",{style:{background:"var(--bg3)",borderRadius:10,padding:"18px 20px",fontFamily:"'Courier New', monospace",fontSize:13,lineHeight:1.7},children:[e.jsxs("div",{style:{textAlign:"center",marginBottom:14},children:[e.jsxs("div",{style:{fontSize:18,fontWeight:900},children:["Culture",e.jsx("span",{style:{color:"var(--accent2)"},children:"case"})," GS"]}),e.jsx("div",{style:{fontSize:11,color:"var(--text2)"},children:"Ticket de caisse"})]}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--border2)",margin:"10px 0"}}),e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:3,marginBottom:10},children:[e.jsx(N,{label:"Date",value:H(z)}),b&&e.jsx(N,{label:"Client",value:b}),x&&e.jsx(N,{label:"Tél",value:x}),S&&e.jsx(N,{label:"Quartier",value:S}),V&&e.jsx(N,{label:"Livraison",value:"🚚 À domicile",accent:!0}),w&&e.jsx(N,{label:"Remarque",value:w,italic:!0})]}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--border2)",margin:"10px 0"}}),e.jsx("div",{style:{fontWeight:700,marginBottom:8,fontSize:11,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.5px"},children:"Produit(s)"}),v.map(o=>{const i=R[o.productId];return e.jsxs("div",{style:{marginBottom:10,paddingBottom:8,borderBottom:"1px dotted var(--border)"},children:[e.jsx("div",{style:{fontWeight:700},children:i?`${i.model} — ${i.design}`:"—"}),e.jsx(N,{label:`${o.qty} × ${c(o.price)}`,value:c(o.total),small:!0}),o.discountPercent>0&&e.jsx(N,{label:`Remise ${o.discountPercent}%`,value:`-${c(o.discountAmount||0)}`,small:!0,warn:!0}),o.discountPercent>0&&o.discountReason&&e.jsx(N,{label:"Motif",value:o.discountReason,small:!0,italic:!0}),e.jsx(N,{label:"Sous-total",value:c(o.totalAfterDiscount??o.total),bold:!0,success:!0})]},o.id)}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--border2)",margin:"10px 0"}}),C>0&&e.jsx(N,{label:"Remise totale",value:`-${c(C)}`,warn:!0}),e.jsx(N,{label:"TOTAL PAYÉ",value:c(E),bold:!0,success:!0,large:!0}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--border2)",margin:"12px 0 8px"}}),e.jsx("div",{style:{textAlign:"center",fontSize:12,color:"var(--text2)"},children:"Merci pour votre achat ! 🙏"})]})})}function N({label:v,value:R,bold:D,small:_,success:q,warn:z,accent:b,large:x,italic:S}){return e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:_?11:x?14:13,color:q?"var(--success)":z?"var(--warn)":b?"var(--accent2)":"var(--text)",fontWeight:D||x?700:400,fontStyle:S?"italic":"normal",marginBottom:2},children:[e.jsx("span",{style:{color:D||x?"inherit":"var(--text2)"},children:v}),e.jsx("span",{children:R})]})}function ke({data:v,onSale:R,onCancel:D,toast:_}){const{products:q,sales:z,settings:b}=v,{priceSettings:x}=b,S=(b==null?void 0:b.designs)||[],[V,w]=h.useState(!1),[E,C]=h.useState(null),[f,I]=h.useState({name:"",phone:"",quartier:"",delivery:!1,remarque:""}),te=t=>{if(!t||!t.trim())return"";const s=t.trim();return s.startsWith("+")||s.startsWith("00")?s:"+223"+s.replace(/^0/,"")},[$,A]=h.useState([{id:Y(),productId:"",qty:"1",discountType:"none",discountPercent:"0",discountReason:"",_model:""}]),[F,Z]=h.useState(""),[M,J]=h.useState(""),[o,i]=h.useState(""),[u,m]=h.useState({}),[k,P]=h.useState(!1),[p,j]=h.useState(1),[T,se]=h.useState(""),[W,de]=h.useState(""),[K,pe]=h.useState(""),[B,ne]=h.useState(null),le=50,L=h.useMemo(()=>{const t={};return q.forEach(s=>{t[s.id]=s}),t},[q]),xe=()=>A(t=>[...t,{id:Y(),productId:"",qty:"1",discountType:"none",discountPercent:"0",discountReason:"",_model:""}]),ge=t=>A(s=>s.filter(r=>r.id!==t)),G=(t,s,r)=>{A(g=>g.map(a=>a.id===t?{...a,[s]:r}:a)),m(g=>{const a={...g};return delete a[`${t}_${s}`],a})},X=h.useMemo(()=>$.map(t=>{var y;const s=L[t.productId],r=parseInt(t.qty)||1,g=(s==null?void 0:s.price)||0,a=g*r,n=x!=null&&x.volumeDiscounts&&((y=x.volumeDiscounts.filter(U=>r>=U.minQty).sort((U,je)=>je.percent-U.percent)[0])==null?void 0:y.percent)||0,d=t.discountType==="none"?0:t.discountType==="volume"?n:parseInt(t.discountPercent)||0,l=Math.round(a*d/100);return{prod:s,qty:r,basePrice:g,baseTotal:a,autoVol:n,effectivePct:d,discountAmount:l,total:a-l}}),[$,L,x]),ue=h.useMemo(()=>X.reduce((t,s)=>t+s.total,0),[X]),ve=()=>{if(k)return;const t={};if($.forEach((a,n)=>{const d=X[n];if(a.productId?!a.qty||isNaN(parseInt(a.qty))||parseInt(a.qty)<1?t[`${a.id}_qty`]="Quantité ≥ 1":d.prod&&parseInt(a.qty)>d.prod.stock&&(t[`${a.id}_qty`]=`Stock insuffisant (${d.prod.stock} dispo)`):t[`${a.id}_productId`]="Sélectionnez un produit",a.discountType==="custom"){const l=parseInt(a.discountPercent);(isNaN(l)||l<1||l>100)&&(t[`${a.id}_discountPercent`]="Entre 1 et 100%")}}),f.phone&&!/^[\d\s\+\-\(\)\.]{6,20}$/.test(te(f.phone).trim())&&(t.phone="Numéro invalide"),Object.keys(t).length>0){m(t);return}for(let a=0;a<$.length;a++){const n=$[a],d=X[a],l=parseInt(n.qty)||0;if(d.prod&&l>d.prod.stock){(_||window.alert)(`❌ Stock insuffisant pour "${d.prod.model} — ${d.prod.design}" (${d.prod.stock} dispo).`);return}}const s=he(),r=Y(),g=$.map((a,n)=>{const d=X[n];return{id:Y(),groupId:r,date:s,productId:a.productId,qty:d.qty,price:d.basePrice,total:d.baseTotal,discountType:a.discountType,discountPercent:d.effectivePct,discountAmount:d.discountAmount,totalAfterDiscount:d.total,discountReason:a.discountReason,client:ie(f.name,100),phone:ie(te(f.phone),20),quartier:ie(f.quartier,100),delivery:f.delivery,remarque:ie(f.remarque,300)}});P(!0),R(g),w(!1),C(g),I({name:"",phone:"",quartier:"",delivery:!1,remarque:""}),A([{id:Y(),productId:"",qty:"1",discountType:"none",discountPercent:"0",discountReason:"",_model:""}]),m({}),setTimeout(()=>P(!1),600)},oe=h.useMemo(()=>z.filter(t=>{const s=L[t.productId],r=F.toLowerCase(),g=$e(t.date),a=!r||s&&`${s.model} ${s.design}`.toLowerCase().includes(r)||(t.client||"").toLowerCase().includes(r)||(t.quartier||"").toLowerCase().includes(r),n=(!M||g>=M)&&(!o||g<=o),d=T===""?!0:T==="yes"?t.delivery:!t.delivery,l=!W||(t.totalAfterDiscount??t.total)>=Number(W),y=!K||(t.totalAfterDiscount??t.total)<=Number(K);return a&&n&&d&&l&&y}).sort((t,s)=>new Date(s.date)-new Date(t.date)),[z,L,F,M,o,T,W,K]),ee=h.useMemo(()=>{const t=new Map;return oe.forEach(s=>{const r=s.groupId||s.id;t.has(r)||t.set(r,[]),t.get(r).push(s)}),Array.from(t.values()).sort((s,r)=>new Date(r[0].date)-new Date(s[0].date))},[oe]),fe=h.useMemo(()=>oe.reduce((t,s)=>t+(s.totalAfterDiscount??s.total),0),[oe]),ae=Math.max(1,Math.ceil(ee.length/le)),ye=ee.slice((p-1)*le,p*le),Q=()=>j(1),be=()=>{w(!0),m({})},me=()=>{w(!1),m({}),I({name:"",phone:"",quartier:"",delivery:!1,remarque:""}),A([{id:Y(),productId:"",qty:"1",discountType:"none",discountPercent:"0",discountReason:"",_model:""}])};return e.jsxs("div",{children:[e.jsxs("div",{className:"section-header",children:[e.jsxs("span",{className:"section-title",children:["Ventes (",ee.length,")"]}),e.jsxs("button",{className:"btn btn-primary btn-sm",onClick:be,children:[e.jsx(O,{name:"plus",size:14})," Nouvelle vente"]})]}),e.jsxs("div",{className:"filter-row",children:[e.jsx("input",{className:"input",placeholder:"Rechercher produit, client, quartier...",value:F,onChange:t=>{Z(t.target.value),Q()},style:{flex:2}}),e.jsx("input",{className:"input",type:"date",value:M,onChange:t=>{J(t.target.value),Q()},style:{flex:1}}),e.jsx("input",{className:"input",type:"date",value:o,onChange:t=>{i(t.target.value),Q()},style:{flex:1}})]}),e.jsxs("div",{className:"filter-row",style:{marginTop:6},children:[e.jsxs("select",{className:"input",value:T,onChange:t=>{se(t.target.value),Q()},style:{flex:1},children:[e.jsx("option",{value:"",children:"Livraison : tous"}),e.jsx("option",{value:"yes",children:"Livraison : oui"}),e.jsx("option",{value:"no",children:"Livraison : non"})]}),e.jsx("input",{className:"input",type:"number",min:"0",placeholder:"Montant min (FCFA)",value:W,onChange:t=>{de(t.target.value),Q()},style:{flex:1}}),e.jsx("input",{className:"input",type:"number",min:"0",placeholder:"Montant max (FCFA)",value:K,onChange:t=>{pe(t.target.value),Q()},style:{flex:1}}),(M||o||F||T||W||K)&&e.jsx("button",{className:"btn btn-ghost btn-sm",onClick:()=>{Z(""),J(""),i(""),se(""),de(""),pe(""),Q()},title:"Effacer tous les filtres",children:"✕ Effacer"})]}),e.jsxs("div",{style:{marginBottom:14,display:"flex",alignItems:"center",gap:12},children:[e.jsx("span",{style:{fontSize:13,color:"var(--text2)"},children:"CA filtré :"}),e.jsx("span",{style:{fontWeight:800,color:"var(--success)",fontSize:16},children:c(fe)})]}),e.jsx("div",{className:"card",style:{padding:0},children:e.jsx("div",{className:"table-wrap",children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{scope:"col",children:"Date"}),e.jsx("th",{scope:"col",children:"Produit"}),e.jsx("th",{scope:"col",children:"Qté"}),e.jsx("th",{scope:"col",children:"Total"}),e.jsx("th",{scope:"col",children:"Remise"}),e.jsx("th",{scope:"col",children:"Client / Quartier"}),e.jsx("th",{scope:"col",children:"Actions"})]})}),e.jsxs("tbody",{children:[ee.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:7,className:"empty",children:"Aucune vente"})}),ye.map(t=>{const s=t[0],r=t.length>1,g=t.reduce((l,y)=>l+(y.totalAfterDiscount??y.total),0),a=t.some(l=>l.discountPercent>0),n=r?`${t.length} produits`:(()=>{const l=L[s.productId];return l?`${l.model} — ${l.design}`:"—"})(),d=t.reduce((l,y)=>l+(y.qty||0),0);return e.jsxs("tr",{children:[e.jsxs("td",{style:{color:"var(--text2)",fontSize:12},children:[e.jsx("div",{children:H(s.date)}),s.date&&s.date.length>10&&e.jsx("div",{style:{fontSize:10,color:"var(--text2)",marginTop:1},children:new Date(s.date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})})]}),e.jsxs("td",{style:{fontWeight:500},children:[n,r&&e.jsx("div",{style:{fontSize:11,color:"var(--text2)",marginTop:4,display:"flex",flexDirection:"column",gap:2},children:t.map((l,y)=>{const U=L[l.productId];return e.jsxs("span",{style:{display:"block"},children:[y+1,". ",U?`${U.model} — ${U.design}`:"—"," ×",l.qty]},l.id)})})]}),e.jsx("td",{children:d}),e.jsx("td",{style:{fontWeight:700,color:"var(--success)"},children:c(g)}),e.jsx("td",{children:a?e.jsxs("span",{className:"badge badge-gold",children:[e.jsx(O,{name:"percent",size:10})," remise"]}):e.jsx("span",{style:{color:"var(--text2)",fontSize:12},children:"—"})}),e.jsxs("td",{style:{fontSize:12},children:[e.jsx("div",{style:{fontWeight:500},children:s.client||"—"}),e.jsxs("div",{style:{color:"var(--text2)",fontSize:11,marginTop:2,display:"flex",alignItems:"center",gap:6},children:[s.quartier&&e.jsx("span",{children:s.quartier}),s.delivery&&e.jsx("span",{className:"badge badge-info",style:{fontSize:10},children:"🚚"})]})]}),e.jsx("td",{children:e.jsxs("div",{style:{display:"flex",gap:4},children:[e.jsx("button",{className:"btn btn-outline btn-sm btn-icon",title:"Voir le ticket",onClick:()=>C(t),children:"🧾"}),e.jsx("button",{className:"btn btn-danger btn-sm btn-icon",title:"Annuler cette vente",onClick:()=>ne(t),children:e.jsx(O,{name:"trash",size:13})})]})})]},s.groupId||s.id)})]})]})})}),ae>1&&e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:14},children:[e.jsx("button",{className:"btn btn-outline btn-sm",onClick:()=>j(t=>Math.max(1,t-1)),disabled:p===1,children:"← Préc."}),e.jsxs("span",{style:{fontSize:13,color:"var(--text2)"},children:["Page ",e.jsx("strong",{children:p})," / ",ae,e.jsxs("span",{style:{marginLeft:8,color:"var(--text2)"},children:["(",ee.length," achats)"]})]}),e.jsx("button",{className:"btn btn-outline btn-sm",onClick:()=>j(t=>Math.min(ae,t+1)),disabled:p===ae,children:"Suiv. →"})]}),V&&e.jsxs(ce,{title:"Enregistrer une vente",onClose:me,wide:!0,footer:e.jsxs(e.Fragment,{children:[e.jsx("button",{className:"btn btn-outline",onClick:me,children:"Annuler"}),e.jsx("button",{className:"btn btn-primary",onClick:ve,disabled:k,children:k?"Enregistrement...":`Valider la vente — ${c(ue)}`})]}),children:[e.jsx("p",{className:"section-label",children:"Produits *"}),$.map((t,s)=>{const r=X[s],g=t._model||"",a=g?q.filter(n=>n.model===g&&n.stock>0):[];return e.jsxs("div",{style:{background:"var(--bg3)",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid var(--border)"},children:[e.jsxs("div",{style:{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8},children:[e.jsx("div",{style:{flex:2},children:e.jsxs("select",{className:"input",value:g,onChange:n=>{const d=n.target.value;A(l=>l.map(y=>y.id===t.id?{...y,_model:d,productId:""}:y))},style:{fontSize:12},children:[e.jsx("option",{value:"",children:"① Modèle"}),[...new Set(q.filter(n=>n.stock>0).map(n=>n.model))].map(n=>e.jsx("option",{value:n,children:n},n))]})}),e.jsxs("div",{style:{flex:2},children:[e.jsxs("select",{className:`input${u[`${t.id}_productId`]?" input-error":""}`,value:t.productId,onChange:n=>G(t.id,"productId",n.target.value),disabled:!g,style:{fontSize:12},children:[e.jsx("option",{value:"",children:"② Design"}),a.map(n=>e.jsxs("option",{value:n.id,children:[n.design," — ",n.stock," dispo — ",c(n.price)]},n.id))]}),u[`${t.id}_productId`]&&e.jsx(re,{msg:u[`${t.id}_productId`]}),t.productId&&(()=>{const n=q.find(l=>l.id===t.productId),d=n?we(n,S):"";return d?e.jsx("img",{src:d,alt:"",loading:"lazy",style:{marginTop:5,height:40,borderRadius:6,objectFit:"cover"},onError:l=>{l.target.style.display="none"}}):null})()]}),e.jsxs("div",{style:{flex:1},children:[e.jsx("input",{className:`input${u[`${t.id}_qty`]?" input-error":""}`,type:"number",min:"1",value:t.qty,onChange:n=>G(t.id,"qty",n.target.value),placeholder:"Qté",style:{fontSize:12}}),u[`${t.id}_qty`]&&e.jsx(re,{msg:u[`${t.id}_qty`]})]}),$.length>1&&e.jsx("button",{className:"btn btn-danger btn-sm btn-icon",style:{marginTop:1},onClick:()=>ge(t.id),children:e.jsx(O,{name:"trash",size:13})})]}),e.jsxs("div",{className:"tabs",style:{marginBottom:8},children:[e.jsx("button",{className:`tab ${t.discountType==="none"?"active":""}`,onClick:()=>G(t.id,"discountType","none"),children:"Sans remise"}),r.autoVol>0&&e.jsxs("button",{className:`tab ${t.discountType==="volume"?"active":""}`,onClick:()=>G(t.id,"discountType","volume"),children:["Volume (-",r.autoVol,"%)"]}),e.jsx("button",{className:`tab ${t.discountType==="custom"?"active":""}`,onClick:()=>G(t.id,"discountType","custom"),children:"Exceptionnelle"})]}),t.discountType==="custom"&&e.jsxs("div",{className:"form-grid",style:{marginBottom:8},children:[e.jsxs("div",{className:"form-group",children:[e.jsx("input",{className:`input${u[`${t.id}_discountPercent`]?" input-error":""}`,type:"number",min:"1",max:"100",value:t.discountPercent,onChange:n=>G(t.id,"discountPercent",n.target.value),placeholder:"% remise"}),u[`${t.id}_discountPercent`]&&e.jsx(re,{msg:u[`${t.id}_discountPercent`]})]}),e.jsx("div",{className:"form-group",children:e.jsx("input",{className:"input",value:t.discountReason,onChange:n=>G(t.id,"discountReason",n.target.value),placeholder:"Motif (optionnel)"})})]}),r.prod&&e.jsxs("div",{style:{fontSize:12,color:"var(--text2)",display:"flex",justifyContent:"space-between"},children:[e.jsxs("span",{children:[r.qty," × ",c(r.basePrice),r.effectivePct>0?` — remise ${r.effectivePct}%`:""]}),e.jsx("span",{style:{fontWeight:700,color:"var(--success)"},children:c(r.total)})]})]},t.id)}),e.jsxs("button",{className:"btn btn-outline btn-sm",onClick:xe,style:{marginBottom:4},children:[e.jsx(O,{name:"plus",size:13})," Ajouter un produit"]}),e.jsx("div",{className:"discount-preview",children:e.jsxs("div",{style:{display:"flex",justifyContent:"space-between"},children:[e.jsxs("span",{style:{fontWeight:700},children:["Total à payer (",$.length," ligne",$.length>1?"s":"",")"]}),e.jsx("span",{style:{fontWeight:800,color:"var(--success)",fontSize:16},children:c(ue)})]})}),e.jsx("div",{className:"divider"}),e.jsx("p",{className:"section-label",children:"Client (optionnel)"}),e.jsxs("div",{className:"form-grid",children:[e.jsxs("div",{className:"form-group",children:[e.jsx("label",{className:"form-label",children:"Nom client"}),e.jsx("input",{className:"input",value:f.name,onChange:t=>I(s=>({...s,name:t.target.value})),placeholder:"Moussa Diallo"})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{className:"form-label",children:"Téléphone"}),e.jsxs("div",{style:{position:"relative"},children:[e.jsx("input",{className:`input${u.phone?" input-error":""}`,value:f.phone,onChange:t=>{I(s=>({...s,phone:t.target.value})),m(s=>({...s,phone:void 0}))},placeholder:"76 XXX XX XX",style:{paddingRight:110}}),!f.phone.trim().startsWith("+")&&!f.phone.trim().startsWith("00")&&f.phone.trim()&&e.jsx("span",{style:{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"var(--text2)",pointerEvents:"none",background:"var(--bg2)",padding:"2px 6px",borderRadius:4},children:"→ +223 auto"})]}),e.jsx(re,{msg:u.phone})]})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{className:"form-label",children:"Quartier"}),e.jsx("input",{className:"input",value:f.quartier,onChange:t=>I(s=>({...s,quartier:t.target.value})),placeholder:"Plateau, Médina..."})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{className:"form-label",children:"Remarque"}),e.jsx("input",{className:"input",value:f.remarque,onChange:t=>I(s=>({...s,remarque:t.target.value})),placeholder:"Livraison express, couleur spéciale..."})]}),e.jsxs("label",{className:"checkbox-row",children:[e.jsx("input",{type:"checkbox",checked:f.delivery,onChange:t=>I(s=>({...s,delivery:t.target.checked}))}),e.jsx(O,{name:"truck",size:14})," Livraison à domicile"]})]}),E&&e.jsx(Ce,{sales:E,productMap:L,onClose:()=>C(null)}),B&&e.jsx(ce,{title:"❌ Annuler cette vente ?",onClose:()=>ne(null),footer:e.jsxs(e.Fragment,{children:[e.jsx("button",{className:"btn btn-outline",onClick:()=>ne(null),children:"Garder"}),e.jsx("button",{className:"btn btn-danger",onClick:()=>{D&&D(B),ne(null)},children:"Confirmer l'annulation"})]}),children:e.jsxs("div",{style:{fontSize:13,color:"var(--text)",lineHeight:1.7},children:[e.jsxs("p",{style:{marginBottom:12},children:["Tu es sur le point d'annuler l'achat du ",e.jsx("strong",{children:H(B[0].date)}),B[0].client?e.jsxs(e.Fragment,{children:[" pour ",e.jsx("strong",{children:B[0].client})]}):"","."]}),e.jsxs("div",{style:{background:"var(--bg3)",borderRadius:8,padding:"10px 14px",marginBottom:12},children:[B.map(t=>{const s=L[t.productId];return e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12},children:[e.jsxs("span",{children:[s?`${s.model} — ${s.design}`:"—"," × ",t.qty]}),e.jsx("span",{style:{fontWeight:700,color:"var(--success)"},children:c(t.totalAfterDiscount??t.total)})]},t.id)}),e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",borderTop:"1px dashed var(--border)",paddingTop:6,marginTop:4,fontWeight:700},children:[e.jsx("span",{children:"Total"}),e.jsx("span",{style:{color:"var(--success)"},children:c(B.reduce((t,s)=>t+(s.totalAfterDiscount??s.total),0))})]})]}),e.jsx("p",{style:{color:"var(--warn)",fontSize:12},children:"⚠️ Le stock sera remis à jour automatiquement. Cette action est irréversible."})]})})]})}export{ke as default};
