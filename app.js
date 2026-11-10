/* Evergreen Business Plan · motore dell'app (stato salvato dall'host Mac in Dati app/business_plan.json, o nel browser) */
(function () {
"use strict";
const HOST = window.__HOST__ || null;
const MAC = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.evg);   // app per Mac (JXA + WebKit)
const WIN = !MAC && !!(HOST && HOST.win);                                                          // versione Windows (server locale PowerShell + Edge)
const NATIVO = MAC || WIN;
const $ = s => document.querySelector(s);
function host(m) {
  if (MAC) return window.webkit.messageHandlers.evg.postMessage(JSON.stringify(m));
  if (!WIN) return;
  fetch("/api/" + m.cmd, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(m) })
    .then(r => r.json()).then(j => { if (m.cmd === "save") window.__evgSaved(!!j.ok); if (m.cmd === "file") window.__evgFile(!!j.ok, j.path); })
    .catch(() => { if (m.cmd === "save") window.__evgSaved(false); else toast("Il programma non risponde: chiudi la finestra e riavvialo"); });
}
if (WIN) setInterval(() => fetch("/api/ping", { method: "POST", body: "{}" }).catch(() => {}), 15000);   // tiene acceso il server finché la finestra è aperta

/* ================= DATI DI PARTENZA (forniti dalla società) ================= */
const STAGIONE = { titolo: "Stagione 2027/2028", periodo: "settembre 2027 – aprile 2028", scadenzaQuote: "2027-08-31" };
const CATEGORIE = [
  { id: "u15", nome: "Under 15", ico: "①", quota: 350, atleti: 18, uscite: [
    ["Iscrizione campionato", 100], ["Tesseramento atleti", 432], ["Kit allenamento", 1440], ["Stipendio allenatore", 1200]] },
  { id: "u19", nome: "Under 19", ico: "②", quota: 250, atleti: 18, uscite: [
    ["Iscrizione campionato", 300], ["Tesseramento", 700], ["Kit allenamento", 2160], ["Stipendio allenatore", 1200], ["Stipendio dirigente", 800]] },
  { id: "u21", nome: "Under 21", ico: "③", quota: 0, atleti: 0, uscite: [
    ["Iscrizione campionato", 300], ["Tesseramento", 700], ["Rimborso benzina", 960], ["Kit allenamento", 1500], ["Stipendio allenatore", 2000],
    ["Stipendio secondo allenatore", 800], ["Stipendio preparatore portieri", 1200], ["Stipendio preparatore atletico", 1200]] },
  { id: "ps", nome: "Prima squadra", ico: "★", quota: 0, atleti: 0, uscite: [
    ["Iscrizione campionato", 1500], ["Tesseramento", 1000], ["Rimborso benzina", 960], ["Kit allenamento", 3000], ["Stipendio allenatore", 2000],
    ["Stipendio secondo allenatore", 800], ["Stipendio preparatore portieri", 1200], ["Stipendio preparatore atletico", 1200]] }
];
const SPONSOR_PREVISTO = 28000;     // obiettivo sponsor della stagione (usato nel saldo previsto)
const N_SPONSOR = 15;
const nuovoSponsor = () => ({ nome: "", descr: "", dest: "soc", importo: 0, scadenza: "", note: "", rate: [] });   // rate: [{data, descr, importo, ric}]

/* ================= STATO ================= */
const LSKEY = "evergreen.bp.2027";
function vuoto() {
  return {
    formato: 1, salvato: null,
    cat: Object.fromEntries(CATEGORIE.map(c => [c.id, {
      quota: c.quota,
      atleti: Array.from({ length: c.atleti }, () => ({ nome: "", r: [null, null] })),   // r[i] = data di pagamento (AAAA-MM-GG) o null
      uscite: c.uscite.map(([voce, imp]) => ({ voce, imp, pagata: null }))
    }])),
    sponsor: { previsto: SPONSOR_PREVISTO, elenco: Array.from({ length: N_SPONSOR }, nuovoSponsor), sel: 0 },
    ui: { vista: "riep" }
  };
}
let S = vuoto();
try {
  const raw = (HOST && HOST.stato) || localStorage.getItem(LSKEY);
  if (raw) { const x = JSON.parse(raw); if (x && x.cat && x.sponsor) S = Object.assign(vuoto(), x); }
} catch (e) { console.error(e); }
if (!S.ui) S.ui = { vista: "riep" };
migraSponsor(S);
function migraSponsor(x) {   // versione 1.0: un unico totale con versamenti generici → elenco di sponsor
  const sp = x.sponsor;
  if (!sp.elenco) {
    sp.elenco = Array.from({ length: N_SPONSOR }, nuovoSponsor);
    if ((sp.versamenti || []).length) {
      const v = sp.elenco[0]; v.nome = "Versamenti registrati prima dell'elenco"; v.descr = "da assegnare agli sponsor";
      v.rate = sp.versamenti.map(r => ({ data: r.data || "", descr: r.nota || "Versamento", importo: +r.importo || 0, ric: r.data || oggiISO() }));
      v.importo = v.rate.reduce((a, r) => a + r.importo, 0);
    }
  }
  delete sp.versamenti; if (sp.sel == null) sp.sel = 0;
  while (sp.elenco.length < N_SPONSOR) sp.elenco.push(nuovoSponsor());
}

