# ReceivingX — Implementation Plan

Source spec: `ReceivingX.md`. Brand guide: `ampm-brand-personality.md` (see `docs/DESIGN.md`).

## 1. What we're building

A self-hosted web service for an office receiving dock. A receiver photographs each
package's shipping label / packing slip on their phone, the server OCRs it, the app
matches it to an open Sales Order line entered by the sales team, the receiver confirms
and checks it in, InvenTree gets a stock item + QR label for the warehouse, and one
summary email with all photos attached goes to USA Receiving, Accounting, and the sales
rep on the order.

## 2. Decisions

| Area | Decision |
|---|---|
| Capture device | Phone via the Next.js **PWA** (camera capture). No native app. |
| OCR | Self-hosted **PaddleOCR** FastAPI sidecar container (CPU). Our own field parser on top. Human always confirms. |
| Orders source | Sales team enters Sales Orders in-app + one-time **XLSX/CSV import** of the current spreadsheet. |
| Email | **Microsoft Graph API**, client-credentials app registration, sends as the USA Receiving mailbox. |
| Photo storage | **MinIO** (S3 API) in Docker. Swappable to S3/R2 via env. |
| Batching | **Receiving Session** -> check in N packages -> "Finish" -> one email per recipient. |
| Roles | `admin`, `receiver`, `sales`, `accounting`. |
| Partial receipts | Per-serial receipt records; line status `open / partial / received`. |
| Unmatched packages | Logged + flagged, linkable to an order later. |
| Locations | One office seeded, schema is multi-location ready. |
| InvenTree | Create StockItem via REST on check-in, store PK, print its QR. |
| Labels | Server-rendered PDF/PNG (4x6 and 2x1), browser print dialog. |
| Hosting | Docker Compose, fully self-hosted: web, server, postgres, minio, paddleocr. |
| Repo cleanup | Delete `apps/native` and `apps/fumadocs`. |

## 3. Data model (Prisma) — see `packages/db/prisma/schema/*.prisma`

Location, User(+role), Customer, Vendor, SalesOrder, SalesOrderLine, ReceivingSession,
Package, PackagePhoto, ExtractedField, SerialNumber, Notification, AuditLog,
ImportBatch, Setting.

## 4. tRPC surface

```
users.*                                          [admin]
customers.*, vendors.*                           [sales, admin]
orders.list/get/create/update/close              [sales, admin]
orders.lines.create/update/delete
orders.import.preview/commit                     [admin, sales]
receiving.session.start/get/current/finish/cancel   [receiver+]
receiving.package.createUpload -> presigned PUT
receiving.package.create/get/update/checkIn/void
receiving.package.suggestMatches / link / unlink
receiving.package.reocr
labels.render                                    [receiver+]
notifications.list/resend                        [admin]
reports.stock / export.csv|xlsx
settings.get/update                              [admin]
health.ocr / health.inventree / health.mail      [admin]
```

## 5. Build order

1. Cleanup + foundation (this doc, repo trim, roles/roleProcedure)
2. Schema + migrations + seed
3. Brand foundation (tokens, fonts, core components)
4. Storage (MinIO client + presigned uploads)
5. OCR client + parser
6. InvenTree client
7. Orders module (CRUD + import)
8. Receiving flow (sessions, capture, matching, check-in)
9. Labels (QR render + print)
10. Mailer (Graph) + email templates
11. Admin (users, settings, notifications, health) + reports/export
12. Hardening / deployment

## 6. Open items needing real-world input

- InvenTree base URL/token, target location/category, existing Parts or auto-create.
- Microsoft Graph app registration (tenant/client id/secret, sender mailbox UPN, admin consent).
- A copy of the real spreadsheet for import-column mapping.
- **5-15 real label/packing-slip photos through the app** to measure actual
  OCR+barcode quality now that the engine is fixed, before deciding on the
  PaddleOCR 3.x upgrade or an LLM/VLM field-extraction pass (see PLAN.md
  history - phases 4/5 of the OCR improvement work, deliberately gated on
  this measurement rather than done speculatively).
- Recipient list: USA Receiving address, accounting address(es), sales rep roster.
- Label stock size in the warehouse.
- Brand hex values / logo assets / official typeface (see DESIGN.md open items).

## 7. Status

Implemented:
- Full Prisma schema (Location, Customer, Vendor, SalesOrder/Line, ReceivingSession,
  Package, PackagePhoto, ExtractedField, SerialNumber, Notification, AuditLog,
  ImportBatch, Setting) + roles on User via better-auth admin plugin.
- `packages/storage` (MinIO/S3), `packages/ocr` (client + regex field parser),
  `services/ocr` (PaddleOCR FastAPI sidecar), `packages/inventree` (REST client,
  non-fatal on failure), `packages/mailer` (Microsoft Graph + branded HTML email).
- tRPC routers: users, locations, customers, vendors, orders (+lines +xlsx import),
  receiving (sessions, packages, upload, OCR trigger, matching, check-in, void),
  labels (QR PDF), notifications, reports (stock/CSV/XLSX), settings, health.
