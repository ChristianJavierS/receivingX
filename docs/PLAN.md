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
- Sample label/packing-slip photos to tune the OCR parser.
- Recipient list: USA Receiving address, accounting address(es), sales rep roster.
- Label stock size in the warehouse.
- Server specs (CPU/RAM) for the OCR sidecar.
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
via `docker compose`, reachable at `https://receiving.lan` (web) and
`https://receiving-api.lan` (API), proxied through the existing Caddy instance
(`~/reverse-proxy/Caddyfile`). Direct IP:port access also works:
`http://192.168.1.224:3001` (web) / `:3900` (server) - see root `.env` on the
server for the port/URL overrides used. Schema pushed and demo data seeded.
`.lan` hostnames only resolve for devices pointed at the home-lab DNS
(192.168.1.224) with its root CA trusted - see that server's
`~/PROJECT-README.md` for client setup, otherwise use the IP:port form.

Two real Docker-build bugs were found and fixed during this deploy: bun
doesn't run Prisma's postinstall (`prisma generate` must be invoked
explicitly - see the Dockerfiles), and Turborepo's strict env mode strips
`DATABASE_URL` from child tasks unless passed through, so that generate step
calls `prisma` directly rather than via `turbo`/`bun run db:generate`.

To create the first admin: sign up a normal account at
`https://receiving.lan/login`, then from the server run
`docker compose exec server sh -c "cd /app/packages/db && bun run prisma/promote-admin.ts you@example.com"`
(the running container already has `DATABASE_URL` set).

Not yet built (see "Open items" above for blockers): background job queue for
OCR (currently synchronous per-photo), a jobs/queue package, automated tests,
and the real Microsoft Graph / InvenTree credentials.
