# Fuse Point – Workflow

Event prep app for the Fuse Point team: planning, teachers & DJs, editing, approval and posting – with checklists and ready-made messages for the next person.

**App:** https://acl-create.github.io/Fuse-Point-Workflow/

## How access works
- Sign in with Google – only emails on the team list get in.
- Type the team PIN once per phone. Changing the PIN asks everyone for the new one.
- The admin manages team emails and the PIN in **Settings → Access**.

## Files
| File | What it is |
|---|---|
| `index.html` | The app |
| `firebase-gate.js` | Google sign-in, team PIN, first-time setup, database connection |
| `config.js` | Firebase project settings (not secret) |
| `firestore.rules` | Database security rules – paste into Firebase console → Firestore → Rules |
| `manifest.webmanifest`, `sw.js`, `icons/` | Makes it installable on phones with the Fuse Point icon |

## Install on a phone
- **iPhone (Safari):** open the app → Share → **Add to Home Screen**
- **Android (Chrome):** open the app → ⋮ → **Install app** / **Add to Home screen**
