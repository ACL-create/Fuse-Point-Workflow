// Fuse Point – Workflow · sign-in (Google + team PIN) and Firestore connection.
// The app talks to the database through window.claude.use("db") – this file provides that.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, getDoc, setDoc, deleteDoc, onSnapshot, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TEAM = ["David", "Champ", "Daniel", "Amalie", "Savan"];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gate = $("#gate"), body = $("#gateBody");
const show = html => { gate.hidden = false; body.innerHTML = html; };
const hide = () => { gate.hidden = true; };
window.fpShowGate = () => { if (!window.__fpReady) gate.hidden = false; };

const cfg = window.FIREBASE_CONFIG;
if (!cfg || !cfg.apiKey) {
  show(`<p class="gmsg">The app isn't connected to its database yet.</p>
    <p class="gsmall">Admin: add the Firebase settings to <b>config.js</b>.</p>
    <button class="gbtn ghost" id="gDemo">▶ Try the demo</button>`);
  $("#gDemo").onclick = demo;
  throw new Error("FIREBASE_CONFIG missing");
}

const app = initializeApp(cfg);
const auth = getAuth(app);
const fs = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
let team = null, me = null;

function demo() { hide(); window.startDemo && window.startDemo("all"); }

// ---------- adapter: same shape as the Claude artifact database ----------
const errCode = e => (e && (e.code === "permission-denied" || e.code === "unauthenticated")) ? "invalid_argument"
  : (e && (e.code === "unavailable" || e.code === "deadline-exceeded")) ? "unavailable" : "unknown";
const wrapErr = e => { const code = errCode(e); if (code === "invalid_argument") recheck(); return { code, message: e && e.message }; };
const snapDoc = d => ({ id: d.id, exists: d.exists(), data: () => d.data(), metadata: { fromCache: d.metadata.fromCache, hasPendingWrites: d.metadata.hasPendingWrites } });
const DB = {
  collection: p => ({
    onSnapshot(next, err) {
      return onSnapshot(collection(fs, p), s => next({
        docs: s.docs.map(snapDoc), size: s.size, empty: s.empty,
        metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites }, docChanges: () => []
      }), e => err && err(wrapErr(e)));
    }
  }),
  doc: p => {
    const r = doc(fs, p);
    const run = async f => { try { return await f(); } catch (e) { throw wrapErr(e); } };
    return {
      id: r.id, path: p,
      get: () => run(async () => snapDoc(await getDoc(r))),
      set: d => run(() => setDoc(r, d)),
      update: d => run(() => setDoc(r, d, { merge: true })),   // deep-merges nested fields
      delete: () => run(() => deleteDoc(r)),
      onSnapshot(next, err) { return onSnapshot(r, d => next(snapDoc(d)), e => err && err(wrapErr(e))); }
    };
  }
};

// ---------- screens ----------
function signInScreen(msg) {
  show(`${msg ? `<p class="gerr">${esc(msg)}</p>` : ""}
    <p class="gmsg">Sign in with the Google account your team admin added.</p>
    <button class="gbtn" id="gGoogle"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Sign in with Google</button>
    <button class="gbtn ghost" id="gDemo">▶ Just looking? Try the demo</button>`);
  $("#gGoogle").onclick = async () => {
    const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
    try { await signInWithPopup(auth, p); }
    catch (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) { await signInWithRedirect(auth, p); }
      else if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") signInScreen("Sign-in didn't work: " + (e.code || e.message));
    }
  };
  $("#gDemo").onclick = demo;
}

function setupScreen(user) {
  show(`<p class="gmsg"><b>First-time setup</b><br>Add the Google email of each team member and choose a team PIN. You (${esc(user.email)}) become the admin.</p>
    ${TEAM.map(n => `<label class="glabel">${n}</label><input class="gin" type="email" data-mail="${n}" placeholder="name@gmail.com" autocomplete="off">`).join("")}
    <label class="glabel">Team PIN (4–8 digits)</label><input class="gin" id="gPin1" inputmode="numeric" type="password" maxlength="8">
    <label class="glabel">Repeat PIN</label><input class="gin" id="gPin2" inputmode="numeric" type="password" maxlength="8">
    <p class="gerr" id="gErr"></p>
    <button class="gbtn" id="gSave">Save & start</button>
    <button class="gbtn ghost" id="gOut">Sign out</button>`);
  $("#gOut").onclick = () => signOut(auth);
  $("#gSave").onclick = async () => {
    const names = {}, emails = [];
    document.querySelectorAll("[data-mail]").forEach(i => { const v = i.value.trim().toLowerCase(); if (v) { names[v] = i.dataset.mail; emails.push(v); } });
    const mine = user.email.toLowerCase(), p1 = $("#gPin1").value.trim(), p2 = $("#gPin2").value.trim();
    if (!emails.includes(mine)) return $("#gErr").textContent = `Add your own email (${mine}) next to your name.`;
    if (!/^\d{4,8}$/.test(p1)) return $("#gErr").textContent = "The PIN must be 4–8 digits.";
    if (p1 !== p2) return $("#gErr").textContent = "The two PINs are not the same.";
    $("#gSave").disabled = true;
    try {
      const b = writeBatch(fs);
      b.set(doc(fs, "access/team"), { emails, names, admins: [mine] });
      b.set(doc(fs, "access/pin"), { value: p1 });
      await b.commit();
      await setDoc(doc(fs, "unlocked/" + user.uid), { pin: p1, email: mine });
      await enter(user);
    } catch (e) { $("#gErr").textContent = "Couldn't save: " + (e.code || e.message); $("#gSave").disabled = false; }
  };
}