let saveT = null;
function salva(subito) {
  S.salvato = new Date().toISOString();
  setSave("Salvataggio…", true);
  clearTimeout(saveT);
  const go = () => {
    const json = JSON.stringify(S, null, 1);
    if (NATIVO) host({ cmd: "save", data: json });
    else { try { localStorage.setItem(LSKEY, json); } catch (e) {} window.__evgSaved(true); }
    if (window.__cloud) window.__cloud.salva(json);   // versione online: invia la modifica all'archivio condiviso
  };
  if (subito) go(); else saveT = setTimeout(go, 300);
}
window.__evgSaved = ok => setSave(ok ? "Salvato " + new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "ERRORE di salvataggio", !ok);
window.__evgFile = (ok, p) => toast(ok ? "File salvato in Dati app › Esportazioni" : "Salvataggio del file non riuscito");
window.__evgImporta = t => { try { const x = JSON.parse(t); if (!x.cat || !x.sponsor) throw 0; S = Object.assign(vuoto(), x); migraSponsor(S); salva(true); render(); toast("Backup ripristinato"); } catch (e) { toast("File non valido"); } };
window.__evgStampa = () => report();
// collegamento con l'archivio online (cloud.js): legge lo stato e applica le modifiche arrivate da un altro dispositivo
window.__evgJSON = () => JSON.stringify(S, null, 1);
window.__evgSalvato = () => S.salvato;
window.__evgApplica = json => {
  const x = JSON.parse(json); if (!x || !x.cat || !x.sponsor) return false;
  const ui = S.ui; S = Object.assign(vuoto(), x); migraSponsor(S); S.ui = ui;    // la schermata aperta resta quella di questo dispositivo
  try { localStorage.setItem(LSKEY, JSON.stringify(S, null, 1)); } catch (e) {}
  const a = document.activeElement, scriveva = a && /INPUT|SELECT|TEXTAREA/.test(a.tagName);
  if (!scriveva) render(); else renderNav();      // non interrompe chi sta scrivendo: la pagina si aggiorna al cambio di campo
  return true;
};
function setSave(t, warn) { const el = $("#saveState"); el.textContent = t; el.classList.toggle("warn", !!warn); }
window.addEventListener("beforeunload", () => {
  if (!saveT) return; clearTimeout(saveT);
  if (WIN && navigator.sendBeacon) { S.salvato = new Date().toISOString(); navigator.sendBeacon("/api/save", JSON.stringify({ cmd: "save", data: JSON.stringify(S, null, 1) })); }
  else salva(true);
});

/* ================= CALCOLI ================= */
const eur = n => { const [i, d] = (Math.round(Math.abs(n) * 100) / 100).toFixed(2).split(".");
  return (n < 0 ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d !== "00" ? "," + d : "") + " €"; };
const oggiISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dataIt = iso => iso ? new Date(iso + "T12:00").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const s = String(v).trim().replace(/\s|€/g, ""); const n = parseFloat(s.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s); return isFinite(n) ? n : 0; };
const pct = (a, b) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0;
const segno = n => n > 0 ? "pos" : n < 0 ? "neg" : "";
const rata = id => (S.cat[id].quota || 0) / 2;
function conti(id) {
  const c = S.cat[id], r = rata(id);
  const entPrev = c.atleti.length * (c.quota || 0);
  const entInc = c.atleti.reduce((s, a) => s + (a.r[0] ? r : 0) + (a.r[1] ? r : 0), 0);
  const uscPrev = c.uscite.reduce((s, u) => s + (+u.imp || 0), 0);
  const uscPag = c.uscite.reduce((s, u) => s + (u.pagata ? (+u.imp || 0) : 0), 0);
  const rateMancanti = c.atleti.reduce((s, a) => s + (a.r[0] ? 0 : 1) + (a.r[1] ? 0 : 1), 0);
  const daPagare = c.uscite.filter(u => !u.pagata).length;
  return { entPrev, entInc, uscPrev, uscPag, saldoPrev: entPrev - uscPrev, saldoAtt: entInc - uscPag, haEntrate: c.atleti.length > 0, rateMancanti, daPagare };
}
const versato = sp => sp.rate.reduce((a, r) => a + (r.ric ? (+r.importo || 0) : 0), 0);
const sponsorInc = () => S.sponsor.elenco.reduce((a, sp) => a + versato(sp), 0);
const sponsorConc = () => S.sponsor.elenco.reduce((a, sp) => a + (+sp.importo || 0), 0);
const DEST = () => [["soc", "Società"], ...CATEGORIE.map(c => [c.id, c.nome])];
const destNome = d => (DEST().find(x => x[0] === d) || ["", "Società"])[1];
function statoSponsor(sp) {
  const imp = +sp.importo || 0, v = versato(sp);
  if (!imp && !sp.nome.trim()) return ["—", ""];
  if (imp && v >= imp) return ["Saldato", "ok"];
  const scad = sp.scadenza && oggiISO() > sp.scadenza;
  if (scad) return [v ? "Parziale · scaduto" : "Scaduto", "bad"];
  if (v) { const n = sp.rate.length, r = sp.rate.filter(x => x.ric).length; return [n > 1 ? `Parziale · ${r} rate su ${n}` : "Parziale", "warn"]; }
  return ["In attesa", "warn"];
}
function sponsorDest(d) { const l = S.sponsor.elenco.filter(sp => (sp.dest || "soc") === d); return { conc: l.reduce((a, sp) => a + (+sp.importo || 0), 0), inc: l.reduce((a, sp) => a + versato(sp), 0), n: l.filter(sp => +sp.importo || sp.nome.trim()).length }; }
function totali() {
  const t = { entPrev: S.sponsor.previsto, entInc: sponsorInc(), uscPrev: 0, uscPag: 0, rateMancanti: 0, daPagare: 0 };
  CATEGORIE.forEach(c => { const k = conti(c.id); ["entPrev", "entInc", "uscPrev", "uscPag", "rateMancanti", "daPagare"].forEach(x => t[x] += k[x]); });
  t.saldoPrev = t.entPrev - t.uscPrev; t.saldoAtt = t.entInc - t.uscPag; return t;
}
function statoAtleta(a) {
  if (a.r[0] && a.r[1]) return ["Saldato", "ok"];
  const scaduto = oggiISO() > STAGIONE.scadenzaQuote;
  const t = !a.r[0] && !a.r[1] ? "Mancano rata 1 e 2" : !a.r[0] ? "Manca rata 1" : "Manca rata 2";
  return [scaduto ? t + " · scaduta" : t, scaduto ? "bad" : "warn"];
}
function movimenti() {
  const m = [];
  CATEGORIE.forEach(c => {
    const s = S.cat[c.id], r = rata(c.id);
    s.atleti.forEach((a, i) => a.r.forEach((d, j) => { if (d) m.push({ d, cat: c.nome, desc: `Rata ${j + 1} · ${a.nome || "Atleta " + (i + 1)}`, imp: r }); }));
    s.uscite.forEach(u => { if (u.pagata) m.push({ d: u.pagata, cat: c.nome, desc: u.voce, imp: -(+u.imp || 0) }); });
  });
  S.sponsor.elenco.forEach((sp, i) => sp.rate.forEach(r => { if (r.ric) m.push({ d: r.ric, cat: "Sponsor", desc: `${sp.nome || "Sponsor " + (i + 1)} · ${r.descr || "versamento"}`, imp: +r.importo || 0 }); }));
  return m.sort((a, b) => (b.d || "").localeCompare(a.d || ""));
}

