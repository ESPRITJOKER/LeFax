# Lefax Course

Plateforme web de préparation aux concours (Médecine en premier). Voir `CDC-WEB-2026-001` pour le cahier des charges complet.

## Structure

```
apps/
  web/        React 18 + Vite + TS + Tailwind — étudiant / enseignant / admin
  api/        Fastify + TS — API REST partagée web + mobile (futur)
packages/
  shared/         Types + schémas Zod partagés entre web et api
  design-tokens/  Preset Tailwind extrait du design system Stitch (DESIGN.md)
supabase/
  migrations/     Schéma SQL versionné
  scripts/        Runner de migration (Node, pas besoin de Supabase CLI)
```

## Démarrage local

```bash
pnpm install
cp .env.example apps/api/.env      # renseigner SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, JWT_*
cp .env.example apps/web/.env      # VITE_API_URL suffit en local

pnpm db:migrate                    # applique supabase/migrations/*.sql au projet Supabase
pnpm dev:api                       # http://localhost:4000
pnpm dev:web                       # http://localhost:5173
```

En développement, `SMS_PROVIDER=console` fait que les codes OTP sont affichés dans les logs de l'API au lieu d'être envoyés par SMS — aucun compte Africa's Talking n'est nécessaire pour tester l'inscription/connexion.

## Scripts racine

- `pnpm dev:api` / `pnpm dev:web` — serveurs de dev
- `pnpm build` — build de tous les packages/apps
- `pnpm lint` / `pnpm typecheck` — sur tout le monorepo
- `pnpm db:migrate` — applique les migrations SQL au projet Supabase configuré
