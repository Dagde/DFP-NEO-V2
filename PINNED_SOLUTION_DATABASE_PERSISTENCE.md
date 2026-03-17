# 📌 PINNED SOLUTION: Database Persistence Issues

## Problem Description
Settings (or any data) not persisting after page reload, or failing to save to the database with 500 errors.

## Root Causes & Fixes

---

### 1. Prisma Model Undefined (`db.modelName` is `undefined`)

**Symptoms:**
- Error: `Cannot read properties of undefined (reading 'findUnique')`
- Error: `Cannot read properties of undefined (reading 'upsert')`
- 500 Internal Server Error on API calls

**Root Cause:**
The Prisma schema (`prisma/schema.prisma`) does not contain the model, so the generated Prisma client doesn't have that model as a property. When Railway runs `npm install`, it generates a fresh Prisma client **without** the missing model.

**Why `postinstall: prisma generate` doesn't help:**
Adding `postinstall` only regenerates the client from the existing schema. If the model isn't in the schema, it won't exist in the client.

**✅ Solution: Use Raw SQL Instead of Prisma Model Methods**

Replace Prisma model calls with `$queryRawUnsafe` / `$executeRawUnsafe`:

```javascript
// ❌ BEFORE (fails if model not in schema)
const record = await db.appSettings.findUnique({
  where: { orgId }
});

const result = await db.appSettings.upsert({
  where: { orgId },
  update: { data: settings },
  create: { orgId, data: settings }
});

// ✅ AFTER (works without model in schema)
// GET - Read data
const rows = await db.$queryRawUnsafe(
  `SELECT "data" FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
  orgId
);
const data = rows.length > 0 ? rows[0].data : null;

// POST - Save data (upsert pattern)
const existing = await db.$queryRawUnsafe(
  `SELECT "id" FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
  orgId
);

if (existing && existing.length > 0) {
  // UPDATE
  await db.$executeRawUnsafe(
    `UPDATE "AppSettings" SET "data" = $1::jsonb, "updatedAt" = $2::timestamp WHERE "orgId" = $3`,
    JSON.stringify(data),
    new Date().toISOString(),
    orgId
  );
} else {
  // INSERT
  const newId = require('crypto').randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO "AppSettings" ("id", "orgId", "data", "createdAt", "updatedAt") VALUES ($1, $2, $3::jsonb, $4::timestamp, $5::timestamp)`,
    newId,
    orgId,
    JSON.stringify(data),
    new Date().toISOString(),
    new Date().toISOString()
  );
}
```

**Ensure Table Exists on Startup:**
```javascript
async function ensureAppSettingsTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppSettings" (
        "id"        TEXT NOT NULL,
        "orgId"     TEXT NOT NULL DEFAULT 'default',
        "data"      JSONB NOT NULL DEFAULT '{}',
        "updatedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_orgId_key" ON "AppSettings"("orgId")
    `);
    console.log('✅ AppSettings table ensured');
  } catch (err) {
    console.error('❌ Error creating AppSettings table:', err.message);
  }
}

// Call this on server startup before routes are hit
await ensureAppSettingsTable(prisma);
```

---

### 2. HTTP 413 Payload Too Large

**Symptoms:**
- Error: `413 Payload Too Large`
- Large JSON payloads fail to save

**Root Cause:**
Express default body limit is 100kb. Large settings objects exceed this.

**✅ Solution: Increase Express Body Limit**

```javascript
// In server.js - BEFORE defining routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

### 3. React useState Not Syncing from Database

**Symptoms:**
- Data saves successfully to DB
- After hard reload, UI shows default values instead of saved data
- Console shows DB data loading but component ignores it

**Root Cause:**
`useState` only reads the initial value once at mount. If the component mounts before DB data arrives, the state initializes with defaults. When DB data arrives later, `useState` ignores the updated prop.

**✅ Solution: Use `useRef` + `useEffect` to Sync Once When Data Loads**

```tsx
import React, { useState, useEffect, useRef } from 'react';

function MyComponent({ savedSettings, settingsLoaded, onSettingsChange }) {
  const [myValue, setMyValue] = useState(defaultValue);
  const hasInitializedFromDB = useRef(false);

  // Sync internal state from DB exactly once when data loads
  useEffect(() => {
    if (settingsLoaded && !hasInitializedFromDB.current && savedSettings) {
      hasInitializedFromDB.current = true;
      setMyValue(savedSettings.myValue ?? defaultValue);
      // ... set other state from savedSettings
    }
  }, [settingsLoaded, savedSettings]);

  // Notify parent of changes (skip before DB loads)
  useEffect(() => {
    if (!settingsLoaded && !hasInitializedFromDB.current) return;
    if (onSettingsChange) {
      onSettingsChange({ myValue, /* ... */ });
    }
  }, [myValue, /* other state */]);

  return (/* ... */);
}
```

**Parent Component Pattern:**
```tsx
// App.tsx
const [settings, setSettings] = useState(null);
const [settingsLoaded, setSettingsLoaded] = useState(false);

useEffect(() => {
  loadSettingsFromDB().then((data) => {
    setSettings(data);
    setSettingsLoaded(true);  // Signal that DB load is complete
  });
}, []);

return <MyComponent 
  savedSettings={settings} 
  settingsLoaded={settingsLoaded}
  onSettingsChange={handleSettingsChange}
/>;
```

---

## Quick Diagnostic Checklist

| Issue | Check | Fix |
|-------|-------|-----|
| 500 error on save | Check server logs for `undefined` | Use raw SQL instead of Prisma model |
| 413 error | Check payload size vs 100kb limit | Increase `express.json({ limit: '10mb' })` |
| Data not loading after reload | Check `useState` timing | Use `useRef` + `useEffect` sync pattern |
| Table doesn't exist | Check `ensureTable()` runs on startup | Add table creation with `CREATE TABLE IF NOT EXISTS` |

---

## Commit Reference
- Fix commit: `a30e4c22` in `Dagde/DFP-NEO-V2` branch `feature/comprehensive-build-algorithm`
- File modified: `DFP-NEO-V2-fresh/server.js`