# Architecture Analysis: Single-Tenant to Multi-Tenant

## What We Have Today

### Single-Tenant Architecture

The Conservatory App is a **single-organization system**. Every piece of data — students, teachers, orchestras, lessons, attendance — lives in one MongoDB database (`Conservatory-DB`) with zero organizational boundaries. If two conservatories used this database simultaneously, their data would mix freely: teachers from Conservatory A would see Conservatory B's students, and setting the "current school year" for one would break it for the other.

### How the Current System Works

```
Browser → CORS (static whitelist) → Express middleware → authenticateToken
    → addSchoolYearToRequest → Controller → Service → MongoDB (global queries)
```

**Authentication flow:**
1. Teacher logs in with email + password
2. Server queries `teacher` collection globally: `{ 'credentials.email': email }`
3. JWT issued with payload: `{ _id, fullName, email, roles, version }` — no tenant context
4. On each request, middleware verifies JWT and loads the full teacher document
5. Middleware attaches `req.teacher`, `req.loggedinUser`, `req.user` — all without tenant info
6. School year middleware queries `{ isCurrent: true }` globally — shared across everyone

**Query pattern (every service, every collection):**
```javascript
// student.service.js — typical query
const students = await collection.find(criteria).toArray();
// criteria has: name, instrument, teacherId, isActive
// criteria does NOT have: tenantId, organizationId, conservatoryId
```

### What's Missing for Multi-Tenancy

| Layer | Current State | Problem |
|---|---|---|
| **Database** | Single DB name, hardcoded `'Conservatory-DB'` | No per-tenant isolation |
| **JWT tokens** | No `tenantId` in payload | Can't determine which org a request belongs to |
| **Auth middleware** | Sets `req.teacher` with no org context | No `req.tenantId` available |
| **All services** | Zero `tenantId` in any query filter | Data from all tenants mixed |
| **School year** | `{ isCurrent: true }` is global | Setting current year for one org affects all |
| **CORS** | Static origin whitelist | No dynamic subdomain support |
| **$lookup pipelines** | Join by `_id` only | Cross-tenant data leaks in aggregations |
| **Unique indexes** | `credentials.email` is globally unique | Same email can't exist in two conservatories |

### Numbers

- **14 collections** (8 core + 6 audit/system)
- **~200 query operations** across ~25 service files — all globally scoped
- **15 $lookup aggregation pipelines** — none include tenant filtering
- **5 different auth parameter patterns** across controllers (inconsistent)
- **0 references** to any tenant/org/conservatory concept anywhere in the codebase

### Critical Risk Points

1. **`school_year.setCurrentSchoolYear()`** — runs `updateMany({ isCurrent: true }, { $set: { isCurrent: false } })` affecting ALL school year records system-wide
2. **`time-block.checkStudentScheduleConflict()`** — scans ALL teachers' time blocks globally for conflicts
3. **`theory.bulkDeleteByCategory()`** — deletes ALL theory lessons matching a category, no org scope
4. **`auth.login()`** — queries by email globally; same email in two tenants would collide

---

## Multi-Tenant Options

### Option A: Shared Database, `tenantId` Column

**How it works:** Add a `tenantId` field to every document in every collection. Every query includes `tenantId` as a filter. One database, shared collections.

```javascript
// Before
await collection.find({ isActive: true });

// After
await collection.find({ tenantId: ctx.tenantId, isActive: true });
```

**Pros:**
- Simplest to implement — no infrastructure changes
- One deployment serves all tenants
- Easy cross-tenant analytics/reporting if ever needed
- Lower operational cost (one DB, one server)
- Standard pattern for SaaS apps at this scale

**Cons:**
- Risk of data leaks if a query forgets `tenantId` (bug = cross-tenant exposure)
- All tenants share DB performance (noisy neighbor)
- Every query is slightly slower (extra filter field)
- Requires touching every service file (~200 operations)

**Effort:** ~25 service files, ~15 controllers, ~200 query operations, JWT changes, middleware changes, validation updates, 15 $lookup pipeline updates, new compound indexes.

**Safeguard:** A `requireTenantId()` guard function that throws if `tenantId` is missing prevents accidental unscoped queries. Integration tests verify isolation.

---

### Option B: Database-per-Tenant

**How it works:** Each tenant gets their own MongoDB database (`Conservatory-Rishon-DB`, `Conservatory-Haifa-DB`, etc.). Middleware reads tenant from the request (subdomain, header, or JWT) and switches the database connection.

```javascript
// middleware
const tenantSlug = extractTenant(req); // from subdomain or JWT
req.db = client.db(`Conservatory-${tenantSlug}-DB`);

// service
const collection = req.db.collection('student');
await collection.find({ isActive: true }); // no tenantId needed in queries
```

**Pros:**
- Perfect data isolation — impossible to leak across tenants
- No query changes needed (no `tenantId` filter on every query)
- Independent backup/restore per tenant
- Can scale individual tenant DBs independently
- Simpler service code — queries stay as-is

