# Internal Kanban & Sprint Platform — Developer Spec

**Stack:** MERN (MongoDB Atlas M0, Express, React, Node) + Firebase Authentication
**Users:** 30+ internal, three roles: `admin`, `cgrade`, `employee`
**Hosting target:** free-tier (Render/Vercel/Railway)

This is the build spec. It assumes the fixes from architecture review are locked in — do not build the naive version of any item flagged below.

---

## 1. Roles & Permissions (enforced server-side only)

| Capability | admin | cgrade | employee |
|---|---|---|---|
| CRUD any task | Full | Read-only | No |
| CRUD own tasks | Full | Full | Full |
| Reassign tasks | Full | No | No |
| Manage users/roles | Full | No | No |
| View audit logs | Full | No | No |
| Org-wide reports | Full | Full | No |
| Personal reports | Full | Full | Full |
| Publish events | Full | Propose only (pending approval) | Read-only |

**Authority source:** Firebase **Custom Claims**, not the MongoDB `role` field. MongoDB's `role` is a display/query mirror only. Server never trusts a role read from the DB alone.

**Non-negotiable rule:** every route re-checks role/ownership server-side. The frontend hiding a button is UX only, never the security boundary.

---

## 2. Data Model

### `User`
```
firebaseUid   String, indexed, unique
name          String
email         String, unique
role          enum: admin | cgrade | employee   // mirror of Firebase custom claim
department    String
```

### `Task`
```
title         String
description   String
status        enum: todo | in_progress | halted | completed | cancelled
              // ⚠ 5 states only — "Comments/Reminders" is NOT a status.
              //   Comments/reminders live in the Comment collection below.
priority      enum: low | medium | high | urgent
assignee      ObjectId -> User, indexed
createdBy     ObjectId -> User
sprintId      ObjectId -> Sprint, indexed        // see §5
dueDate       Date, indexed
completedAt   Date
order         Number      // per-status-column position, for drag-and-drop
isDeleted     Boolean, default false   // soft delete — never hard-delete a task
updatedAt     Date        // used for optimistic-concurrency checks (see §4)
tags          [String]
```

### `Comment` / `ActivityLog` (one collection, `type` field distinguishes)
```
task        ObjectId -> Task, indexed
author      ObjectId -> User
type        enum: comment | status_change | reassignment
content     String            // comment text, if type = comment
oldStatus   String            // structured, not prose — required if type = status_change
newStatus   String            // structured, not prose — required if type = status_change
timestamp   Date
```
Structured `oldStatus`/`newStatus` fields (not free text) are required — this is what makes cycle-time/velocity reporting queryable later.

### `Event`
```
title       String
eventType   enum: sprint_review | webinar | all_hands | roadmap
date        Date, indexed
description String
status      enum: published | pending_approval
createdBy   ObjectId -> User
```

### `Sprint` (new — see §5)
```
sprintNumber  Number
startDate     Date
endDate       Date
status        enum: active | completed | archived
summary       Object   // permanent denormalized stats, survives task deletion
              // { completedCount, avgCycleTimeHours, byAssignee: {...} }
```

### Indexes
`Task`: `assignee`, `status`, `dueDate`, `sprintId`
`User`: unique on `firebaseUid`, `email`
`Comment`: `task`

### Shared enums
Status and priority values live in **one shared constants file**, imported by both client and server. Never hardcode the list in more than one place.

---

## 3. API Surface

All routes sit behind: (1) Firebase token verification middleware → (2) RBAC middleware. 401 for invalid/missing token, 403 for wrong role — before any DB call.

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| POST | `/api/auth/session` | any authenticated | Exchange Firebase token, link/create User doc |
| GET | `/api/auth/me` | any authenticated | Return profile + role |
| GET | `/api/users` | admin | List users |
| POST | `/api/users` | admin | Provision user |
| PATCH | `/api/users/:id/role` | admin | Change role — **must update Firebase custom claim, not just Mongo** |
| GET | `/api/tasks/personal` | any | Server filters `assignee === req.user.uid`. Field-projected (board fields only). |
| GET | `/api/tasks/org?filters=...` | admin (all), cgrade (scope), employee (read-only) | Server-side filtering, not client-side |
| POST | `/api/tasks` | any (own), admin (any) | — |
| PATCH | `/api/tasks/:id` | admin (any), owner (own) | Must include `updatedAt` — see §4 |
| PATCH | `/api/tasks/:id/status` | admin, owner | Writes structured ActivityLog entry |
| PATCH | `/api/tasks/:id/reassign` | admin only | — |
| DELETE | `/api/tasks/:id` | admin only | **Soft delete** — sets `isDeleted`, never removes the doc |
| GET/POST | `/api/tasks/:id/comments` | any with task visibility | — |
| GET/POST | `/api/events` | any (GET), admin/cgrade (POST) | cgrade POST → `pending_approval` |
| PATCH | `/api/events/:id/approve` | admin only | — |
| GET | `/api/reports/org?format=csv` | admin, cgrade | Streamed, not buffered — see §6 |
| GET | `/api/reports/self?format=csv\|pdf-data` | any | Returns pre-scoped data only; PDF renders client-side from this response |
| POST | `/api/sprints/:id/archive` | admin (or scheduled job) | Triggers export → verify → delete pipeline, §5 |

