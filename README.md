# branching_practice-
This project is a GitHub collaboration practice repo.

## Folio landing page

A responsive HTML/CSS/JavaScript landing page with a sage-green visual identity, an original CSS illustration, and working registration, login, session restoration, and logout.

### Run locally

Install Node.js 20 or newer, then run these commands inside this folder:

```sh
npm start
```

Open http://localhost:3000. No dependencies or installation step are required. You can open `index.html` directly to view the design, but authentication requires the server.

### Authentication

Passwords use salted scrypt hashes. Accounts persist in the ignored `data/users.json`; passwords are never saved in plain text. Random session tokens use HttpOnly, SameSite cookies, expire after 24 hours, and are invalidated on logout. Sessions are held in server memory and reset when the server restarts. Authentication attempts are rate limited. The account screen is intentionally a welcome screen; no workspace tools are implied.

This is a local starter. Before public deployment, use HTTPS, set `NODE_ENV=production` and `APP_ORIGIN` to the exact HTTPS origin, place the server behind a reverse proxy, and use a managed database/session store, email verification, and account recovery. The server listens on loopback by default. Google Fonts are optional; local fallback fonts are provided.

Run `npm run check` to check JavaScript syntax.
