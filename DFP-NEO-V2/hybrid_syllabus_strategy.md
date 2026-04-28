# Hybrid Syllabus Strategy: Database-Backed Configuration with Startup Loading

## The Problem You've Identified

Your scenario is different from my initial assumption:
- ❌ **My assumption:** Static curriculum, rarely changes
- ✅ **Your reality:** Dynamic curriculum, frequent updates, user-editable
- ❌ **My assumption:** Central curriculum authority controls syllabus
- ✅ **Your reality:** Users need flexibility to add/remove events

This changes everything! You're correct that **database-backed configuration is the right solution**.

---

## The Hybrid Architecture

### Concept: Database as Source of Truth, Config as Runtime Cache

```
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│                  Source of Truth for Syllabus                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Model: SyllabusItem                                          │
│  ├── id: String (Primary Key)                                │
│  ├── code: String (BGF1, FTD2, etc.)                        │
│  ├── description: String                                     │
│  ├── courses: String[]                                       │
│  ├── type: "Flight" | "FTD" | "Ground School"               │
│  ├── phase: "BGF" | "BIF" | "FIC" | etc.                     │
│  ├── methodOfDelivery: String[]                              │
│  ├── flightOrSimHours: Float                                 │
│  ├── totalEventHours: Float                                  │
│  ├── sortOrder: Int                                          │
│  ├── prerequisites: String[]                                 │
│  ├── isActive: Boolean (allows soft delete/retire)          │
│  ├── location: String                                        │
│  ├── version: Int (schema version)                           │
│  ├── createdBy: String (userId of instructor/admin)         │
│  ├── createdAt: DateTime                                     │
│  └── updatedAt: DateTime                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ 1. App Startup: Load all syllabus
                          ↓
┌─────────────────────────────────────────────────────────────┐
│               Application Startup Flow (App.tsx)              │
│                                                               │
│  useEffect(() => {                                           │
│    async function loadSyllabus() {                           │
│      const syllabus = await fetchSyllabusFromDB();          │
│      processPrerequisites(syllabus);                        │
│      setSyllabusState(syllabus);                           │
│      cacheInLocalStorage(syllabus, 30min);                  │
│    }                                                         │
│    loadSyllabus();                                           │
│  }, []);                                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ In-memory state for entire session
                          ↓
┌─────────────────────────────────────────────────────────────┐
│               Runtime Usage (Fast, No Queries)                │
│                                                               │
│  const syllabus = syllabusState;  // Instant access!        │
│  const item = syllabus.find(s => s.code === 'BGF1');        │
│                                                               │
│  All components use the loaded syllabus data                 │
│  Zero database queries during session                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Design

### New SyllabusItem Model

```prisma
// prisma/schema.prisma

model SyllabusItem {
  id                  String   @id @default(cuid())
  code                String   @unique  // BGF1, FTD2, etc.
  description         String
  courses             String[]  // JSON array: ["BPC+IPC"] or ["FIC"]
  type                String   // "Flight" | "FTD" | "Ground School"
  phase               String   // "BGF" | "BIF" | "FIC" | "WSO" | "OFI"
  module              String   // "Basic General Flying", etc.
  methodOfDelivery    String[]  // ["Flight", "Brief", "Debrief"]
  flightOrSimHours    Float    @default(0)
  totalEventHours     Float    @default(0)
  sortOrder           Int      @default(0)
  prerequisites       String[] // JSON array: ["BGF1", "BGF2"]
  prerequisitesGround  String[] // Ground prerequisites
  prerequisitesFlying String[] // Flying prerequisites
  location            String?
  sortieType          String?  // "Dual" | "Solo"
  preFlightTime       Float    @default(0)
  postFlightTime      Float    @default(0)
  isActive            Boolean  @default(true)
  version             Int      @default(1)
  notes               String?
  createdBy           String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  scores              Score[]  // Reverse relationship
  
  @@index([code])
  @@index([type])
  @@index([phase])
  @@index([isActive])
  @@index([sortOrder])
}

