/* Evergreen Business Plan · versione online: accesso e sincronizzazione tra dispositivi (Firebase)
   Tutta la stagione è un unico documento: stagioni/2027-2028. Ogni modifica viene inviata dopo un attimo;
   le modifiche fatte su un altro dispositivo arrivano in tempo reale. Senza internet si continua a lavorare
   e le modifiche partono appena torna la connessione. */
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const CONFIG = {
  apiKey: "AIzaSyAbGhd_VI0aEYgOBo_FDtQWyFH-VgN-rGc",
  authDomain: "evergreen-bp.firebaseapp.com",
  projectId: "evergreen-bp",
  appId: "1:1071225336288:web:8e726684582faf9e937b85"
};
const STAGIONE = "2027-2028";

const $ = s => document.querySelector(s);
const ora = d => (d ? new Date(d) : new Date()).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const giornoOra = d => new Date(d).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* ---------- interfaccia: schermata di accesso e stato della sincronizzazione ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
#accesso{position:fixed;inset:0;z-index:60;background:var(--side);display:flex;align-items:center;justify-content:center;padding:20px}
#accesso form{background:var(--panel);border-radius:14px;padding:22px;width:min(380px,100%);box-shadow:0 10px 40px rgba(0,0,0,.3)}
#accesso h1{margin:0;font-size:20px;color:var(--navy)} #accesso .logo{color:var(--navy);font-size:24px} #accesso .logo span{color:var(--gold)}
#accesso label{display:block;font-size:12px;font-weight:700;color:var(--muted);margin:12px 0 4px}
#accesso input{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;font-size:16px;background:var(--input)}
#accesso button{width:100%;margin-top:16px;padding:12px;font-size:15px}
#accesso .msg{font-size:13px;color:var(--muted);margin-top:10px;min-height:18px} #accesso .msg.err{color:var(--red)}
#accesso a{color:var(--acc);font-size:13px;cursor:pointer}
#cloud{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#cfe3d6;margin-top:8px;flex-wrap:wrap}
#cloud i{width:8px;height:8px;border-radius:99px;background:#7fd8a0;flex:none} #cloud.warn i{background:var(--gold)} #cloud.err i{background:#ff8a7a}
#cloud button{background:none;border:1px solid rgba(255,255,255,.25);color:#cfe3d6;border-radius:6px;font-size:11px;padding:2px 7px;cursor:pointer}
@media (max-width:820px){#cloud{margin:0 0 6px 4px}}
</style>`);
document.body.insertAdjacentHTML("beforeend", `<div id="accesso" hidden><form id="fAcc">
  <div class="logo" style="font-weight:800">EVER<span>GREEN</span></div><h1>Business Plan 2027/2028</h1>
  <p class="muted" style="font-size:13px;margin:6px 0 0">Versione condivisa: accedi per vedere e aggiornare i dati della società.</p>
  <label for="aEmail">Email</label><input id="aEmail" type="email" autocomplete="username" required>
  <label for="aPw">Password</label><input id="aPw" type="password" autocomplete="current-password" required>
  <button class="primary" id="aOk">Entra</button>
  <div class="msg" id="aMsg"></div><a id="aReset">Password dimenticata?</a>
</form></div>`);
$(".brand").insertAdjacentHTML("beforeend", `<div id="cloud" class="warn"><i></i><span id="cloudTxt">Collegamento…</span><button id="cloudEsci" hidden>Esci</button></div>`);
function stato(t, cls) { const c = $("#cloud"); c.className = cls || ""; $("#cloudTxt").textContent = t; }

/* ---------- Firebase ---------- */
let auth, db, ref, A, F;
try {
  const [{ initializeApp }, a, f] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]);
  A = a; F = f;
  const app = initializeApp(CONFIG);
  auth = A.getAuth(app);
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); }     // copia offline non disponibile (es. navigazione privata): funziona solo online
  ref = F.doc(db, "stagioni", STAGIONE);
} catch (e) {
  console.error(e);
  stato("Offline: dati solo su questo dispositivo", "err");   // primo avvio senza internet: si lavora in locale
}

let unsub = null, timer = null, inAttesa = null, primo = true;
async function invia() {
  const json = inAttesa; inAttesa = null; if (!json || !auth || !auth.currentUser) return;
  let salvato = null; try { salvato = JSON.parse(json).salvato; } catch (e) {}
  const p = F.setDoc(ref, { dati: json, salvato, da: auth.currentUser.email, quando: F.serverTimestamp() });
  stato(navigator.onLine ? "Invio…" : "Offline: modifiche salvate, partono appena torna internet", "warn");
  try { await p; if (!inAttesa) stato("Sincronizzato alle " + ora()); }
  catch (e) { console.error(e); stato(e.code === "permission-denied" ? "Account non autorizzato" : "Errore di sincronizzazione", "err"); }
}
window.__cloud = {
  salva(json) {
    if (!auth || !auth.currentUser) return;
    inAttesa = json; clearTimeout(timer); timer = setTimeout(invia, 1200);   // raggruppa le modifiche fatte di seguito
    stato("Modifiche da inviare…", "warn");
  }
};
addEventListener("beforeunload", () => { if (inAttesa) { clearTimeout(timer); invia(); } });
addEventListener("online", () => stato("Di nuovo online: sincronizzazione…", "warn"));
addEventListener("offline", () => stato("Offline: le modifiche partono appena torna internet", "warn"));

function ascolta() {
  if (unsub) unsub();
  unsub = F.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    if (!snap.exists()) {   // archivio ancora vuoto: lo crea questo dispositivo con i dati che ha
      if (primo && !snap.metadata.fromCache) { primo = false; inAttesa = window.__evgJSON(); invia(); }
      return;
    }
    primo = false;
    const d = snap.data();
    if (snap.metadata.hasPendingWrites || inAttesa) return;           // è la nostra modifica che sta partendo
    if (d.salvato && d.salvato !== window.__evgSalvato()) {
      if (window.__evgApplica(d.dati)) stato(`Aggiornato · modifica di ${d.da === auth.currentUser.email ? "questo account" : d.da} del ${giornoOra(d.salvato)}`);
    } else stato(snap.metadata.fromCache ? "Offline: ultima copia salvata" : "Sincronizzato alle " + ora(), snap.metadata.fromCache ? "warn" : "");
  }, e => { console.error(e); stato(e.code === "permission-denied" ? "Account non autorizzato: chiedi di essere aggiunto" : "Errore di collegamento", "err"); });
}

if (auth) {
  A.onAuthStateChanged(auth, u => {
    $("#accesso").hidden = !!u; $("#cloudEsci").hidden = !u;
    if (u) { stato("Collegato come " + u.email, "warn"); ascolta(); }
    else { if (unsub) unsub(); unsub = null; primo = true; stato("Non collegato", "err"); $("#aEmail").focus(); }
  });
  $("#fAcc").addEventListener("submit", async e => {
    e.preventDefault(); const m = $("#aMsg"); m.className = "msg"; m.textContent = "Accesso…"; $("#aOk").disabled = true;
    try { await A.signInWithEmailAndPassword(auth, $("#aEmail").value.trim(), $("#aPw").value); m.textContent = ""; }
    catch (err) { m.className = "msg err"; m.textContent = /network/.test(err.code) ? "Serve internet per il primo accesso." : "Email o password non corrette."; }
    $("#aOk").disabled = false;
  });
  $("#aReset").addEventListener("click", async () => {
    const em = $("#aEmail").value.trim(), m = $("#aMsg");
    if (!em) { m.className = "msg err"; m.textContent = "Scrivi prima la tua email."; return; }
    try { await A.sendPasswordResetEmail(auth, em); m.className = "msg"; m.textContent = "Ti abbiamo inviato un'email per scegliere una nuova password."; }
    catch (err) { m.className = "msg err"; m.textContent = "Invio non riuscito: controlla l'email."; }
  });
  $("#cloudEsci").addEventListener("click", e => {
    const b = e.currentTarget; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = "Esci?"; setTimeout(() => { delete b.dataset.armed; b.textContent = "Esci"; }, 2500); return; }
    if (inAttesa) { clearTimeout(timer); invia(); }
    A.signOut(auth);
  });
}