---

## 4. Concurrency Control

30 people can touch the same board simultaneously. Bare `PATCH` overwrites are not acceptable.

- Every `PATCH /api/tasks/:id` includes the client's last-known `updatedAt`.
- Server uses `findOneAndUpdate({ _id, updatedAt: lastKnownValue }, ...)`.
- No match → **409**, not a silent overwrite.
- Client must handle 409 explicitly: show a conflict toast, offer refetch/merge. Do not auto-retry blindly.

---

## 5. Sprint Data Lifecycle

Sprints are weekly. Storage is not actually under pressure at this scale (~100–150KB/week of raw task data), so retention should not be cut to 2 sprints — that trades away trend reporting and dispute-resolution history for negligible storage savings. Build this instead:

1. **`Sprint` is a real collection** (see §2) — tasks reference `sprintId` explicitly. Don't infer sprint boundaries from timestamps after the fact.
2. **On sprint completion:** export full relational data (Task + ActivityLog + Comment documents for that `sprintId`) as raw JSON — not just the human-readable report CSV/PDF, which drops relational detail.
3. **Store exports in Firebase Storage** (or another durable bucket) — **never on the app server's local disk**. Free-tier hosts wipe local disk on redeploy/cold-start.
4. **Export → verify → grace period → delete**, never export-then-immediately-delete in one step. Verify document/row counts match before deleting anything.
5. **Write a permanent summary** to `Sprint.summary` (completedCount, avgCycleTime, byAssignee) before pruning raw detail — this is what keeps long-term trend reporting alive even after old task documents are gone.
6. Recommended retention: full detail for a full quarter (~13 sprints) is still a small fraction of the 512MB M0 ceiling; prune on a longer horizon than "2 sprints," or make the window configurable rather than hardcoded.

---

## 6. Reporting

- `/api/reports/*` endpoints enforce the same server-side scoping as board endpoints — the fix for the original data-leakage risk. Client-side code only ever touches data it was already authorized to receive.
- CSV export streams row-by-row (`json2csv` pipe) — do not buffer full org-wide exports in memory on free-tier hosting.
- PDF is generated **client-side** (jsPDF/pdfmake) from the already-scoped API response — this is the correct division: server enforces scope, client just formats.
- Reports **snapshot data at export time** rather than live-joining current DB state, so a task deleted/archived after a report was generated still resolves correctly in that report.
- Required columns: Task ID, Title, Assignee, Priority, Status, Created Date, Due Date, Completion Date, Time-to-Complete (computed server-side as `completedAt - createdAt`).

---

## 7. Security Checklist

- `helmet()`, `cors()` locked to the exact frontend origin.
- `express-rate-limit`: global default + a tighter limit specifically on `/api/reports/*` (highest-value target for scraping/abuse).
- Input validation (Zod/Joi) on every mutating endpoint, before Mongoose ever sees the payload.
- Role changes must call `getIdToken(true)` (force refresh) client-side, or the newly-promoted user gets phantom 403s until next login.
- No hard deletes anywhere — `isDeleted` flag on Task; audit-log entries are themselves never pruned by the sprint-archival job.
- Scheduled backup job (`mongodump`/`mongoexport` → external storage) — M0 has no built-in backups. Document the restore steps before go-live, not after an incident.

---

## 8. UI Structure (5 pages)

1. **User Dashboard** — personal board, 5 columns, quick-create modal, task detail drawer (comments/reminders live here, not as a column).
2. **Organization Dashboard** — org-wide board, server-side filters (assignee/status/priority/due-date range), admin-only reassign/delete, stale-task flag (red border if `halted` + `updatedAt` > 48h), polling refresh every 10–15s via React Query.
3. **Reporting & Analytics** — config panel (range, scope, format) → preview → export.
4. **Planning & Events Hub** — chronological feed, tag filters, admin publish / cgrade propose-and-approve flow.
5. **Deadlines Calendar** — FullCalendar scoped to visible date range, color-coded by priority, auto-hides completed tasks, click-through to the same detail drawer used on the boards.

---

## 9. Explicit Non-Decisions (already made — don't relitigate mid-build)

- **Real-time:** polling (React Query, 10–15s), not WebSockets. Socket.io on free-tier hosting cold-starts and will be flakier than polling at this scale.
- **PDF generation:** client-side, always, from pre-scoped data. Never server-side (CPU cost on free tier) and never from an unscoped fetch (data leakage).
- **Deletes:** soft only, everywhere, except the verified sprint-archival pipeline in §5.
- **Kanban lanes:** 5 lifecycle states. Comments/reminders are not a 6th lane.

---

## 10. Build Order (condensed)

1. Infra & secrets → 2. Schemas/indexes/enums → 3. Auth + custom claims + RBAC middleware → 4. Task API (scoping, concurrency, soft delete, activity log) → 5. User Dashboard → 6. Org Dashboard → 7. Reporting → 8. Planning Hub + Calendar → 9. Security hardening pass → 10. Load test, UAT, deploy, phased rollout.

Full phase-by-phase detail with rationale for each step is in the earlier roadmap discussion — this document is the reference to build against, that one is the sequencing.