// Update Score model to reference SyllabusItem
model Score {
  id           String   @id @default(cuid())
  traineeId    String
  syllabusId   String   // Changed from 'event' String to syllabusId String
  score        Int
  date         DateTime
  instructor   String
  notes        String?
  details      Json?
  createdAt    DateTime @default(now())
  
  // Keep event code string temporarily for backward compatibility
  eventCode    String?  // Legacy field, can remove after migration
  
  trainee      Trainee  @relation("TraineeScores", fields: [traineeId], references: [id])
  syllabusItem SyllabusItem @relation(fields: [syllabusId], references: [id])
  
  @@index([traineeId])
  @@index([syllabusId])
  @@index([date])
}

// Keep existing Trainee model (no changes needed)
model Trainee {
  id            String   @id @default(cuid())
  userId        String?  @unique
  idNumber      String   @unique
  name          String
  rank          TraineeRank?
  course        String   // BPC+IPC, FIC, WSO, OFI
  lmpType       String?
  status        String?
  school        String?
  // ... existing fields ...
  
  scores        Score[]  @relation("TraineeScores")
  
  // ... existing indexes ...
}
```

### Migration Script to Populate Initial Syllabus

```typescript
// prisma/seed-syllabus.ts

import { PrismaClient } from '@prisma/client';
import { INITIAL_SYLLABUS_DETAILS } from '../config/syllabusConfig';

const prisma = new PrismaClient();

async function seedSyllabus() {
  console.log('📚 Starting syllabus migration to database...');
  
  // Clear existing syllabus items
  await prisma.syllabusItem.deleteMany();
  
  // Insert all syllabus items from config
  for (const item of INITIAL_SYLLABUS_DETAILS) {
    await prisma.syllabusItem.create({
      data: {
        code: item.code,
        description: item.description,
        courses: item.courses,
        type: item.type,
        phase: item.phase,
        module: item.module,
        methodOfDelivery: item.methodOfDelivery,
        flightOrSimHours: item.flightOrSimHours,
        totalEventHours: item.totalEventHours,
        sortOrder: item.sortOrder,
        prerequisites: item.prerequisites || [],
        prerequisitesGround: item.prerequisitesGround || [],
        prerequisitesFlying: item.prerequisitesFlying || [],
        location: item.location,
        sortieType: item.sortieType,
        preFlightTime: item.preFlightTime,
        postFlightTime: item.postFlightTime,
        isActive: true,
        version: 1,
        createdBy: 'system',
        notes: 'Migrated from INITIAL_SYLLABUS_DETAILS'
      }
    });
  }
  
  console.log(`✅ Migrated ${INITIAL_SYLLABUS_DETAILS.length} syllabus items`);
}

seedSyllabus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Startup Loading Implementation

### API Endpoint for Syllabus Loading

```typescript
// pages/api/syllabus.ts

import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all active syllabus items, ordered
    const syllabusItems = await prisma.syllabusItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    // Validate we have syllabus data
    if (!syllabusItems || syllabusItems.length === 0) {
      console.error('❌ No syllabus items found in database');
      return res.status(404).json({ 
        error: 'No syllabus configuration found',
        message: 'Please contact system administrator'
      });
    }

    console.log(`✅ Loaded ${syllabusItems.length} syllabus items from database`);
    
    res.status(200).json(syllabusItems);
  } catch (error) {
    console.error('❌ Error fetching syllabus:', error);
    res.status(500).json({ 
      error: 'Failed to fetch syllabus configuration',
      retryAfter: 60
    });
  }
}
```

### Application Startup Implementation