- Web app: dashboard, /receive capture+review flow, /orders (+new/import/[id]),
  /sessions (+[id] with resend + print label), /p/[publicId] QR landing,
  /admin/users/settings/notifications/health. Brand tokens + Figtree/Inter/JetBrains
  Mono fonts applied per docs/DESIGN.md.
- docker-compose: postgres, minio(+init), ocr sidecar, web, server.
- `db:seed` (demo data from the two ReceivingX.md example rows) and
  `db:promote-admin` (grant the admin role to a signed-up user).

Verified: `bun run check-types` and `bun run build` pass for all packages/apps.

**Deployed**: running on the home-lab server (192.168.1.224, `~/docker/receivingx`)
via `docker compose`, reachable at plain **`http://192.168.1.224:3001`** (web)
and `:3900` (API) - see root `.env` on the server for the port/URL overrides
used. Schema pushed and demo data seeded.

This intentionally does *not* go through the home-lab's Caddy `.lan` HTTPS
proxy: the proxy's cert is signed by a private root CA that isn't trusted by
default, and browsers report the resulting TLS failure as an opaque "CORS
request did not succeed" on cross-origin auth calls. Rather than require every
user to import that root CA, the app runs over plain HTTP on the bare IP.
Tradeoff: no TLS for this app. To switch to HTTPS later (via that Caddy/`.lan`
setup or a real cert), set `WEB_PUBLIC_SERVER_URL`/`WEB_PUBLIC_ORIGIN` (root
`.env`) and `BETTER_AUTH_URL`/`APP_URL` (`apps/server/.env`) to `https://...`
URLs and rebuild `web`+`server` - the auth cookie config
(`packages/auth/src/index.ts`) automatically switches to `Secure`+`SameSite=None`
when `BETTER_AUTH_URL` starts with `https://`.

Two real Docker-build bugs were found and fixed during this deploy: bun
doesn't run Prisma's postinstall (`prisma generate` must be invoked
explicitly - see the Dockerfiles), and Turborepo's strict env mode strips
`DATABASE_URL` from child tasks unless passed through, so that generate step
calls `prisma` directly rather than via `turbo`/`bun run db:generate`.

**OCR was completely broken, not just weak** (found while investigating a
"weak OCR" report): `services/ocr/Dockerfile` never installed `libgomp1`, so
`import paddleocr` threw on every request and every photo silently landed in
`NEEDS_REVIEW` with zero extracted fields. The `/health` endpoint didn't
actually exercise the engine, so this went unnoticed. Fixed, plus:
- `/health` now runs a real probe image through PaddleOCR and reports
  `{status, engine, error}` instead of just "is uvicorn up" - surfaced in
  `/admin/health`.
- **Barcode decoding** (`zxing-cpp`, Apache 2.0) runs alongside OCR and is
  treated as the highest-confidence signal (`packages/ocr/src/parser.ts
  classifyBarcodes`) - a Code128/DataMatrix serial is character-exact, where
  OCR can misread 0/O, 1/I, 5/S, 8/B on a hand-photographed label. Barcode
  matches win over OCR guesses for the same field.
- Capture flow (`/receive/[packageId]`) now EXIF-auto-orients, downscales to
  ~2000px, and re-encodes as JPEG client-side before upload (previously
  uploaded the raw camera file with no orientation correction, and never
  even recorded width/height).
- `services/ocr/main.py` also EXIF-transposes and caps dimensions
  server-side as a safety net for non-browser clients.

The PaddleOCR 2.9.1 -> 3.x/PP-OCRv5 engine upgrade was deliberately **not**
done in this pass (breaking API change, gate behind measuring real labels
first - see "Open items"). GPU acceleration was also deliberately skipped:
the server has an NVIDIA P102-100 (10GB, Pascal) physically present but no
driver loaded; everything above runs CPU-only on the server's 32 cores.

To create the first admin: sign up a normal account at
`http://192.168.1.224:3001/login`, then from the server run
`docker compose exec server sh -c "cd /app/packages/db && bun run prisma/promote-admin.ts you@example.com"`
(the running container already has `DATABASE_URL` set).

**Fixed post-deploy**: package photo upload/download used presigned S3 URLs
signed against the internal Docker hostname (`minio:9000`), which browsers
can't resolve - manifested as a silent "Load fail" on photo upload. Fixed by
adding `S3_PUBLIC_ENDPOINT` (`packages/storage`, `packages/env`) used only for
*signing* URLs, republishing the MinIO API port (`MINIO_API_PORT`, default
9000, set to 9002 on this server since 9000 was already taken), and setting
`S3_PUBLIC_ENDPOINT=http://192.168.1.224:9002` in `apps/server/.env`. Verified
end-to-end (sign up, start session, create package, request upload URL, PUT
bytes to MinIO - all 200).

Not yet built (see "Open items" above for blockers): background job queue for
OCR (currently synchronous per-photo), a jobs/queue package, automated tests,
and the real Microsoft Graph / InvenTree credentials.