/* ================= NAVIGAZIONE ================= */
function renderNav() {
  const v = S.ui.vista, sp = sponsorInc();
  let h = `<div class="sez">Generale</div><button data-v="riep" class="${v === "riep" ? "on" : ""}"><span class="ico">▦</span>Riepilogo</button><div class="sez">Categorie</div>`;
  CATEGORIE.forEach(c => { const k = conti(c.id), n = k.haEntrate ? k.rateMancanti : k.daPagare;
    h += `<button data-v="${c.id}" class="${v === c.id ? "on" : ""}"><span class="ico">${c.ico}</span>${c.nome}<span class="cnt${k.haEntrate && n ? " red" : ""}" title="${k.haEntrate ? "rate da incassare" : "uscite da pagare"}">${n}</span></button>`; });
  h += `<div class="sez">Entrate</div><button data-v="spons" class="${v === "spons" ? "on" : ""}"><span class="ico">€</span>Sponsor<span class="cnt">${pct(sp, S.sponsor.previsto)}%</span></button>
    <div class="sez">Strumenti</div><button data-v="reg" class="${v === "reg" ? "on" : ""}"><span class="ico">≡</span>Registro pagamenti</button>
    <button data-v="dati" class="${v === "dati" ? "on" : ""}"><span class="ico">⚙</span>Dati e backup</button>`;
  $("#nav").innerHTML = h;
  const t = totali(); $("#sideSaldo").textContent = eur(t.saldoAtt);
}
function intestazione(titolo, sub, badge, cls) {
  $("#pTitle").textContent = titolo; $("#pSub").textContent = sub;
  const b = $("#badge"); b.textContent = badge || ""; b.hidden = !badge; b.className = "phase " + (cls || "");
}

/* ================= SCHERMATE ================= */
function vRiepilogo() {
  const t = totali(), sp = sponsorInc();
  intestazione("Riepilogo della stagione", `${STAGIONE.titolo} · ${STAGIONE.periodo}`, `Saldo previsto ${eur(t.saldoPrev)}`, segno(t.saldoPrev));
  const righe = CATEGORIE.map(c => { const k = conti(c.id); return `<tr class="click" data-v="${c.id}"><td><b>${c.nome}</b></td>
    <td class="n e">${k.haEntrate ? `${eur(k.entInc)} <span class="muted">/ ${eur(k.entPrev)}</span>` : "–"}</td>
    <td class="n e">${eur(k.uscPag)} <span class="muted">/ ${eur(k.uscPrev)}</span></td>
    <td class="n e ${segno(k.saldoAtt)}">${eur(k.saldoAtt)}</td><td class="n e ${segno(k.saldoPrev)}"><b>${eur(k.saldoPrev)}</b></td></tr>`; }).join("");
  return `<div class="grid">
  <div class="kpis">
    <div class="kpi"><div class="t">Entrate incassate</div><div class="v">${eur(t.entInc)}</div><div class="s">su ${eur(t.entPrev)} previste</div><div class="bar"><i style="width:${pct(t.entInc, t.entPrev)}%"></i></div></div>
    <div class="kpi red"><div class="t">Uscite pagate</div><div class="v">${eur(t.uscPag)}</div><div class="s">su ${eur(t.uscPrev)} previste</div><div class="bar red"><i style="width:${pct(t.uscPag, t.uscPrev)}%"></i></div></div>
    <div class="kpi navy"><div class="t">Saldo attuale (cassa)</div><div class="v ${segno(t.saldoAtt)}">${eur(t.saldoAtt)}</div><div class="s">incassato − pagato</div></div>
    <div class="kpi amber"><div class="t">Saldo previsto a fine stagione</div><div class="v ${segno(t.saldoPrev)}">${eur(t.saldoPrev)}</div><div class="s">se tutto viene incassato e pagato</div></div>
  </div>
  <div class="card"><h2>Saldo per categoria<span class="r muted">clic su una riga per aprirla · dopo la « / » l'importo previsto</span></h2><div class="body">
    <table><thead><tr><th>Categoria</th><th class="n">Entrate incassate / previste</th><th class="n">Uscite pagate / previste</th><th class="n">Saldo attuale</th><th class="n">Saldo previsto</th></tr></thead><tbody>
    ${righe}
    <tr class="click" data-v="spons"><td><b>Sponsor</b></td><td class="n e">${eur(sp)} <span class="muted">/ ${eur(S.sponsor.previsto)}</span></td><td class="n e">–</td>
      <td class="n e ${segno(sp)}">${eur(sp)}</td><td class="n e ${segno(S.sponsor.previsto)}"><b>${eur(S.sponsor.previsto)}</b></td></tr>
    <tr class="tot"><td>Totale società</td><td class="n e">${eur(t.entInc)} <span class="muted">/ ${eur(t.entPrev)}</span></td><td class="n e">${eur(t.uscPag)} <span class="muted">/ ${eur(t.uscPrev)}</span></td>
      <td class="n e ${segno(t.saldoAtt)}">${eur(t.saldoAtt)}</td><td class="n e ${segno(t.saldoPrev)}">${eur(t.saldoPrev)}</td></tr>
    </tbody></table></div></div>
  <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
    <div class="kpi amber"><div class="t">Rate di iscrizione da incassare</div><div class="v">${t.rateMancanti}</div><div class="s">scadenza ${dataIt(STAGIONE.scadenzaQuote)}</div></div>
    <div class="kpi red"><div class="t">Uscite ancora da pagare</div><div class="v">${t.daPagare}</div><div class="s">${eur(t.uscPrev - t.uscPag)} in totale</div></div>
    <div class="kpi"><div class="t">Sponsor da incassare</div><div class="v">${eur(Math.max(0, S.sponsor.previsto - sp))}</div><div class="s">su ${eur(S.sponsor.previsto)}</div></div>
  </div></div>`;
}