```typescript
// App.tsx (relevant sections)

import { useState, useEffect, useCallback } from 'react';
import { SyllabusItemDetail } from './types';

const App = () => {
  const [syllabus, setSyllabus] = useState<SyllabusItemDetail[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(true);
  const [syllabusError, setSyllabusError] = useState<string | null>(null);

  // Load syllabus on app startup
  const loadSyllabus = useCallback(async () => {
    setSyllabusLoading(true);
    setSyllabusError(null);

    try {
      // Try localStorage cache first (30 min expiry)
      const cached = getCachedSyllabus();
      if (cached) {
        console.log('✅ Using cached syllabus data');
        setSyllabus(cached);
        setSyllabusLoading(false);
        return;
      }

      // Fetch from database
      console.log('📚 Fetching syllabus from database...');
      const response = await fetch('/api/syllabus');
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load syllabus');
      }

      const rawSyllabus = await response.json();
      
      // Process prerequisites (same logic as before)
      const processedSyllabus = populatePrerequisites(rawSyllabus);
      
      // Cache in localStorage
      cacheSyllabus(processedSyllabus);
      
      setSyllabus(processedSyllabus);
      console.log(`✅ Loaded ${processedSyllabus.length} syllabus items`);
    } catch (error) {
      console.error('❌ Failed to load syllabus:', error);
      setSyllabusError(error instanceof Error ? error.message : 'Unknown error');
      
      // Try fallback to cached data (even if expired)
      const fallbackCache = getExpiredCachedSyllabus();
      if (fallbackCache) {
        console.warn('⚠️ Using expired cached syllabus as fallback');
        setSyllabus(fallbackCache);
      }
    } finally {
      setSyllabusLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadSyllabus();
  }, [loadSyllabus]);

  // Show loading/error states
  if (syllabusLoading && syllabus.length === 0) {
    return <LoadingSyllabusScreen />;
  }

  if (syllabusError && syllabus.length === 0) {
    return <SyllabusLoadError error={syllabusError} onRetry={loadSyllabus} />;
  }

  // Render app with loaded syllabus
  return <MainApp syllabus={syllabus} />;
};

// Cache helpers
function getCachedSyllabus(): SyllabusItemDetail[] | null {
  if (typeof window === 'undefined') return null;
  
  const cached = localStorage.getItem('syllabus-cache');
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  const age = Date.now() - timestamp;
  
  // 30 minute cache
  if (age < 30 * 60 * 1000) {
    return data;
  }
  
  return null;
}

function getExpiredCachedSyllabus(): SyllabusItemDetail[] | null {
  if (typeof window === 'undefined') return null;
  
  const cached = localStorage.getItem('syllabus-cache');
  return cached ? JSON.parse(cached).data : null;
}

function cacheSyllabus(syllabus: SyllabusItemDetail[]): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('syllabus-cache', JSON.stringify({
    data: syllabus,
    timestamp: Date.now()
  }));

  // Set expiry time
  localStorage.setItem('syllabus-cache-expiry', 
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );
}

function populatePrerequisites(items: any[]): any[] {
  // Same logic as in mockData.ts
  return items.map((item, index, arr) => {
    // ... existing prerequisite logic ...
    return { ...item, /* processed fields */ };
  });
}
```

---

## Syllabus Management UI

### New Component: SyllabusEditor.tsx