function pinScreen(user, msg) {
  show(`<p class="gmsg">Hi ${esc(team.names[user.email.toLowerCase()] || "")} 👋<br>Enter the team PIN. You only need to do this once on this phone.</p>
    <input class="gin gpin" id="gPin" inputmode="numeric" type="password" maxlength="8" autocomplete="off" placeholder="••••">
    <p class="gerr" id="gErr">${esc(msg || "")}</p>
    <button class="gbtn" id="gGo">Unlock</button>
    <button class="gbtn ghost" id="gOut">Sign out</button>`);
  const go = async () => {
    const pin = $("#gPin").value.trim(); if (!pin) return;
    $("#gGo").disabled = true;
    try { await setDoc(doc(fs, "unlocked/" + user.uid), { pin, email: user.email.toLowerCase() }); await enter(user); }
    catch (e) { $("#gGo").disabled = false; $("#gErr").textContent = e && e.code === "permission-denied" ? "Wrong PIN – try again." : "Couldn't check the PIN: " + (e.code || e.message); }
  };
  $("#gGo").onclick = go; $("#gPin").onkeydown = e => { if (e.key === "Enter") go(); };
  $("#gOut").onclick = () => signOut(auth);
  setTimeout(() => $("#gPin")?.focus(), 50);
}

function notOnTeam(user) {
  show(`<p class="gerr">${esc(user.email)} isn't on the team list.</p>
    <p class="gmsg">Ask your admin to add this email under Settings → Access, or sign in with another account.</p>
    <button class="gbtn" id="gOut">Sign in with another account</button>`);
  $("#gOut").onclick = () => signOut(auth);
}

// ---------- flow ----------
async function check(user) {
  show(`<p class="gmsg">Signing in…</p>`);
  let t;
  try { t = await getDoc(doc(fs, "access/team")); }
  catch (e) { if (e.code === "permission-denied") return notOnTeam(user); return show(`<p class="gerr">Can't reach the database (${esc(e.code || e.message)}).</p><button class="gbtn" onclick="location.reload()">Try again</button>`); }
  if (!t.exists()) return setupScreen(user);
  team = t.data();
  if (!team.emails.includes(user.email.toLowerCase())) return notOnTeam(user);
  let u = null; try { u = await getDoc(doc(fs, "unlocked/" + user.uid)); } catch (_) {}
  if (!u || !u.exists()) return pinScreen(user);
  await enter(user);
}

let entered = false;
async function enter(user) {
  if (!team) { const t = await getDoc(doc(fs, "access/team")); team = t.data(); }
  // a cheap read that only passes if the PIN is still the current one
  try { await getDoc(doc(fs, "settings/main")); }
  catch (e) { if (e.code === "permission-denied") return pinScreen(user, "The team PIN has changed – enter the new one."); }
  me = team.names[user.email.toLowerCase()] || null;
  window.__fpReady = true;
  window.fpTeam = team; window.fpUser = { email: user.email.toLowerCase(), uid: user.uid };
  window.fpIsAdmin = (team.admins || []).includes(user.email.toLowerCase());
  hide();
  if (me && window.fpSetMe) window.fpSetMe(me);
  if (!entered) { entered = true; window.__fpResolveDb(DB); }
}

let rechecking = false;
async function recheck() {
  if (rechecking || !auth.currentUser) return; rechecking = true;
  try {
    const u = await getDoc(doc(fs, "settings/main")).then(() => true, e => e.code !== "permission-denied");
    if (!u) { window.__fpReady = false; pinScreen(auth.currentUser, "The team PIN has changed – enter the new one."); }
  } finally { rechecking = false; }
}

// ---------- admin helpers used by Settings → Access ----------
window.fpSignOut = async () => { await signOut(auth); location.reload(); };
window.fpSaveTeam = async (names) => {
  const emails = Object.keys(names);
  const admins = (team.admins || []).filter(a => emails.includes(a));
  if (!admins.length) throw new Error("The admin must stay on the list.");
  await setDoc(doc(fs, "access/team"), { emails, names, admins });
  team = { emails, names, admins }; window.fpTeam = team;
};
window.fpChangePin = async (pin) => {
  const b = writeBatch(fs);
  b.set(doc(fs, "access/pin"), { value: pin });
  b.set(doc(fs, "unlocked/" + auth.currentUser.uid), { pin, email: auth.currentUser.email.toLowerCase() });
  await b.commit();
};

getRedirectResult(auth).catch(e => signInScreen("Sign-in didn't work: " + (e.code || e.message)));
onAuthStateChanged(auth, user => {
  if (!user) { window.__fpReady = false; if (document.body.classList.contains("in-demo")) return; signInScreen(); return; }
  check(user);
});