function stato(on, label, attr) {
  return `<button class="st ${on ? "si" : "no"}" ${attr}>${label}</button>${on ? `<span class="when">il <input type="date" value="${on}" ${attr.replace("data-", "data-d")} title="Data del pagamento"></span>` : ""}`;
}
function vCategoria(id) {
  const def = CATEGORIE.find(c => c.id === id), c = S.cat[id], k = conti(id), r = rata(id);
  intestazione(def.nome, k.haEntrate ? `Quota ${eur(c.quota)} ad atleta in 2 rate da ${eur(r)} · pagamento entro il ${dataIt(STAGIONE.scadenzaQuote)}` : "Categoria senza entrate proprie: solo uscite",
    `Saldo attuale ${eur(k.saldoAtt)}`, segno(k.saldoAtt));
  let h = `<div class="grid">`;
  if (k.haEntrate) {
    const atl = c.atleti.map((a, i) => { const [sx, cls] = statoAtleta(a); return `<tr>
      <td class="idx">${i + 1}</td>
      <td style="min-width:200px"><input class="txt" data-nome="${i}" value="${esc(a.nome)}" placeholder="Nome e cognome atleta"></td>
      <td>${stato(a.r[0], `Rata 1 · <span class="e">${eur(r)}</span> · ${a.r[0] ? "Saldata" : "Da saldare"}`, `data-rata="${i}:0"`)}</td>
      <td>${stato(a.r[1], `Rata 2 · <span class="e">${eur(r)}</span> · ${a.r[1] ? "Saldata" : "Da saldare"}`, `data-rata="${i}:1"`)}</td>
      <td><span class="chip ${cls}">${sx}</span></td></tr>`; }).join("");
    h += `<div class="card"><h2>Entrate · quote di iscrizione<span class="r muted">clic su una rata per segnarla come saldata (la data si può correggere)</span></h2><div class="body">
      <table><thead><tr><th>#</th><th>Atleta</th><th>Rata 1</th><th>Rata 2</th><th>Stato pagamento</th></tr></thead><tbody>${atl}</tbody></table>
      <div class="totali"><div><small>Totale incassato</small><b class="pos">${eur(k.entInc)}</b></div><div><small>Totale prospettato</small><b>${eur(k.entPrev)}</b></div>
        <div><small>Ancora da incassare</small><b class="${k.entPrev - k.entInc > 0 ? "neg" : ""}">${eur(k.entPrev - k.entInc)}</b></div>
        <div class="grow"><small>${pct(k.entInc, k.entPrev)}% incassato</small><div class="bar"><i style="width:${pct(k.entInc, k.entPrev)}%"></i></div></div></div></div></div>`;
  }
  const usc = c.uscite.map((u, i) => `<tr><td style="min-width:240px"><input class="txt" data-voce="${i}" value="${esc(u.voce)}"></td>
    <td class="n"><input class="num" data-imp="${i}" value="${u.imp}"></td>
    <td>${stato(u.pagata, u.pagata ? "Pagata" : "Da pagare", `data-pag="${i}"`)}</td>
    <td class="n"><button class="ghost small" data-del="${i}" title="Elimina voce">✕</button></td></tr>`).join("");
  h += `<div class="card"><h2>Uscite<span class="r muted">importi per l'intera stagione · voci e importi modificabili</span></h2><div class="body">
    <table><thead><tr><th>Voce</th><th class="n">Importo (€)</th><th>Stato</th><th></th></tr></thead><tbody>${usc}</tbody></table>
    <div class="toolbar" style="margin-top:8px"><button class="ghost small" data-add="1">+ Aggiungi voce</button></div>
    <div class="totali"><div><small>Totale pagato</small><b class="neg">${eur(k.uscPag)}</b></div><div><small>Totale previsto</small><b>${eur(k.uscPrev)}</b></div>
      <div><small>Ancora da pagare</small><b>${eur(k.uscPrev - k.uscPag)}</b></div>
      <div class="grow"><small>${pct(k.uscPag, k.uscPrev)}% pagato</small><div class="bar red"><i style="width:${pct(k.uscPag, k.uscPrev)}%"></i></div></div></div></div></div>`;
  h += `<div class="card"><h2>Saldo ${def.nome}</h2><div class="body"><div class="saldo">
    <div><small>Saldo attuale</small><b class="${segno(k.saldoAtt)}">${eur(k.saldoAtt)}</b><div class="f">${k.haEntrate ? `incassato ${eur(k.entInc)} − pagato ${eur(k.uscPag)}` : `nessuna entrata · pagato ${eur(k.uscPag)}`}</div></div>
    <div><small>Saldo previsto a fine stagione</small><b class="${segno(k.saldoPrev)}">${eur(k.saldoPrev)}</b><div class="f">${k.haEntrate ? `entrate ${eur(k.entPrev)} − uscite ${eur(k.uscPrev)}` : `uscite previste ${eur(k.uscPrev)}`}</div></div>
  </div>${(() => { const sd = sponsorDest(id); return sd.n ? `<p class="meta" style="margin:10px 0 0">Sponsor destinati a questa categoria: <b>${sd.n}</b> · concordato <b class="e">${eur(sd.conc)}</b> · incassato <b class="e">${eur(sd.inc)}</b>. Con gli sponsor il saldo previsto sarebbe <b class="e ${segno(k.saldoPrev + sd.conc)}">${eur(k.saldoPrev + sd.conc)}</b>. (Gli sponsor sono contati nella riga Sponsor del riepilogo.)</p>` : ""; })()}</div></div></div>`;
  return h;
}