```typescript
// components/SyllabusEditor.tsx

import { useState } from 'react';
import { SyllabusItemDetail } from '../types';

export const SyllabusEditor = () => {
  const [syllabus, setSyllabus] = useState<SyllabusItemDetail[]>([]);
  const [editingItem, setEditingItem] = useState<SyllabusItemDetail | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch current syllabus
  useEffect(() => {
    fetch('/api/syllabus')
      .then(res => res.json())
      .then(setSyllabus);
  }, []);

  // Add new syllabus item
  const handleAdd = async (newItem: Partial<SyllabusItemDetail>) => {
    const response = await fetch('/api/syllabus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });

    if (response.ok) {
      const created = await response.json();
      setSyllabus([...syllabus, created]);
      setShowAddModal(false);
      
      // Prompt user to reload app
      if (confirm('Syllabus updated. Reload app to apply changes?')) {
        window.location.reload();
      }
    }
  };

  // Edit existing item
  const handleEdit = async (updatedItem: SyllabusItemDetail) => {
    const response = await fetch(`/api/syllabus/${updatedItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem)
    });

    if (response.ok) {
      setSyllabus(syllabus.map(s => 
        s.id === updatedItem.id ? updatedItem : s
      ));
      setEditingItem(null);
      
      if (confirm('Syllabus updated. Reload app to apply changes?')) {
        window.location.reload();
      }
    }
  };

  // Soft delete (set isActive: false)
  const handleDelete = async (id: string) => {
    if (!confirm('Retire this syllabus item? This will not affect existing scores.')) {
      return;
    }

    const response = await fetch(`/api/syllabus/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      setSyllabus(syllabus.filter(s => s.id !== id));
    }
  };

  return (
    <div className="syllabus-editor">
      <h2>Syllabus Management</h2>
      
      <div className="actions">
        <button onClick={() => setShowAddModal(true)}>
          ➕ Add New Event
        </button>
        <button onClick={() => window.location.reload()}>
          🔄 Reload Syllabus
        </button>
      </div>

      <table className="syllabus-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
            <th>Type</th>
            <th>Phase</th>
            <th>Hours</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {syllabus.map(item => (
            <tr key={item.id}>
              <td>{item.code}</td>
              <td>{item.description}</td>
              <td>{item.type}</td>
              <td>{item.phase}</td>
              <td>{item.totalEventHours}h</td>
              <td>{item.isActive ? '✅' : '🔴'}</td>
              <td>
                <button onClick={() => setEditingItem(item)}>
                  ✏️ Edit
                </button>
                <button onClick={() => handleDelete(item.id)}>
                  🗑️ Retire
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddModal && (
        <SyllabusItemModal
          mode="create"
          onSave={handleAdd}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editingItem && (
        <SyllabusItemModal
          mode="edit"
          item={editingItem}
          onSave={handleEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};
```

### API Endpoints for CRUD Operations

```typescript
// pages/api/syllabus/index.ts (POST - Create)

import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const body = JSON.parse(req.body);
      
      // Automatically determine fields
      let phase = 'BGF';
      if (body.code.startsWith('BIF')) phase = 'BIF';
      else if (body.code.startsWith('FIC')) phase = 'FIC';
      // ... etc

      const syllabusItem = await prisma.syllabusItem.create({
        data: {
          code: body.code,
          description: body.description,
          courses: body.courses || ['BPC+IPC'],
          type: body.type || 'Flight',
          phase: phase,
          module: determineModule(phase),
          methodOfDelivery: body.methodOfDelivery || ['Flight', 'Brief', 'Debrief'],
          flightOrSimHours: body.flightOrSimHours || 1.5,
          totalEventHours: body.totalEventHours || 2.0,
          sortOrder: body.sortOrder || 0,
          prerequisites: body.prerequisites || [],
          isActive: true,
          version: 1,
          createdBy: 'admin' // TODO: Use actual user ID
        }
      });

      res.status(201).json(syllabusItem);
    } catch (error) {
      console.error('Error creating syllabus item:', error);
      res.status(500).json({ error: 'Failed to create syllabus item' });
    }
  }
}

// pages/api/syllabus/[id].ts (PUT - Edit, DELETE - Retire)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    // Update existing item
    try {
      const body = JSON.parse(req.body);
      const updated = await prisma.syllabusItem.update({
        where: { id: id as string },
        data: {
          ...body,
          updatedAt: new Date()
        }
      });
      res.status(200).json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update syllabus item' });
    }
  }

  if (req.method === 'DELETE') {
    // Soft delete (set isActive: false)
    try {
      await prisma.syllabusItem.update({
        where: { id: id as string },
        data: { isActive: false }
      });
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retire syllabus item' });
    }
  }
}
```

---

## Version Control and History

### Syllabus History Tracking

```typescript
// New model for tracking changes

model SyllabusHistory {
  id               String   @id @default(cuid())
  syllabusId       String
  changeType       String   // "CREATE", "UPDATE", "DELETE", "REACTIVATE"
  changeData       Json     // Snapshot of the item after change
  changedBy        String   // User ID who made the change
  changeReason     String?  // Optional reason for change
  previousVersion  Json?    // Snapshot before change
  createdAt        DateTime @default(now())
}

// Update syllabus update to track history
async function updateSyllabusItem(id: string, data: any, userId: string) {
  const previous = await prisma.syllabusItem.findUnique({ where: { id } });
  
  const updated = await prisma.syllabusItem.update({
    where: { id },
    data: data
  });

  // Log the change
  await prisma.syllabusHistory.create({
    data: {
      syllabusId: id,
      changeType: 'UPDATE',
      changeData: updated,
      changedBy: userId,
      changeReason: data.changeReason || 'Manual update',
      previousVersion: previous
    }
  });

  return updated;
}
```

---

## Benefits of Hybrid Approach

### ✅ What You Gain:

1. **User Flexibility**
   - Instructors can add/remove syllabus items
   - Curriculum changes without code deployment
   - Incremental updates (add one event at a)
   - Wholesale changes (import new syllabus)

2. **Professional Management**
   - Version history tracking
   - Soft delete (retire instead of hard delete)
   - Audit trail of who changed what
   - Rollback capability

3. **Performance**
   - Load once at startup
   - Zero queries during session
   - Cached for 30 minutes
   - Fallback to expired cache

4. **Graceful Degradation**
   - Network failure? Use cache
   - Database down? Show cached version
   - Clear error messages
   - Retry functionality

5. **Data Integrity**
   - Foreign key constraints (scores → syllabus)
   - Validation at database level
   - Type safety with Prisma

---

## Migration Strategy

### Phase 1: Database Setup (2-3 hours)

**Tasks:**
1. Add `SyllabusItem` model to schema.prisma
2. Update `Score` model to reference `SyllabusItem`
3. Run `npx prisma migrate dev --name add_syllabus_table`
4. Create seed script to populate from INITIAL_SYLLABUS_DETAILS
5. Run seed script
6. Verify data in database

**Complexity:** ⭐⭐ Easy-Medium
**Risk:** 🟡 Medium (schema changes)
**Files Changed:**
- prisma/schema.prisma
- New: prisma/seed-syllabus.ts

### Phase 2: Startup Loading (2-3 hours)

**Tasks:**
1. Create `pages/api/syllabus.ts` endpoint
2. Add syllabus loading to App.tsx
3. Implement localStorage caching
4. Add loading/error screens
5. Test with database offline
6. Test cache fallback

**Complexity:** ⭐⭐⭐ Medium
**Risk:** 🟡 Medium (app initialization)
**Files Changed:**
- New: pages/api/syllabus.ts
- App.tsx

### Phase 3: Management UI (3-4 hours)

**Tasks:**
1. Create `SyllabusEditor.tsx` component
2. Create CRUD API endpoints
3. Add edit modal component
4. Add add modal component
5. Integrate into Settings menu
6. Test add/edit/delete operations

**Complexity:** ⭐⭐⭐⭐ Medium-High
**Risk:** 🟠 Medium-High (UI changes, CRUD logic)
**Files Changed:**
- New: components/SyllabusEditor.tsx
- New: components/SyllabusItemModal.tsx
- New: pages/api/syllabus/[id].ts

### Phase 4: Legacy Migration (2-3 hours)

**Tasks:**
1. Migrate existing Score records to use syllabusId
2. Remove eventCode field (or keep for backward compatibility)
3. Remove INITIAL_SYLLABUS_DETAILS from App.tsx
4. Test with existing data
5. Verify score display works

**Complexity:** ⭐⭐⭐ Medium
**Risk:** 🟠 Medium-High (data migration)
**Files Changed:**
- Migration script for Score table
- App.tsx

### Phase 5: Mock Data Cleanup (1 hour)

**Tasks:**
1. Remove INITIAL_SYLLABUS_DETAILS from mockData.ts
2. Remove DEFAULT_PHRASE_BANK (or move to config)
3. Delete mockData.ts entirely
4. Update all imports
5. Clean up dataService.ts fallbacks

**Complexity:** ⭐ Low
**Risk:** 🟢 Low
**Files Changed:**
- mockData.ts (delete)
- All files importing mockData.ts

---

## Testing Strategy

### Unit Tests Needed

```typescript
// __tests__/syllabus-loading.test.ts
describe('Syllabus Loading', () => {
  it('loads syllabus from database', async () => {
    const syllabus =await loadSyllabus();
    expect(syllabus.length).toBeGreaterThan(0);
    expect(syllabus[0]).toHaveProperty('code');
    expect(syllabus[0]).toHaveProperty('description');
  });

  it('uses cache when available', async () => {
    cacheSyllabus(mockSyllabus);
    const result = await loadSyllabus();
    expect(result).toEqual(mockSyllabus);
  });

  it('falls back to expired cache on error', async () => {
    cacheExpiredSyllabus(mockSyllabus);
    mockDatabaseFailure();
    const result = await loadSyllabus();
    expect(result).toEqual(mockSyllabus);
  });
});
```

### Integration Tests Needed

```typescript
// __tests__/syllabus-crud.test.ts
describe('Syllabus CRUD', () => {
  it('creates new syllabus item', async () => {
    const newItem = {
      code: 'TEST001',
      description: 'Test Event',
      type: 'Flight'
    };
    const response = await fetch('/api/syllabus', {
      method: 'POST',
      body: JSON.stringify(newItem)
    });
    expect(response.status).toBe(201);
  });

  it('updates existing syllabus item', async () => {
    // ... test update
  });

  it('soft deletes syllabus item', async () => {
    // ... test soft delete
  });
});
```

### Manual Testing Checklist

- [ ] Load app with fresh cache
- [ ] Load app with expired cache
- [ ] Load app with database offline
- [ ] Create new syllabus item
- [ ] Edit existing syllabus item
- [ ] Retire syllabus item
- [ ] Add item with prerequisites
- [ ] Reload app after changes
- [ ] Verify scores still display correctly
- [ ] Test with multiple concurrent users
- [ ] Test with very large syllabus (500+ items)
- [ ] Test import/export of syllabus

---

## Error Handling Strategies

### Database Connection Failure

```typescript
// Progressive fallback strategy
try {
  // 1. Try database
  syllabus = await fetchFromDatabase();
} catch (error) {
  console.warn('⚠️ Database unavailable, trying cache...');
  
  try {
    // 2. Try cache (even if expired)
    syllabus = await getCachedSyllabus();
    showWarning('Using cached syllabus - changes not reflected');
  } catch (error) {
    console.error('❌ Cache unavailable, showing error...');
    
    // 3. Show error + fallback to hardcoded emergency syllabus
    syllabus = EMERGENCY_SYLLABUS;
    showError('Syllabus unavailable - offline mode with limited functionality');
  }
}
```

### Syllabus Validation

```typescript
function validateSyllabus(syllabus: SyllabusItemDetail[]): void {
  // Check for required fields
  const missingCodes = syllabus.filter(s => !s.code);
  if (missingCodes.length > 0) {
    throw new Error(`${missingCodes.length} items missing code field`);
  }

  // Check for duplicates
  const codes = syllabus.map(s => s.code);
  const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate codes: ${duplicates.join(', ')}`);
  }

  // Check prerequisites exist
  syllabus.forEach(item => {
    item.prerequisites?.forEach(prereq => {
      const exists = syllabus.some(s => s.code === prereq);
      if (!exists) {
        console.warn(`⚠️ Prerequisite ${prereq} not found for ${item.code}`);
      }
    });
  });

  // Check sort order
  const sorted = [...syllabus].sort((a, b) => a.sortOrder - b.sortOrder);
  if (JSON.stringify(syllabus) !== JSON.stringify(sorted)) {
    console.warn('⚠️ Syllabus not in correct sort order');
  }
}
```

---

## Performance Considerations

### Caching Strategy

```typescript
// Multi-layer caching
const CACHE_CONFIG = {
  localStorage: {
    enabled: true,
    ttl: 30 * 60 * 1000, // 30 minutes
    key: 'syllabus-cache'
  },
  memory: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes (per session)
    maxSize: 500 // items
  },
  database: {
    connectionPool: 10,
    queryTimeout: 5000
  }
};

