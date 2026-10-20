# Harness Gen 3 ASE plan

The strategy and delivery plan for the Harness, as a small web app: roadmap, Gantt, to-dos, team and leave,
initiatives, synthetic workers, Estate Management and the SMART pipeline. Everyone with access sees the same plan.
Changes save straight away and appear in every open browser without a refresh. Each recorded version is also saved
as a read-only HTML file that opens anywhere, with no app and no editing.

## Run it on your own machine

You need Node.js 22.13 or later (it uses Node's built-in SQLite, so there is no `npm install`).

1. Create a file called `.env` next to `server.js` with the password (and, optionally, your name):

   ```
   APP_PASSWORD="choose-a-password"
   LOCAL_USER="Your Name"
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Open <http://localhost:4730> and sign in with the password.

On first run the app creates `data/` and loads the draft plan into it. `npm start` loads `.env` for you; if you run
`node server.js` directly, add `--env-file=.env`. The server will not start without `APP_PASSWORD` (see below).
No `npm install` is needed to run locally; it is only needed for the Netlify test (`npm run test:netlify`).

## Where the plan is stored

The same code runs locally and on Netlify; only the storage back end differs, and it is chosen automatically:

- **Locally:** files under `data/kv/` (one file per plan item, plus photos and saved exports).
- **On Netlify:** [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), Netlify's built-in
  storage, in a store called `harness-plan`. No separate database is needed.

Each plan item (an action, a person, a to-do, …) is its own record, so people editing different items never touch
the same record and no change is lost. If two people save the same item at the same moment, the last save wins.
Open browsers check for changes every 15 seconds (paused while the tab is hidden) and reload only what changed.

**Moving from the original SQLite storage:** the first time this version starts locally, it moves everything from
`data/plan.db` (with `data/uploads/` and `data/exports/`) into `data/kv/`. Nothing is deleted: `plan.db` is renamed
to `plan.db.migrated-<date>`.

**Moving the plan between your computer and Netlify:** open the version history (click the Version label), choose
**Download backup** on one, then **Restore from a backup…** (edit mode) on the other. A backup holds the whole plan,
the people who have used it and the photos. Saved read-only exports are not included.

## Password and sign-in

The whole app sits behind one shared password.

- Every page, the plan data, photos and exports need a sign-in cookie. Without one, pages go to the sign-in page
  and data calls are refused.
- Signing in sets a session cookie for 14 days (`SESSION_DAYS`). It is `HttpOnly` (scripts on the page cannot read
  it), `SameSite=Lax`, and `Secure` when the site is served over HTTPS. The cookie holds only an expiry time and a
  signature, so it cannot be forged without the server's secret.
- **Changing the password signs everyone out**, because the cookie signature depends on it.
- People can give their name when signing in; it is shown on the changes they make.
- **Sign out** is at the top right of the plan.
- After 10 wrong passwords from one address in 15 minutes, that address is locked out for 15 minutes.
- Changes must come from the app's own pages (requests from other sites are refused), and search engines are asked
  not to index the site.
- **Fails closed:** if `APP_PASSWORD` is not set, the server refuses to start rather than run open. (The only
  exceptions are `AUTH_MODE=easyauth`, where Azure signs people in, or `ALLOW_NO_PASSWORD=1` set on purpose.)

Keep the password out of version control: `.env` is listed in `.gitignore` and `.dockerignore`. On a host, set
`APP_PASSWORD` as an app setting or secret instead.

Downloaded read-only exports are ordinary files: anyone you give one to can open it without the password.

## How to use it

- The plan opens **read-only**. Use the **Read-only / Edit mode** switch at the right of the tab bar to make changes.
- In edit mode, drag Gantt bars to move them or drag either end to change a date. Click any action, initiative,
  to-do, person or leave entry to edit it. Add initiatives, links and headshots.
- Click the **Version** label in the header to see the version history.

## Read-only HTML exports

- **Record a version** (version history, in edit mode). The app saves a read-only copy of the plan as it stands,
  for example `harness-plan-v0.7-2026-10-20-1540.html`, and links it from that version in the history.
- **Download read-only copy** in the header downloads the plan as it stands now, without recording a version.

An export is one self-contained HTML file: the plan data and people's photos are inside it. It opens from disk,
email or any static web host, has no edit controls and never contacts the app. Saved exports are kept with the plan (locally in `data/kv/export/`).

## Settings

| Variable            | Default            | What it does |
| ------------------- | ------------------ | ------------ |
| `APP_PASSWORD`      | none (required)    | The shared password. The server will not start without it. |
| `SESSION_DAYS`      | `14`               | How long a sign-in lasts. |
| `SESSION_SECRET`    | generated          | Secret used to sign cookies. If unset, one is generated once and kept with the plan. |
| `PORT`              | `4730`             | Port to listen on (`8080` in the container). |
| `DATA_DIR`          | `./data`           | Locally, where the plan is kept (in `kv/`: plan items, photos, exports and the sign-in secret). |
| `AUTH_MODE`         | `none`             | `none`: password sign-in; people are named by what they give at sign-in, else `LOCAL_USER`. `easyauth`: Azure App Service Authentication signs people in with Microsoft accounts (see below). |
| `EDITORS`           | `*`                | With `easyauth`, the sign-in names (emails) allowed to edit, comma separated. `*` lets everyone who signs in edit. |
| `READ_ONLY`         | unset              | Set to `1` to make the whole app read-only. |
| `LOCAL_USER`        | your OS user name  | The name shown on changes when someone signs in without giving a name. |
| `ALLOW_NO_PASSWORD` | unset              | Set to `1` to run without a password. For local experiments only; never on a public address. |
| `COOKIE_SECURE`     | unset              | Set to `1` to force `Secure` cookies if your host's HTTPS proxy does not send `X-Forwarded-Proto`. |
| `BLOBS_STORE`       | `harness-plan`     | On Netlify, the name of the Blobs store holding the plan. |
| `BLOBS_REGION`      | `eu-central-1`     | On Netlify, where the Blobs store keeps its data (`us-east-1`, `us-east-2`, `eu-central-1`, `ap-southeast-1`, `ap-southeast-2`). |

## Deploy to Netlify

The repository is ready for Netlify (`netlify.toml`). Every request goes to one Netlify Function
(`netlify/functions/app.mjs`) that runs the same app as the local server, so every page stays behind the password;
nothing in the plan is published as an open static file.

1. Put this folder in a Git repository (GitHub, GitLab or Azure DevOps) and push it. `.env`, `data/` and
   `node_modules/` are ignored, so neither the password nor your local plan is uploaded.
2. In Netlify, **Add new project > Import an existing project**, and pick the repository. Netlify reads the build
   settings from `netlify.toml`; leave them as they are.
3. Before the first deploy, open **Project configuration > Environment variables** and add `APP_PASSWORD`. Without
   it the site shows a "not configured yet" message instead of the plan.
4. Deploy. The first visit loads the draft plan. To bring over your local plan instead: download a backup locally,
   sign in to the Netlify site, switch on edit mode, and **Restore from a backup…**.

Netlify serves the site over HTTPS, so the sign-in cookie is sent securely.

Things to know:

- **Where the data lives:** Netlify Blobs has no UK region; the store is in Frankfurt (`eu-central-1`) by default.
  Change it with `BLOBS_REGION` before the first deploy (data does not move if you change it later).
- **Free plan limits:** each open browser makes one small request every 15 seconds while visible. A handful of
  people using the plan through the working day fits Netlify's free allowance; check your usage under **Usage**.
- **Uploads** are limited to 4 MB per photo, and a backup to about 5 MB to restore (Netlify Functions accept about
  6 MB per request). Photos are cropped to 320 px before upload, so this is ample.
- **Test locally first:** `npm install` then `npm run test:netlify` runs the real function against Netlify's own
  local Blobs server and checks sign-in, saving (including ten saves at once), photos, exports, backup and restore.

## Deploy to Azure App Service

The app ships as a container (see `Dockerfile`). Run it on HTTPS so the sign-in cookie is sent securely.
Replace the names in angle brackets below.

```bash
# 1. Build and push the image
az acr create -g <resource-group> -n <registry> --sku Basic
az acr build -g <resource-group> -r <registry> -t harness-plan:0.8 .

# 2. Create the web app from the image
az appservice plan create -g <resource-group> -n <plan> --is-linux --sku B1
az webapp create -g <resource-group> -p <plan> -n <app-name> -i <registry>.azurecr.io/harness-plan:0.8

# 3. Keep data on App Service's persistent /home share, HTTPS only, and set the password
az webapp update -g <resource-group> -n <app-name> --https-only true
az webapp config appsettings set -g <resource-group> -n <app-name> --settings \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=true WEBSITES_PORT=8080 DATA_DIR=/home/data \
  APP_PASSWORD="<the password>"
```

Optionally, for Microsoft sign-in instead of the shared password: set `AUTH_MODE=easyauth` and `EDITORS`, then in
the portal open the web app, **Authentication > Add identity provider > Microsoft**, choose your organisation's
tenant and set **Restrict access** to **Require authentication**. Every change is then recorded against a real name.

The app keeps one SQLite file on the `/home` share, which suits a single instance (the B1 plan). Do not scale
out to several instances with this storage. If you need that, move the store (`src/store.js`, about 80 lines)
to Azure Database for PostgreSQL.

Back up the plan with **Download backup** in the version history, or by copying `/home/data/kv`.

## Project layout

```
server.js                   local server: adapts Node's HTTP server to the app
netlify/functions/app.mjs   Netlify Function: runs the same app on Netlify
src/app.js                  the app: sign-in gate, pages, plan API, photos, exports, backup and restore
src/store.js                plan storage on top of a key-value store
src/kv/fs.js                key-value store as local files
src/kv/netlify.js           key-value store on Netlify Blobs
src/gate.js                 password sign-in, session cookies, lockout and the sign-in page
src/identity.js             who is making a change and whether they may edit
src/snapshot.js             builds the read-only HTML exports
src/seed.js                 loads the draft plan into empty storage
src/migrate.js              one-time move from the original SQLite storage
scripts/build-netlify.mjs   Netlify build step: bundles the page files into the function
scripts/test-netlify.mjs    local test of the Netlify setup (npm run test:netlify)
public/plan.html            the plan page (all views, styles and the draft plan)
public/adapter.js           connects the page to the server, or to the data inside an export
netlify.toml, Dockerfile    deployment settings for Netlify and for a container host
```

`public/plan.html` is also published as a Claude artifact. There, Claude's own runtime takes the place of
`adapter.js`, so the same page works in both places.
