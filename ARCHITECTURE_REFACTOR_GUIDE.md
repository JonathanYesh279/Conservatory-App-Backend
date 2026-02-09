# Conservatory App - Architecture & Production Roadmap

> **Created:** February 6, 2026
> **Purpose:** Honest assessment of the codebase, prioritized action plan, and production hardening roadmap
> **Status:** Ready for Review

---

## Table of Contents

1. [Current State: What's Working & What's Not](#current-state)
2. [The Scheduling Architecture (Clarified)](#scheduling-architecture)
3. [The Real Data Duplication Problem](#data-duplication)
4. [Phase 0: Security Fixes — Non-Negotiable (1-2 days)](#phase-0)
5. [Phase 1: Finish the Schedule Migration (1-2 weeks)](#phase-1)
6. [Phase 2: Production Hardening (2-3 weeks)](#phase-2)
7. [Phase 3: High-Impact Features — When Needed](#phase-3)
8. [Explicit Non-Goals](#non-goals)
9. [Risk Warnings & Rollback Plan](#risks)
10. [After POC: Expansion Path](#expansion)

---

## Current State: What's Working & What's Not <a name="current-state"></a>

### Strengths (What to Keep)

| Area | Rating | Notes |
|------|--------|-------|
| Feature-based module structure | 8/10 | Clean `api/{feature}/` organization with controller, service, validation, route per module |
| Joi validation schemas | 8/10 | Comprehensive input validation on all models, separate create vs update schemas |
| Auth & security baseline | 7/10 | JWT + refresh tokens, helmet, mongo sanitization, rate limiting (with critical gaps — see Phase 0) |
| Transaction support | 7/10 | `withTransaction()` helper for atomic operations in critical paths |
| Error handling | 7/10 | Global error handler middleware, try-catch everywhere, Joi error parsing |
| Test infrastructure | 6/10 | Vitest + mongodb-memory-server + supertest setup, 46 test files exist |

### Critical Issues (Must Fix)

| Issue | Severity | Where | Phase |
|-------|----------|-------|-------|
| Password logged in console | CRITICAL | `auth.controller.js:28` | 0 |
| 6 unprotected admin endpoints | CRITICAL | `auth.route.js:17-22` | 0 |
| IDOR — teachers see all students | CRITICAL | `student.service.js` — no teacher filtering | 0 |
| 12-hour access tokens | HIGH | `auth.service.js:7` | 0 |
| Half-finished schedule migration | HIGH | 80+ refs to old system, attendance hardcoded to old system | 1 |
| Data written to 4 places on enrollment | HIGH | See [Data Duplication](#data-duplication) section | 1 |
| Attendance service only works with `teaching.schedule` | HIGH | `attendance.service.js:34-81` | 1 |

### Medium Issues (Fix When Convenient)

| Issue | Where | Notes |
|-------|-------|-------|
| Inconsistent response formats | All controllers | Some return raw data, some `{ success, data }`, auth uses both |
| Service files too large | `student.service.js` (1,242 lines), `teacher.service.js` (1,161 lines), `theory.service.js` (1,188 lines) | Hard to maintain and test |
| Duplicate dependencies | `package.json` | Both `bcrypt` AND `bcryptjs`; `mongoose` installed but never used |
| Debug logging in production | `orchestra.service.js:20-123` | Hardcoded `console.log` with specific ObjectId debugging |
| Inconsistent validation location | Various | Sometimes in controller, sometimes in service |

---

## The Scheduling Architecture (Clarified) <a name="scheduling-architecture"></a>

There are two scheduling systems. **They solve different problems and are NOT duplicates.**

### System 1: `teaching.schedule` — Flat Lesson Slots

Each entry is a single lesson slot. An empty slot represents availability; a filled slot represents an enrolled lesson.

```
teacher.teaching.schedule[] = [
  {
    _id, studentId (null if open), day, startTime, endTime,
    duration, isAvailable (true if open), location, recurring
  }
]
```

**How it works:**
1. Admin creates a slot: `{ day: "ראשון", startTime: "09:00", duration: 45, studentId: null, isAvailable: true }`
2. Student enrolls: `studentId` is set, `isAvailable` becomes `false`
3. Student leaves: `studentId` is cleared, `isAvailable` becomes `true`

**Limitation:** To represent a teacher available 08:00–16:00, you'd need to create ~16 individual 30-min slots upfront.

### System 2: `teaching.timeBlocks` — Availability Windows with Nested Lessons

Each entry is a large availability window. Lessons are carved out of it dynamically.

```
teacher.teaching.timeBlocks[] = [
  {
    _id, day, startTime, endTime, totalDuration, location, isActive,
    assignedLessons: [
      { _id, studentId, lessonStartTime, lessonEndTime, duration, isActive }
    ]
  }
]
```

**How it works:**
1. Admin creates a block: `{ day: "ראשון", startTime: "08:00", endTime: "16:00" }`
2. `calculateAvailableSlots()` finds free gaps between existing lessons
3. Student enrolls → a lesson is added to `assignedLessons[]` within the block
4. Student leaves → lesson is marked `isActive: false`

**Advantage:** One block covers the whole availability window. Smart slot calculation finds openings automatically.

### Current State: Half-Finished Migration

The codebase is mid-migration from System 1 to System 2. Critically, **the frontend has already migrated** — it's the backend that's lagging behind.

#### Backend Status (still split)

| Operation | Uses which system? |
|-----------|-------------------|
| **Creating** new availability | System 2 — `POST /schedule/teacher/:id/slot` proxies to `createTimeBlockProxy` |
| **Assigning** student to slot | System 1 — `schedule.service.js:263` writes to `teaching.schedule` |
| **Assigning** lesson to block | System 2 — `time-block.service.js:419` writes to `teaching.timeBlocks` |
| **Attendance** (old service) | System 1 ONLY — `attendance.service.js` hardcoded to `teaching.schedule` |
| **Cascade deletion** cleanup | System 1 ONLY — `cascadeDeletion.service.js:202-302` |
| **Weekly schedule** display | System 1 — `schedule.service.js:43` reads `teaching.schedule` |
| **Student sync** functions | System 2 — `student.service.js:939-1079` syncs to `teaching.timeBlocks` |
| **Relationship repair** | System 1 ONLY — `repair-relationships.js:123-239` |

#### Frontend Status (already migrated)

| Operation | What the frontend calls | Old system used? |
|-----------|------------------------|-----------------|
| **Display teacher schedule** | `GET /teacher/{id}/lessons` + `GET /teacher/{id}/weekly-schedule` | **Fallback only** — `ScheduleTab.tsx:168` reads `teaching.schedule` when API returns empty |
| **Manage availability** | `POST/PUT/DELETE /teacher/{id}/time-block` | No |
| **Assign student to teacher** | `POST /student/{id}/teacher-assignment` | No |
| **Remove student** | `DELETE /student/{id}/assignment/{id}` | No |
| **Mark attendance** | `POST /attendance/individual` | No — uses separate attendance collection |
| **View attendance** | `GET /attendance/individual?studentId=...&date=...` | No |
| **Old schedule slot endpoints** | **Not called at all** — no references to `/api/schedule/assign` | Dead code |

**Key insight:** The frontend calls `/attendance/individual` which hits a separate attendance code path — NOT the `attendance.service.js` that's hardcoded to `teaching.schedule`. The old `assignStudentToSlot()` and `removeStudentFromSlot()` in `schedule.service.js` appear to be **dead code** from the frontend's perspective.

The frontend also handles response format inconsistency gracefully with `response.data || response` everywhere, meaning response standardization is low priority.

**Migration tools exist but haven't fully run:**
- `api/schedule/migrate-to-time-blocks.js` — converts schedule → timeBlocks
- `migrations/sync-teacher-student-lessons.js` — Phase 4 attempts to `$unset teaching.schedule`

**Result:** Depending on when a teacher/student was created, their data could be in either system. But only the backend still references the old system in active code paths.

---

## The Real Data Duplication Problem <a name="data-duplication"></a>

When a student enrolls with a teacher, data is written to **4 places**:

```
1. teacher.teaching.studentIds[]          ← "this teacher has this student"
2. teacher.teaching.schedule[].studentId  ← "this slot belongs to this student" (old system)
   OR teacher.teaching.timeBlocks[].assignedLessons[] ← (new system)
3. student.teacherIds[]                   ← "this student has this teacher"
4. student.teacherAssignments[]           ← "lesson details for this enrollment"
```

### Why This Is a Problem

**Any update requires syncing all 4 places.** The sync functions in `student.service.js` (lines 893–1079) handle this — 187 lines of bidirectional sync code that:

- Detects changes in `teacherAssignments`
- Pushes/pulls from `teacher.teaching.studentIds`
- Creates/removes `assignedLessons` in teacher `timeBlocks`
- Maintains backward-compatible `teacherIds` array

**When sync fails or is forgotten, data becomes inconsistent.** This is documented in `BACKEND_SYNC_GUIDE.md`:
```
Student Record (teacherAssignments): time: "14:00", duration: 30
Teacher Record (teaching.schedule):  time: "08:00", duration: 45  ← MISMATCH
```

### The Established Source of Truth

Per `TEACHER_LESSON_SYNC_IMPLEMENTATION.md`, the intended architecture is:

- **`student.teacherAssignments`** = authoritative source
- **Teacher records** = derived/synced from student data
- **`teacherIds` / `teaching.studentIds`** = backward-compatible lookups (denormalized)

---

## Phase 0: Security Fixes — Non-Negotiable (1-2 days) <a name="phase-0"></a>

> Do these before any demo, customer presentation, or further development.

### Checklist

```
[ ] 1. Remove password logging
      File: api/auth/auth.controller.js:28
      Delete: console.log('Controller received:', { email, password })
      Time: 5 min

[ ] 2. Protect admin endpoints
      File: api/auth/auth.route.js:17-22
      Add requireAuth(['מנהל']) to ALL of these:
        - POST /auth/init-admin
        - POST /auth/migrate-users
        - POST /auth/migrate-invitations
        - GET  /auth/invitation-stats
        - GET  /auth/check-teacher/:email
        - DELETE /auth/remove-teacher/:email
      Time: 15 min

[ ] 3. Fix IDOR in student queries
      File: api/student/student.service.js - getStudents function
      Non-admin teachers should only see students linked to them
      Time: 1-2 hours (see code below)

[ ] 4. Shorten access token TTL
      File: api/auth/auth.service.js:7
      Change: '12h' → '1h'
      Time: 5 min

[ ] 5. Remove debug logging from production code
      File: api/orchestra/orchestra.service.js:20-123
      Remove hardcoded ObjectId debugging and excessive console.log
      Time: 15 min

[ ] 6. Clean up duplicate dependencies
      File: package.json
      Remove: mongoose (not used), bcryptjs (bcrypt is used)
      Time: 10 min
```

### IDOR Fix Code

```javascript
// api/student/student.service.js - getStudents function
async function getStudents(filterBy = {}, page = 1, limit = 0, options = {}) {
  const { teacherId, isAdmin } = options;
  const collection = await getCollection('student');
  const criteria = _buildCriteria(filterBy);

  // IDOR FIX: Non-admin teachers only see their students
  if (teacherId && !isAdmin) {
    criteria.teacherIds = teacherId;
  }
  // ... rest of function
}
```

```javascript
// api/student/student.controller.js - getStudents function
async function getStudents(req, res, next) {
  try {
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל');
    const result = await studentService.getStudents(
      filterBy, page, limit,
      { teacherId, isAdmin }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
```

---

## Phase 1: Finish the Schedule Migration (1-2 weeks) <a name="phase-1"></a>

> The half-finished migration is the single biggest source of complexity. Complete it.
>
> **Good news:** The frontend has already migrated. It calls new endpoints (`/teacher/{id}/lessons`, `/teacher/{id}/time-block`, `/attendance/individual`). Most old `schedule.service.js` functions are dead code — the frontend doesn't call them. This is primarily a **backend cleanup**, not a risky migration of active functionality.

### Goal

After Phase 1:
- **`teaching.timeBlocks`** = the only scheduling system
- **`teaching.schedule`** = removed from all active code paths
- **All 80+ references** to `teaching.schedule` are updated or removed
- Dead code from the old system is deleted

### Step 1: Run and Verify the Data Migration (1-2 days)

The migration script exists at `api/schedule/migrate-to-time-blocks.js`. Before running:

```
[ ] 1. Take a full MongoDB Atlas backup
[ ] 2. Run migration on a staging/test database first
[ ] 3. Run migration report endpoint to verify results
[ ] 4. Validate: every teacher has timeBlocks, no orphaned schedule data
```

**After migration:**
- All `teaching.schedule` slot data should be in `teaching.timeBlocks`
- Each old slot with a `studentId` becomes an `assignedLesson` in the corresponding block
- Empty slots become part of the block's available time

### Step 2: Update Cascade Deletion (1-2 days)

This is the only critical active code path still referencing the old system. When a student is deleted, `cascadeDeletion.service.js` cleans up `teaching.schedule` references. After the data migration, it needs to clean up `teaching.timeBlocks` instead.

**Files to update:**
- `services/cascadeDeletion.service.js:202-302, 749-778`
- `services/cascadeJobProcessor.js:318, 720-726`
- `services/cascadeDeletionAggregation.service.js:440-453`
- `services/cascadeWebSocketService.js:555`

**Change pattern:** Replace `teaching.schedule.studentId` queries with `teaching.timeBlocks.assignedLessons.studentId`.

### Step 3: Assess Old Attendance Service (0.5 day)

`attendance.service.js` is hardcoded to `teaching.schedule` — but the frontend calls `/attendance/individual` which likely hits a **different code path** (the `activity_attendance` collection or a dedicated attendance controller).

**Before rewriting, verify:**
```
[ ] 1. Which backend route does /attendance/individual hit?
[ ] 2. Does the old attendance.service.js (markLessonAttendance, getLessonAttendance) get
      called from ANY active route that the frontend uses?
[ ] 3. If it's dead code, mark it for deletion instead of rewriting it.
```

If the old attendance service IS dead code (likely), skip the rewrite and delete it in Step 5.

### Step 4: Delete Dead Schedule Code (1 day)

The frontend does NOT call these old schedule endpoints. They can be safely removed:

```
[ ] schedule.service.js: assignStudentToSlot (line 263) — DEAD CODE, frontend uses /student/{id}/teacher-assignment
[ ] schedule.service.js: removeStudentFromSlot (line 385) — DEAD CODE, frontend uses DELETE /student/{id}/assignment/{id}
[ ] schedule.service.js: getTeacherWeeklySchedule (line 31) — LIKELY DEAD, frontend calls /teacher/{id}/weekly-schedule (different route)
[ ] schedule.service.js: getStudentSchedule (line 610+) — LIKELY DEAD, frontend calls /student/{id}/weekly-schedule
[ ] schedule.controller.js: createTimeBlockProxy (line 522) — can be removed once old routes are removed
```

**Verify before deleting:** grep the frontend (`Frontend-New/src/`) for any of these endpoint paths to confirm they're not called. The `ScheduleTab.tsx` fallback to `teaching.schedule` (line 168) should be updated to stop falling back to the old field.

### Step 5: Update Remaining Active References (1 day)

After Steps 1-4, handle the remaining references in **code that IS actively used**:

- `api/student/student.service.js:793-845` — student sync writes to `teaching.schedule`
- `api/teacher/teacher.service.js:150-165` — merges timeBlocks into schedule on teacher creation
- `api/teacher/teacher.service.js:536, 608, 776, 835` — teacher CRUD references
- `api/teacher/teacher.service.js:1079, 1133` — `fieldToUpdate` logic checking both systems
- `api/admin/past-activities.service.js:238-260` — past lesson queries
- `services/dateConsistencyService.js:236-237` — date validation
- `services/responseFormatterService.js:370-373` — response formatting
- `api/schedule/repair-relationships.js:59-239` — relationship repair

### Step 6: Final Cleanup (0.5 day)

```
[ ] Remove teaching.schedule from teacher validation schema (teacher.validation.js:73-75)
[ ] Remove old migration routes (/migrate-to-time-blocks, /migration-backup, etc.)
[ ] Remove old seed scripts that write to teaching.schedule (scripts/seed-marina-schedule.js, etc.)
[ ] Run the $unset migration to remove teaching.schedule from all teacher documents
[ ] Update BACKEND_SYNC_GUIDE.md and TEACHER_LESSON_SYNC_IMPLEMENTATION.md
[ ] Update Frontend: remove ScheduleTab.tsx fallback to teaching.schedule (line 168)
```

### Phase 1 Deliverables

- [ ] All teacher data lives in `teaching.timeBlocks` only
- [ ] `teaching.schedule` field removed from all documents
- [ ] Cascade deletion works with the new system
- [ ] Dead schedule code removed (~500 lines of dead code in schedule.service.js)
- [ ] Zero references to `teaching.schedule` in active backend or frontend code

---

## Phase 2: Production Hardening (2-3 weeks) <a name="phase-2"></a>

> Only start Phase 2 after Phase 0 and Phase 1 are complete.

### Week 1: Logging & Stability

**2.1 Replace console.log with Structured Logging (2 days)**

The codebase is littered with `console.log` — some with debugging emojis, some logging sensitive data. Replace with Pino.

```javascript
// services/logger.service.js
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['password', 'token', 'refreshToken', 'authorization'],
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
});

// Usage:
logger.info({ studentId }, 'Student created');
logger.error({ err, userId }, 'Failed to update student');
```

**2.2 Health Endpoints (0.5 day)**

Replace the existing `/api/test` endpoint with proper health checks:

```javascript
// api/health/health.route.js
router.get('/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
  try {
    await getDB().command({ ping: 1 });
    res.json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', database: 'disconnected' });
  }
});
```

**2.3 Environment Validation (0.5 day)**

Fail fast if required env vars are missing:

```javascript
// config/validateEnv.js
const required = ['MONGODB_URI', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];

export function validateEnvironment() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

Note: `.env.example` is currently missing `STORAGE_MODE` and `API_URL` which are referenced in `server.js`. Add them.

### Week 2: Critical Tests (3-4 days)

Focus on the tests that catch real bugs — the IDOR fix and auth flow.

**14 tests targeting critical paths:**

| Area | Tests | Priority |
|------|-------|----------|
| Auth (login/logout/token refresh) | 5 | CRITICAL |
| IDOR (teacher scoping) | 3 | CRITICAL |
| E2E (student lifecycle) | 1 | CRITICAL |
| Schedule enrollment (new system) | 3 | HIGH |
| Attendance marking | 2 | HIGH |
| **Total** | **14** | |

```javascript
// Auth tests
describe('Authentication', () => {
  test('should login with valid credentials');
  test('should reject invalid credentials');
  test('should reject expired token');
  test('should refresh token successfully');
  test('should reject reused refresh token');
});

// IDOR tests
describe('Authorization - IDOR Prevention', () => {
  test('teacher should only see their own students');
  test('admin should see all students');
  test('teacher cannot access another teachers schedule');
});

// Enrollment tests (new timeBlock system)
describe('Student Enrollment', () => {
  test('should assign lesson within time block');
  test('should reject lesson outside block boundaries');
  test('should reject conflicting lesson times');
});

// Attendance tests
describe('Attendance', () => {
  test('should mark attendance for timeBlock lesson');
  test('should retrieve attendance history');
});

// E2E test
describe('E2E: Student Lifecycle', () => {
  test('create student → assign to teacher → mark attendance');
});
```

### Week 3: Response Standardization (Optional)

**Current state — 3 different response formats across controllers:**

| Pattern | Used By | Example |
|---------|---------|---------|
| Raw data | student, orchestra, rehearsal, bagrut | `res.json(student)` |
| Wrapped | auth (partially), teacher (partially) | `res.json({ success: true, data: teacher })` |
| Error | error handler | `{ success: false, error: "...", code: "..." }` |

**Recommendation:** If you standardize, do it incrementally. Start with new endpoints and migrate existing ones over time. Don't try to update all ~40 endpoints at once.

```javascript
// services/response.service.js
export const ApiResponse = {
  success: (res, data, meta = {}) => {
    res.json({ success: true, data, meta: { timestamp: new Date(), ...meta } });
  },
  error: (res, message, code = 'ERROR', status = 400) => {
    res.status(status).json({ success: false, error: { code, message } });
  }
};
```

**Note:** This is lower priority than Phases 0-1. The frontend already handles the inconsistency gracefully — every API call uses `response.data || response` to handle both formats. Only do this if you have time.

---

## Phase 3: High-Impact Features — When Needed <a name="phase-3"></a>

> Build these when the business actually needs them, not preemptively.

### Payer Model (When payments are coming)

```javascript
// payer collection schema
{
  _id: ObjectId,
  type: 'parent' | 'guardian' | 'self',
  fullName: String,
  email: String,
  phone: String,
  studentIds: [ObjectId],
  stripeCustomerId: String, // Populated when Stripe is added
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Add `payerId` field to student model. Basic CRUD endpoints, admin-only access.

**Warning:** This adds another bidirectional relationship (payer ↔ student). Keep it simple — `payerId` on student as the source of truth, `studentIds` on payer as a denormalized lookup. Don't add sync functions; query from the source of truth.

### Excel Export Reports (When admin asks for them)

4 fixed reports with `xlsx` package (already in devDependencies):

| Report | Purpose | Filters |
|--------|---------|---------|
| Student List | Export all students | Class, instrument, active |
| Teacher Schedule | Weekly lesson schedule | Teacher, date range |
| Attendance Summary | Monthly attendance | Date range, activity type |
| Bagrut Progress | Graduation exam status | School year |

### Audit Logging (When compliance requires it)

Simple audit collection tracking 10 critical events: LOGIN, LOGIN_FAILED, STUDENT_CREATED, STUDENT_DELETED, TEACHER_CREATED, TEACHER_DELETED, DATA_EXPORTED, BULK_UPDATE, ADMIN_ACTION, LOGOUT.

**Implementation tip:** Use a middleware or decorator pattern instead of adding audit calls inside already-large service files.

```javascript
// Middleware approach — doesn't bloat services
function auditMiddleware(action, entityType) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400) {
        logAudit({ userId: req.teacher?._id, action, entityType, ... });
      }
      return originalJson(data);
    };
    next();
  };
}

// Usage in routes — zero changes to services
router.post('/', requireAuth(['מנהל']), auditMiddleware('STUDENT_CREATED', 'student'), controller.addStudent);
```

---

## Explicit Non-Goals <a name="non-goals"></a>

| Don't Build | Why Not | When Later |
|-------------|---------|------------|
| Multi-tenant SaaS | 1 customer, premature | After 2nd customer signs |
| `tenantId` in every collection | Unnecessary now | Multi-tenant phase |
| Stripe Connect | No payments needed yet | Payment phase |
| Dynamic report builder UI | Over-engineering | Maybe never |
| 70% test coverage | Unrealistic for POC | Gradual improvement |
| Redis-backed rate limiting | `express-rate-limit` in-memory is fine for 1 customer | When you need multiple instances |
| Enterprise vault/secrets | Too heavy | When you scale |
| API versioning | Single consumer | Multi-consumer phase |
| Response standardization across all endpoints at once | High effort, low payoff | Incrementally |

---

## Risk Warnings & Rollback Plan <a name="risks"></a>

### What Could Break

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schedule migration corrupts data | Medium | HIGH | Backup first, run on staging, verify with migration report |
| IDOR fix breaks teacher views | Medium | High | Test thoroughly with both teacher and admin accounts |
| Attendance breaks after migration | Medium | High | Test all 3 attendance functions with new timeBlock structure |
| Token expiry annoys users | Low | Medium | Frontend handles refresh token flow |
| Cascade deletion breaks after migration | Medium | High | Test preview + actual delete for a student linked to timeBlocks |

### Rollback Plan

1. **MongoDB Atlas backups** — take a snapshot before each phase
2. **Keep the migration script's rollback function** — `rollbackTimeBlockMigration` exists at `schedule.controller.js`
3. **Feature flags for Phase 2 additions:**
```javascript
const FEATURES = {
  AUDIT_LOGGING: process.env.ENABLE_AUDIT_LOGGING !== 'false',
  STRUCTURED_LOGGING: process.env.ENABLE_STRUCTURED_LOGGING !== 'false',
};
```

---

## After POC: Expansion Path <a name="expansion"></a>

| Trigger | What to Build |
|---------|---------------|
| 2nd customer signs | Multi-tenant infrastructure (`tenantId` everywhere) |
| Customer requests payments | Stripe integration (Payer model already prepared) |
| Customer requests PDF reports | PDF export service |
| Complex permission needs | Enhanced RBAC with granular permissions |
| Performance issues | Database indexes, query projections, caching layer |

---

## Summary

### Timeline

| Phase | Duration | Focus | Prerequisite |
|-------|----------|-------|-------------|
| Phase 0 | 1-2 days | Security fixes | None |
| Phase 1 | 3-5 days | Finish schedule migration (mostly dead code cleanup) | Phase 0 |
| Phase 2 | 2-3 weeks | Logging, tests, stability | Phase 1 |
| Phase 3 | As needed | Features (payer, reports, audit) | Phase 2 |

### Key Principle

**Fix the foundation before adding features.** Phase 1 is easier than it looks — the frontend already migrated, so most old schedule code is dead. It's primarily a backend cleanup of ~80 references and ~500 lines of dead code, plus updating cascade deletion to work with `timeBlocks`. Low risk, high reward for codebase clarity.

### File Reference: What Gets Modified Per Phase

**Phase 0 (6 files):**
- `api/auth/auth.controller.js` — remove password logging
- `api/auth/auth.route.js` — protect endpoints
- `api/auth/auth.service.js` — shorten token TTL
- `api/student/student.service.js` — IDOR fix
- `api/student/student.controller.js` — pass auth context
- `api/orchestra/orchestra.service.js` — remove debug logging

**Phase 1 (~25 files):**
- `api/schedule/attendance.service.js` — rewrite for timeBlocks
- `api/schedule/schedule.service.js` — delegate to time-block service
- `services/cascadeDeletion.service.js` — update references
- `services/cascadeJobProcessor.js` — update references
- `services/cascadeDeletionAggregation.service.js` — update references
- `api/student/student.service.js` — update sync functions
- `api/teacher/teacher.service.js` — remove old schedule references
- `api/teacher/teacher.validation.js` — remove schedule schema
- `api/admin/past-activities.service.js` — update queries
- `api/schedule/schedule.route.js` — simplify routes
- `api/schedule/schedule.controller.js` — remove proxy, old functions
- `services/responseFormatterService.js` — update formatting
- `services/dateConsistencyService.js` — update date checks
- `api/schedule/repair-relationships.js` — update for timeBlocks
- Plus cleanup of migration scripts and seed scripts

**Phase 2 (5-10 new files):**
- `services/logger.service.js` — new
- `api/health/health.route.js` — new
- `config/validateEnv.js` — new
- Test files — new
- `services/response.service.js` — new (optional)

---

*Last updated: February 6, 2026*