// Preload strategy
async function preloadSyllabusForAllCourses() {
  const courses = ['BPC+IPC', 'FIC', 'WSO', 'OFI'];
  
  await Promise.all(
    courses.map(course => 
      fetch(`/api/syllabus?course=${course}`)
      .then(res => res.json())
      .then(data => cacheCourseSyllabus(course, data))
    )
  );
}
```

### Database Optimization

```prisma
model SyllabusItem {
  // ... fields ...
  
  @@index([code])                    // Search by code
  @@index([isActive, sortOrder])     // Active items in order
  @@index([phase, type])             // Filter by phase/type
  @@index([courses])                 // Course filtering (using Postgres array ops)
}
```

---

## Security Considerations

### Permission System

```typescript
// Only admins/senior instructors can edit syllabus
export async function canEditSyllabus(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { personnel: true }
  });

  if (!user?.personnel) return false;

  const allowedRoles = ['Chief Instructor', 'Deputy Chief Instructor', 'Training Manager'];
  return allowedRoles.includes(user.personnel.rank);
}

// Apply to API endpoints
export default async function handler(req, res) {
  const userId = getUserIdFromSession(req);
  
  if (!canEditSyllabus(userId)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Proceed with edit...
}
```

---

## Backup and Export

### Syllabus Export Feature

```typescript
// pages/api/syllabus/export.ts

export default async function handler(req, res) {
  const syllabus = await prisma.syllabusItem.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    itemCount: syllabus.length,
    items: syllabus
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `syllabus-export-${Date.now()}.json`);
  res.status(200).json(exportData);
}
```

### Syllabus Import Feature

```typescript
// pages/api/syllabus/import.ts