**Cons:**
- Database connection management complexity (connection pooling per tenant)
- All standalone scripts need tenant-aware DB selection
- Cross-tenant reporting requires querying multiple databases
- Higher operational cost (more databases to manage, monitor, backup)
- `getCollection()` helper must become request-scoped (currently module-level)
- Migration scripts must run per-tenant
- More complex deployment and DevOps

**Effort:** Smaller code changes (middleware + `getCollection()` refactor), but larger infrastructure/operational effort. Every standalone script (migrations, repairs, seeds) needs multi-DB awareness.

---

### Option C: Hybrid — Shared DB Now, Split Later

**How it works:** Implement Option A (shared DB + `tenantId`) now. Design the `tenantId` integration so that swapping to database-per-tenant later only requires changing the data access layer, not every service.

```javascript
// utils/tenantGuard.js — used everywhere
export function requireTenantId(context) {
  if (!context?.tenantId) throw new Error('tenantId required');
  return context.tenantId;
}

// services use context object consistently
async function getStudents(filterBy, page, limit, context) {
  const tenantId = requireTenantId(context);
  const criteria = { tenantId, ..._buildCriteria(filterBy) };
  // ...
}
```

If you later want database-per-tenant, you modify `getCollection()` to route to the correct DB based on `context.tenantId`, and remove `tenantId` from query filters.

**Pros:**
- Get multi-tenancy working quickly with minimal infrastructure changes
- Clean migration path to database-per-tenant if needed
- Standardized `context` object fixes the 5 inconsistent auth patterns
- Single refactor addresses both multi-tenancy AND code quality issues

**Cons:**
- Same service-level effort as Option A
- "Future-proofing" adds some design overhead now

---

## Recommendation

### Option C (Hybrid) is the right choice for this project

**Why:**

1. **3 conservatories is small scale.** Database-per-tenant makes sense at 50+ tenants. At 3, the operational overhead of multiple databases isn't worth it.

2. **One deployment, one database** keeps hosting simple. You're on Render — one service, one MongoDB Atlas cluster.

3. **The `context` refactor is needed anyway.** The 5 different auth parameter patterns across controllers are a maintenance problem. Standardizing to `req.context` with `{ tenantId, userId, isAdmin, roles }` fixes multi-tenancy AND code quality.

4. **Migration path is clean.** If you grow to 20+ tenants and need database-per-tenant, the `context` object and `requireTenantId()` pattern make the switch straightforward.

5. **Risk is manageable.** The `requireTenantId()` guard + integration tests make unscoped queries fail loudly rather than silently leaking data.

---

## Implementation Strategy (Option C)

### Phase 1: Foundation (non-breaking)
- Create `tenant` collection + seed default tenant
- Backfill `tenantId` on all existing documents (additive — doesn't break current code)
- Create `tenantGuard.js` utility

### Phase 2: Auth + Middleware
- Add `tenantId` to JWT tokens
- Build `req.context` in auth middleware
- Update school year middleware to filter by `tenantId`

### Phase 3: Controllers + Services (largest phase)
- Refactor all controllers to pass `req.context`
- Refactor all services to accept `context` and add `tenantId` to queries
- Update all `$lookup` pipelines with tenant filtering
- Update all `_buildCriteria()` functions

### Phase 4: Indexes + Tests
- Add compound indexes with `tenantId` prefix
- Change `credentials.email` unique index to per-tenant unique
- Write tenant isolation integration tests

### Safe Rollout
- Phase 1-2 can be deployed without breaking the existing single-tenant setup
- Phase 3 is the breaking change — deploy only after all services are updated
- Existing users get the default tenant automatically; new tenants added via admin API

---

## Data Flow: Before vs After

### Before (Current)
```
Login: email → global teacher lookup → JWT { _id, roles }
Request: JWT → authenticateToken → req.teacher (no tenant)
Query: collection.find({ name: 'John' })  ← sees ALL Johns
```

### After (With tenantId)
```
Login: email + tenantId → scoped teacher lookup → JWT { _id, tenantId, roles }
Request: JWT → authenticateToken → req.context { tenantId, userId, isAdmin, roles }
Query: collection.find({ tenantId: 'abc', name: 'John' })  ← sees only tenant's Johns
```

### Login Challenge
Same email might exist in two conservatories. Two approaches:
- **Tenant-first login:** User selects conservatory before entering credentials (cleaner)
- **Email-first login:** System finds all tenants for that email, returns options (more convenient)

---

## Questions to Decide Before Starting

1. **How do users select their conservatory at login?** Subdomain (`rishon.rmc-music.org`), dropdown, or separate URL?
2. **Can a teacher belong to multiple conservatories?** If yes, the login flow needs tenant selection.
3. **Should there be a "super admin" role?** Someone who can see across all tenants for management/reporting.
4. **What's the timeline?** This is a ~2-3 week refactor touching ~40 files and ~200 query operations.
