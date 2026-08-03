# Database migrations — required workflow

This project ships two **separate, independent** SQLite files: the local dev
database (`prisma/dev.db` on the developer's machine) and the VPS production
database (`prisma/dev.db` on the VPS, currently `/var/www/hole-six`). They are
physically different files with no shared connection — schema changes must be
applied to each one explicitly, or they drift apart.

Earlier in this project's history, schema changes were applied inconsistently
(sometimes `prisma db push`, sometimes hand-run SQL, sometimes proper migration
files), which caused the two databases' schemas to diverge and required several
one-off "sync" migrations (e.g. `20260803120000_sync_schema_with_client`) to
reconcile them. To stop this from recurring, follow this workflow exactly:

- **Local, whenever `prisma/schema.prisma` changes:** run
  `npx prisma migrate dev --name <short_description>`. This both generates a
  numbered migration file under `prisma/migrations/` AND applies it to the
  local `dev.db` in one step. Commit the generated migration folder.
- **Never run `prisma db push`** in this project (local or VPS) — it changes
  the database without recording what changed, which is exactly what caused
  the drift.
- **On the VPS, after `git pull`:** run `npx prisma migrate deploy` (not
  `db push`, not `migrate dev` — `migrate dev` can prompt to reset the
  database, which must never happen against the live demo data). This applies
  any migration files that haven't been applied yet, using the same
  migration files as local, so both databases evolve identically.
- If `npx prisma migrate status` ever reports drift on either machine, treat it
  as a bug to root-cause (what command was run outside this workflow), not
  something to silently paper over with a fresh `db push`.