function vSponsor() {
  const L = S.sponsor.elenco, ob = S.sponsor.previsto, conc = sponsorConc(), inc = sponsorInc();
  const scaduto = L.reduce((a, sp) => a + (sp.scadenza && oggiISO() > sp.scadenza ? Math.max(0, (+sp.importo || 0) - versato(sp)) : 0), 0);
  const attivi = L.filter(sp => +sp.importo || sp.nome.trim()), saldati = attivi.filter(sp => statoSponsor(sp)[0] === "Saldato").length;
  intestazione("Sponsor", `${attivi.length} sponsor inseriti su ${L.length} righe · obiettivo della stagione ${eur(ob)}`, `Incassato ${eur(inc)}`, inc ? "pos" : "");
  const opt = d => DEST().map(([k, t]) => `<option value="${k}"${k === (d || "soc") ? " selected" : ""}>${t}</option>`).join("");
  const righe = L.map((sp, i) => { const v = versato(sp), imp = +sp.importo || 0, [st, cls] = statoSponsor(sp); return `<tr class="${S.sponsor.sel === i ? "selrow" : ""}">
    <td class="idx">${i + 1}</td>
    <td style="min-width:170px"><input class="txt" data-sn="${i}" value="${esc(sp.nome)}" placeholder="Nome sponsor"></td>
    <td style="min-width:150px"><input class="txt" data-sd="${i}" value="${esc(sp.descr)}" placeholder="es. maglia, pannelli"></td>
    <td><select class="sel" data-sdest="${i}">${opt(sp.dest)}</select></td>
    <td class="n"><input class="num" data-simp="${i}" value="${imp || ""}" placeholder="0" style="max-width:100px"></td>
    <td class="n e" style="min-width:100px">${eur(v)}<div class="bar" style="width:90px;margin-left:auto"><i style="width:${pct(v, imp)}%"></i></div></td>
    <td class="n e ${imp - v > 0 ? "neg" : ""}">${eur(Math.max(0, imp - v))}</td>
    <td><input class="dt" type="date" data-sscad="${i}" value="${sp.scadenza || ""}" style="max-width:135px"></td>
    <td>${cls ? `<span class="chip ${cls}">${st}</span>` : `<span class="muted">—</span>`}</td>
    <td class="n"><button class="ghost small" data-ssel="${i}">${sp.rate.length ? `Rate (${sp.rate.length})` : "Rate"} ▸</button></td></tr>`; }).join("");
  const dest = DEST().map(([k, t]) => { const d = sponsorDest(k), k2 = CATEGORIE.find(c => c.id === k), usc = k2 ? conti(k).uscPrev : 0;
    return `<tr><td>${t}${k === "soc" ? " <span class='muted'>(non vincolati)</span>" : ""}</td><td class="n">${d.n}</td><td class="n e">${eur(d.conc)}</td><td class="n e">${eur(d.inc)}</td>
      <td class="n e muted">${k2 ? `${usc ? Math.round(d.conc / usc * 100) : 0}% di ${eur(usc)}` : "–"}</td></tr>`; }).join("");
  const sel = Math.min(S.sponsor.sel || 0, L.length - 1), sp = L[sel], vs = versato(sp), imps = +sp.importo || 0;
  const rate = sp.rate.map((r, j) => `<tr><td><input class="dt" type="date" data-rd="${j}" value="${r.data || ""}" title="Data prevista"></td>
    <td><input class="txt" data-rdesc="${j}" value="${esc(r.descr)}" placeholder="es. 1ª rata"></td>
    <td class="n"><input class="num" data-rimp="${j}" value="${r.importo || ""}" placeholder="0" style="max-width:100px"></td>
    <td>${stato(r.ric, r.ric ? "Ricevuto" : "Da incassare", `data-rric="${j}"`)}</td>
    <td class="n"><button class="ghost small" data-rdel="${j}" title="Elimina rata">✕</button></td></tr>`).join("");
  const sommaRate = sp.rate.reduce((a, r) => a + (+r.importo || 0), 0);
  return `<div class="grid">
  <div class="kpis">
    <div class="kpi"><div class="t">Obiettivo stagione</div><div class="v"><input class="num" id="spPrev" value="${ob}" style="font:inherit;max-width:150px;text-align:left;padding:2px 6px"></div><div class="s">${conc >= ob ? "raggiunto con gli accordi" : `mancano ${eur(ob - conc)} da trovare`}</div></div>
    <div class="kpi amber"><div class="t">Concordato</div><div class="v">${eur(conc)}</div><div class="s">${attivi.length} sponsor · ${pct(conc, ob)}% dell'obiettivo</div><div class="bar"><i style="width:${pct(conc, ob)}%;background:var(--amber)"></i></div></div>
    <div class="kpi navy"><div class="t">Incassato</div><div class="v ${inc ? "pos" : ""}">${eur(inc)}</div><div class="s">${pct(inc, conc)}% del concordato</div><div class="bar"><i style="width:${pct(inc, conc)}%"></i></div></div>
    <div class="kpi red"><div class="t">Da incassare</div><div class="v ${conc - inc > 0 ? "neg" : ""}">${eur(Math.max(0, conc - inc))}</div><div class="s">${scaduto ? `di cui ${eur(scaduto)} oltre la scadenza` : `${saldati} sponsor su ${attivi.length} saldati`}</div></div>
  </div>
  <div class="card"><h2>Elenco sponsor<span class="r muted">compila le righe · «Rate ▸» apre i pagamenti dello sponsor</span></h2><div class="body"><div style="overflow-x:auto">
    <table><thead><tr><th>#</th><th>Sponsor</th><th>Sponsorizzazione</th><th>Destinato a</th><th class="n">Concordato (€)</th><th class="n">Versato</th><th class="n">Da incassare</th><th>Scadenza</th><th>Stato</th><th></th></tr></thead>
    <tbody>${righe}<tr class="tot"><td></td><td>Totale</td><td></td><td></td><td class="n e">${eur(conc)}</td><td class="n e">${eur(inc)}</td><td class="n e">${eur(Math.max(0, conc - inc))}</td><td></td><td></td><td></td></tr></tbody></table></div>
    <div class="toolbar" style="margin-top:10px"><button class="ghost small" data-sadd="1">+ Aggiungi riga sponsor</button></div></div></div>
  <div class="g2">
    <div class="card"><h2>Ripartizione per destinazione</h2><div class="body"><table><thead><tr><th>Destinato a</th><th class="n">Sponsor</th><th class="n">Concordato</th><th class="n">Versato</th><th class="n">Copre le uscite</th></tr></thead>
      <tbody>${dest}<tr class="tot"><td>Totale</td><td class="n">${attivi.length}</td><td class="n e">${eur(conc)}</td><td class="n e">${eur(inc)}</td><td></td></tr></tbody></table>
      <p class="meta" style="margin-top:8px">Gli sponsor restano una voce a sé nel riepilogo: la destinazione indica quale categoria sostengono, senza cambiarne il saldo.</p></div></div>
    <div class="card"><h2>${esc(sp.nome) || "Sponsor " + (sel + 1)} · rate di pagamento<span class="r">${statoSponsor(sp)[1] ? `<span class="chip ${statoSponsor(sp)[1]}">${statoSponsor(sp)[0]}</span>` : ""}</span></h2><div class="body">
      <p class="meta">Concordato ${eur(imps)} · destinato a ${destNome(sp.dest)}${sp.scadenza ? " · scadenza " + dataIt(sp.scadenza) : ""}${sp.rate.length && sommaRate !== imps ? ` · <b style="color:var(--amber)">le rate sommano ${eur(sommaRate)}</b>` : ""}</p>
      ${rate ? `<table><thead><tr><th>Data prevista</th><th>Descrizione</th><th class="n">Importo (€)</th><th>Stato</th><th></th></tr></thead><tbody>${rate}</tbody></table>` : `<div class="vuoto">Nessuna rata. Aggiungi le rate concordate, oppure una sola rata con l'intero importo.</div>`}
      <div class="toolbar" style="margin-top:10px"><button class="ghost small" data-radd="1">+ Aggiungi rata</button>${!sp.rate.length && imps ? `<button class="ghost small" data-runica="1">Rata unica da ${eur(imps)}</button>` : ""}</div>
      <div class="lab" style="margin-top:12px"><span>Note e contatti</span><input class="txt" data-snote="${sel}" value="${esc(sp.note)}" placeholder="referente, telefono, accordi"></div></div></div>
  </div></div>`;
}

function vRegistro() {
  const m = movimenti(); let ric = 0, eff = 0; m.forEach(x => x.imp >= 0 ? ric += x.imp : eff -= x.imp);
  intestazione("Registro pagamenti", "Tutti i pagamenti ricevuti ed effettuati, dal più recente", `${m.length} movimenti`, "");
  return `<div class="card"><div class="body">
    <div class="leg"><span>Ricevuti <b class="e pos">${eur(ric)}</b></span><span>Effettuati <b class="e neg">${eur(eff)}</b></span><span>Differenza <b class="e ${segno(ric - eff)}">${eur(ric - eff)}</b></span></div>
    ${m.length ? `<table><thead><tr><th>Data</th><th>Categoria</th><th>Descrizione</th><th class="n">Importo</th></tr></thead><tbody>
      ${m.map(x => `<tr><td>${dataIt(x.d)}</td><td>${esc(x.cat)}</td><td>${esc(x.desc)}</td><td class="n e ${x.imp >= 0 ? "pos" : "neg"}">${x.imp >= 0 ? "+" : ""}${eur(x.imp)}</td></tr>`).join("")}</tbody></table>`
      : `<div class="vuoto">Ancora nessun pagamento. Ogni rata saldata, ogni uscita pagata e ogni versamento sponsor compare qui con la sua data.</div>`}
    <div class="toolbar" style="margin-top:12px"><button class="ghost" data-az="csv">Esporta in Excel (CSV)</button></div></div></div>`;
}

function vDati() {
  intestazione("Dati e backup", NATIVO ? "I dati si salvano da soli nella cartella Dati app" : "I dati sono salvati in questo browser", "", "");
  return `<div class="grid"><div class="g2">
  <div class="card"><h2>Archivio</h2><div class="body">
    <p class="meta">${NATIVO ? `Ogni modifica viene salvata in <b>business_plan.json</b>, e ogni giorno resta una copia nella cartella <b>Backup</b>.` : "I dati restano in questo browser: esporta un backup per sicurezza."}</p>
    <div class="toolbar">${NATIVO ? `<button class="primary" data-az="cartella">Apri la cartella Dati app</button>` : ""}<button class="ghost" data-az="backup">Esporta un backup</button><button class="ghost" data-az="importa">Ripristina da backup…</button></div></div></div>
  <div class="card"><h2>Quote di iscrizione</h2><div class="body"><p class="meta">Quota per atleta per la stagione, divisa in 2 rate uguali.</p>
    ${CATEGORIE.filter(c => c.atleti).map(c => `<div class="lab"><span>${c.nome}</span><input class="num" data-quota="${c.id}" value="${S.cat[c.id].quota}"> €</div>`).join("")}</div></div>
  </div>
  <div class="card"><h2>Nuova stagione</h2><div class="body"><p class="meta">Riporta tutto ai valori di partenza: nomi, pagamenti e versamenti vengono cancellati. Fai prima un backup.</p>
    <button class="ghost danger" data-az="reset">Azzera tutti i dati</button></div></div></div>`;
}

/* ================= REPORT DA STAMPARE ================= */
function report() {
  const t = totali(), sp = sponsorInc(), oggi = new Date().toLocaleDateString("it-IT");
  const riga = (n, a, b, c, d) => `<tr><td>${n}</td><td class="n">${a}</td><td class="n">${b}</td><td class="n">${c}</td><td class="n">${d}</td></tr>`;
  let h = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Business Plan Evergreen ${oggi}</title><style>
  body{font:11.5px -apple-system,Helvetica,Arial,sans-serif;color:#17231b;margin:28px}h1{font-size:19px;margin:0;color:#12402a}h2{font-size:13px;margin:22px 0 6px;color:#12402a;border-bottom:2px solid #12402a;padding-bottom:3px}
  .sub{color:#66746a;margin:2px 0 14px}table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{padding:4px 6px;border-bottom:1px solid #dbe3dd;text-align:left}th{font-size:10px;text-transform:uppercase;color:#66746a}
  .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}tr.tot td{font-weight:700;border-top:2px solid #17231b}.ok{color:#1d9150}.no{color:#cf3a2d}.box{display:flex;gap:12px;margin:10px 0}.box div{flex:1;border:1px solid #dbe3dd;border-radius:8px;padding:8px 10px}.box b{display:block;font-size:16px}
  .pb{page-break-before:always}@media print{body{margin:12mm}}</style></head><body>
  <h1>ASD Evergreen Civitavecchia · Business Plan</h1><div class="sub">${STAGIONE.titolo} · ${STAGIONE.periodo} · situazione al ${oggi}</div>
  <div class="box"><div>Entrate incassate<b>${eur(t.entInc)}</b>su ${eur(t.entPrev)}</div><div>Uscite pagate<b>${eur(t.uscPag)}</b>su ${eur(t.uscPrev)}</div><div>Saldo attuale<b>${eur(t.saldoAtt)}</b></div><div>Saldo previsto<b>${eur(t.saldoPrev)}</b></div></div>
  <h2>Riepilogo per categoria</h2><table><thead><tr><th>Categoria</th><th class="n">Entrate inc. / prev.</th><th class="n">Uscite pag. / prev.</th><th class="n">Saldo attuale</th><th class="n">Saldo previsto</th></tr></thead><tbody>`;
  CATEGORIE.forEach(c => { const k = conti(c.id); h += riga(c.nome, k.haEntrate ? `${eur(k.entInc)} / ${eur(k.entPrev)}` : "–", `${eur(k.uscPag)} / ${eur(k.uscPrev)}`, eur(k.saldoAtt), eur(k.saldoPrev)); });
  h += riga("Sponsor", `${eur(sp)} / ${eur(S.sponsor.previsto)}`, "–", eur(sp), eur(S.sponsor.previsto));
  h += `<tr class="tot"><td>Totale società</td><td class="n">${eur(t.entInc)} / ${eur(t.entPrev)}</td><td class="n">${eur(t.uscPag)} / ${eur(t.uscPrev)}</td><td class="n">${eur(t.saldoAtt)}</td><td class="n">${eur(t.saldoPrev)}</td></tr></tbody></table>`;
  const att = S.sponsor.elenco.filter(x => +x.importo || x.nome.trim());
  h += `<h2>Sponsor · obiettivo ${eur(S.sponsor.previsto)} · concordato ${eur(sponsorConc())} · incassato ${eur(sp)}</h2>` + (att.length ? `<table><thead><tr><th>Sponsor</th><th>Sponsorizzazione</th><th>Destinato a</th><th class="n">Concordato</th><th class="n">Versato</th><th class="n">Da incassare</th><th>Stato</th></tr></thead><tbody>` +
    att.map(x => `<tr><td>${esc(x.nome) || "—"}</td><td>${esc(x.descr)}</td><td>${destNome(x.dest)}</td><td class="n">${eur(+x.importo || 0)}</td><td class="n">${eur(versato(x))}</td><td class="n">${eur(Math.max(0, (+x.importo || 0) - versato(x)))}</td><td>${statoSponsor(x)[0]}</td></tr>`).join("") +
    `<tr class="tot"><td>Totale</td><td></td><td></td><td class="n">${eur(sponsorConc())}</td><td class="n">${eur(sp)}</td><td class="n">${eur(Math.max(0, sponsorConc() - sp))}</td><td></td></tr></tbody></table>` : `<p>Nessuno sponsor inserito.</p>`);
  CATEGORIE.forEach((c, ci) => {
    const s = S.cat[c.id], k = conti(c.id), r = rata(c.id);
    h += `<h2${ci ? ' class="pb"' : ""}>${c.nome} · saldo attuale ${eur(k.saldoAtt)} · previsto ${eur(k.saldoPrev)}</h2>`;
    if (k.haEntrate) {
      h += `<table><thead><tr><th>#</th><th>Atleta</th><th>Rata 1 (${eur(r)})</th><th>Rata 2 (${eur(r)})</th><th>Stato</th></tr></thead><tbody>` +
        s.atleti.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.nome) || "—"}</td><td class="${a.r[0] ? "ok" : "no"}">${a.r[0] ? "Saldata " + dataIt(a.r[0]) : "Da saldare"}</td><td class="${a.r[1] ? "ok" : "no"}">${a.r[1] ? "Saldata " + dataIt(a.r[1]) : "Da saldare"}</td><td>${statoAtleta(a)[0]}</td></tr>`).join("") +
        `<tr class="tot"><td></td><td>Incassato / prospettato</td><td colspan="3" class="n">${eur(k.entInc)} / ${eur(k.entPrev)}</td></tr></tbody></table>`;
    }
    h += `<table><thead><tr><th>Uscita</th><th class="n">Importo</th><th>Stato</th></tr></thead><tbody>` +
      s.uscite.map(u => `<tr><td>${esc(u.voce)}</td><td class="n">${eur(+u.imp || 0)}</td><td class="${u.pagata ? "ok" : "no"}">${u.pagata ? "Pagata " + dataIt(u.pagata) : "Da pagare"}</td></tr>`).join("") +
      `<tr class="tot"><td>Pagato / previsto</td><td class="n">${eur(k.uscPag)} / ${eur(k.uscPrev)}</td><td></td></tr></tbody></table>`;
  });
  h += `<script>setTimeout(()=>print(),400)<\/script></body></html>`;
  if (NATIVO) { host({ cmd: "report", nome: `Report_BusinessPlan_${oggiISO()}.html`, html: h }); toast("Report aperto nel browser: usa Stampa › Salva come PDF"); }
  else {
    const w = /iPhone|iPad|Android/i.test(navigator.userAgent) ? null : window.open("", "_blank");
    if (w) { w.document.write(h); w.document.close(); return; }
    const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    f.srcdoc = h.replace("<script>setTimeout(()=>print(),400)<\/script>", ""); document.body.appendChild(f);
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Stampa non disponibile su questo dispositivo"); } setTimeout(() => f.remove(), 60000); };
  }
}

/* ================= DISEGNO E AZIONI ================= */
function render() {
  renderNav();
  const v = S.ui.vista;
  $("#view").innerHTML = v === "riep" ? vRiepilogo() : v === "spons" ? vSponsor() : v === "reg" ? vRegistro() : v === "dati" ? vDati() : vCategoria(v);
  etichette();
}
function etichette() {   // su telefono ogni riga di tabella diventa una scheda: ogni cella riceve il nome della sua colonna
  document.querySelectorAll("#view table").forEach(t => {
    t.classList.add("resp");
    const th = [...t.querySelectorAll("thead th")].map(x => x.textContent.trim());
    t.querySelectorAll("tbody tr").forEach(tr => { let i = 0; [...tr.children].forEach(td => { td.dataset.l = th[i] || ""; i += td.colSpan || 1; }); });
  });
}
function toast(m) { const el = $("#toast"); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2800); }
function cambia(fn, ridisegna = true) { fn(); salva(); if (ridisegna) render(); else renderNav(); }
function vai(v) { S.ui.vista = v; salva(); render(); $("#view").scrollTop = 0; }
function scarica(nome, testo, tipo) {
  if (NATIVO) return host({ cmd: "file", nome, testo });
  try { const f = new File([testo], nome, { type: tipo });
    if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: nome }).catch(() => {}); return; } } catch (e) {}
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([testo], { type: tipo })); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const arma = (el, testo, orig, fn) => { if (!el.dataset.armed) { el.dataset.armed = 1; el.textContent = testo; setTimeout(() => { delete el.dataset.armed; el.textContent = orig; }, 2800); return; } fn(); };

$("#nav").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) vai(b.dataset.v); });
$("#btnReport").addEventListener("click", report);
$("#view").addEventListener("click", e => {
  const el = e.target.closest("button,tr.click"); if (!el) return;
  const d = el.dataset, c = S.cat[S.ui.vista];
  if (d.v) return vai(d.v);
  if (d.rata) { const [i, j] = d.rata.split(":").map(Number); return cambia(() => c.atleti[i].r[j] = c.atleti[i].r[j] ? null : oggiISO()); }
  if (d.pag) { const i = +d.pag; return cambia(() => c.uscite[i].pagata = c.uscite[i].pagata ? null : oggiISO()); }
  if (d.add) return cambia(() => c.uscite.push({ voce: "Nuova voce", imp: 0, pagata: null }));
  if (d.del) return arma(el, "Elimina?", "✕", () => cambia(() => c.uscite.splice(+d.del, 1)));
  const SP = S.sponsor, cur = SP.elenco[SP.sel || 0];
  if (d.ssel) return cambia(() => SP.sel = +d.ssel);
  if (d.sadd) return cambia(() => SP.elenco.push(nuovoSponsor()));
  if (d.radd) return cambia(() => cur.rate.push({ data: "", descr: `${cur.rate.length + 1}ª rata`, importo: 0, ric: null }));
  if (d.runica) return cambia(() => cur.rate.push({ data: cur.scadenza || "", descr: "Rata unica", importo: +cur.importo || 0, ric: null }));
  if (d.rric) { const j = +d.rric; return cambia(() => cur.rate[j].ric = cur.rate[j].ric ? null : oggiISO()); }
  if (d.rdel) return arma(el, "Elimina?", "✕", () => cambia(() => cur.rate.splice(+d.rdel, 1)));
  if (d.az === "csv") { const r = [["Data", "Categoria", "Descrizione", "Importo"], ...movimenti().map(x => [dataIt(x.d), x.cat, x.desc, String(x.imp).replace(".", ",")])];
    return scarica(`Registro_pagamenti_Evergreen_${oggiISO()}.csv`, "﻿" + r.map(x => x.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n"), "text/csv"); }
  if (d.az === "backup") return scarica(`Backup_Evergreen_BP_${oggiISO()}.json`, JSON.stringify(S, null, 1), "application/json");
  if (d.az === "cartella") return host({ cmd: "apriCartella" });
  if (d.az === "importa") {
    if (MAC) return host({ cmd: "importa" });
    const i = document.createElement("input"); i.type = "file"; i.accept = ".json"; i.onchange = () => { const fr = new FileReader(); fr.onload = () => window.__evgImporta(fr.result); fr.readAsText(i.files[0]); }; return i.click();
  }
  if (d.az === "reset") return arma(el, "Clic di nuovo per azzerare tutto", "Azzera tutti i dati", () => { S = vuoto(); S.ui.vista = "dati"; salva(true); render(); toast("Dati azzerati"); });
});
$("#view").addEventListener("input", e => {
  const el = e.target, d = el.dataset, c = S.cat[S.ui.vista];
  if (d.nome != null) return cambia(() => c.atleti[+d.nome].nome = el.value, false);
  if (d.voce != null) return cambia(() => c.uscite[+d.voce].voce = el.value, false);
  const SP = S.sponsor, cur = SP.elenco[SP.sel || 0];
  if (d.sn != null) return cambia(() => SP.elenco[+d.sn].nome = el.value, false);
  if (d.sd != null) return cambia(() => SP.elenco[+d.sd].descr = el.value, false);
  if (d.snote != null) return cambia(() => cur.note = el.value, false);
  if (d.rdesc != null) return cambia(() => cur.rate[+d.rdesc].descr = el.value, false);
});
$("#view").addEventListener("change", e => {
  const el = e.target, d = el.dataset, c = S.cat[S.ui.vista];
  if (d.imp != null) return cambia(() => c.uscite[+d.imp].imp = num(el.value));
  if (d.drata != null) { const [i, j] = d.drata.split(":").map(Number); if (el.value) return cambia(() => c.atleti[i].r[j] = el.value); }
  if (d.dpag != null && el.value) return cambia(() => c.uscite[+d.dpag].pagata = el.value);
  const SP = S.sponsor, cur = SP.elenco[SP.sel || 0];
  if (d.sdest != null) return cambia(() => SP.elenco[+d.sdest].dest = el.value);
  if (d.simp != null) return cambia(() => SP.elenco[+d.simp].importo = num(el.value));
  if (d.sscad != null) return cambia(() => SP.elenco[+d.sscad].scadenza = el.value);
  if (d.rd != null) return cambia(() => cur.rate[+d.rd].data = el.value);
  if (d.rimp != null) return cambia(() => cur.rate[+d.rimp].importo = num(el.value));
  if (d.drric != null && el.value) return cambia(() => cur.rate[+d.drric].ric = el.value);
  if (el.id === "spPrev") return cambia(() => S.sponsor.previsto = num(el.value));
  if (d.quota != null) return cambia(() => S.cat[d.quota].quota = num(el.value));
});

if (NATIVO) $("#dataFile").innerHTML = `Dati: Documenti › ASD Evergreen › Business Plan 2027-2028 › Dati app<br><button class="ghost small" id="btnCart">Apri cartella</button>`;
else $("#dataFile").textContent = "Dati salvati su questo dispositivo.";
document.addEventListener("click", e => { if (e.target.id === "btnCart") host({ cmd: "apriCartella" }); });
setSave(S.salvato ? "Ultimo salvataggio " + new Date(S.salvato).toLocaleString("it-IT") : "Nessuna modifica ancora", false);
render();
})();
