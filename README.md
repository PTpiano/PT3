# PT3

Sito ufficiale di Peppe Taglieri: frontend React/Vite e API Next.js con
PostgreSQL, Vercel Blob e autenticazione JWT.

## Struttura

- `web/` — frontend React/Vite pubblicato alla radice del sito.
- `app/api/` — API Next.js.
- `lib/` — PostgreSQL, storage Vercel Blob, JWT, shop e video.
- `db/schema.sql` — schema del database.
- `public/` — immagini e audio statici.

La build compila la SPA, la copia in `public/index.html` e poi compila Next.js.
Le route `/api/*` restano servite da Next.js.

## Deploy su Vercel

1. Importa questo repository GitHub in Vercel.
2. Lascia la root directory sulla radice del progetto.
3. Aggiungi le variabili d'ambiente da `.env.example`.
4. Collega un database PostgreSQL e un Blob Store Vercel.
5. Applica lo schema una sola volta:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:init
   ```

6. Esegui il deploy. Il comando di build è già configurato in `vercel.json`.

## Sviluppo

```bash
npm ci
npm --prefix web ci
npm run dev
npm run dev:web
```

`npm run dev` avvia le API Next.js; `npm run dev:web` avvia la SPA Vite.