export default async function handler(req, res) {
  const importData = JSON.parse(req.body);

  // Validate structure
  if (!importData.items || !Array.isArray(importData.items)) {
    return res.status(400).json({ error: 'Invalid import format' });
  }

  // Backup current state
  const backup = await prisma.syllabusItem.findMany();
  await storeBackup(backup);

  try {
    // Deactivate all current items
    await prisma.syllabusItem.updateMany({
      data: { isActive: false }
    });

    // Import new items
    for (const item of importData.items) {
      await prisma.syllabusItem.upsert({
        where: { code: item.code },
        update: { ...item, isActive: true },
        create: { ...item, isActive: true }
      });
    }

    res.status(200).json({ 
      success: true, 
      imported: importData.items.length 
    });
  } catch (error) {
    // Rollback on error
    await restoreBackup(backup);
    res.status(500).json({ error: 'Import failed, rolled back' });
  }
}
```

---

## User Experience Improvements

### Syllabus Change Notifications

```typescript
// Detect syllabus updates and notify users
useEffect(() => {
  const checkForUpdates = async () => {
    const currentVersion = localStorage.getItem('syllabus-version');
    const latest = await fetch('/api/syllabus/version');
    
    if (latest.version !== currentVersion) {
      showNotification({
        type: 'info',
        title: 'Syllabus Updated',
        message: 'The training syllabus has been updated. Reload to see changes.',
        actions: [
          { label: 'Reload Now', onClick: () => window.location.reload() },
          { label: 'Later', onClick: () => dismiss() }
        ]
      });
    }
  };

  const interval = setInterval(checkForUpdates, 5 * 60 * 1000); // Every 5 minutes
  return () => clearInterval(interval);
}, []);
```

---

## Conclusion

### Is Hybrid Approach Right for You?

**YES, if:**
- ✅ Syllabus changes frequently
- ✅ Instructors need to edit syllabus
- ✅ Multiple courses with different syllabuses
- ✅ Need version history and audit trail
- ✅ Want professional management tools

**NO, if:**
- ❌ Syllabus never changes (static)
- ❌ Only developers can edit curriculum
- ❌ Single course, fixed structure

### Your Situation: **YES - Hybrid is Perfect!**

Your requirement for "users need the flexibility to change syllabus" makes the hybrid approach the correct solution.

### Implementation Complexity

**Total Time Estimate:** 10-13 hours
- Phase 1 (Database): 2-3 hours
- Phase 2 (Loading): 2-3 hours
- Phase 3 (UI): 3-4 hours
- Phase 4 (Migration): 2-3 hours
- Phase 5 (Cleanup): 1 hour

**Risk Level:** MEDIUM
- Schema changes require testing
- Data migration needs rollback plan
- UI changes affect user experience

**Long-term Benefits:**
- Users can edit syllabus without code changes
- Professional curriculum management
- Version history and audit trail
- Better data integrity

### Next Steps

1. ✅ **Approach:** Hybrid database-backed configuration
2. ✅ **Strategy:** Load at startup, cache for performance
3. ✅ **Implementation:** 5 phases over 10-13 hours
4. ✅ **Testing:** Comprehensive testing before deployment

This gives you the best of both worlds: database flexibility with configuration performance! 🎯