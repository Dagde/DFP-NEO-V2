# PINNED SOLUTIONS

---

## PIN 1: Currency Status Features Missing / Not Visible

### Problem Statement
User requested three features for the Currency Status page:
1. **Audit function should record all changes** — including time/date, who changed it, and description
2. **Close button on Audit page needs rounded corners**
3. **Active/Inactive toggle in EDIT mode** — inactive currencies remain visible but greyed out, excluded from calculations

After implementation, user reported "none of those changes are displayed or active" — features appeared to be missing.

### Root Cause Analysis

#### Architecture Discovery
The investigation revealed a **critical architectural misunderstanding**:

1. **Two Different Components for Currency:**
   - `CurrencyPanel.tsx` — flyout panel embedded in Staff/Trainee profiles (this is where users access currency)
   - `CurrencyStatusPage.tsx` — separate full-page view accessible via list view navigation button

2. **Initial Implementation was in Wrong Component:**
   - Active/Inactive toggle was added to `CurrencyStatusPage.tsx` 
   - User accesses currency via `InstructorProfileFlyout` → `CurrencyPanel`
   - Features worked but weren't visible to user because they were looking at wrong component

3. **Missing Close Button Styling:**
   - `CurrencyAuditFlyout.tsx` Close button was missing `rounded-lg` class entirely

4. **Audit Gap:**
   - `CurrencyPanel` saved audit to DB via `/api/audit/currency`
   - Audit didn't track Active/Inactive changes, only date changes

### Solution

#### 1. Active/Inactive Toggle in CurrencyPanel.tsx
```typescript
// Added state management for active/inactive toggles
const [editedInactive, setEditedInactive] = useState<Map<string, boolean>>(new Map());
const [originalInactive, setOriginalInactive] = useState<Map<string, boolean>>(new Map());

// Toggle handler
const handleToggleInactive = (currencyName: string) => {
  setEditedInactive(prev => {
    const next = new Map(prev);
    next.set(currencyName, !prev.get(currencyName));
    return next;
  });
};

// Render toggle column in edit mode
{isEditing && (
  <td className="px-2 py-1.5 text-center">
    <button onClick={() => handleToggleInactive(def.name)} /* toggle UI */ />
    <div>Active/Inactive label</div>
  </td>
)}
```

#### 2. Close Button Rounded Corners
```typescript
// CurrencyAuditFlyout.tsx
<button
  onClick={onClose}
  className="w-[56px] h-[41px] ... rounded-lg btn-aluminium-brushed" // ← Added rounded-lg
>
  Close
</button>
```

### Key Commit
- **Commit:** `113222ad`
- **Branch:** `feature/comprehensive-build-algorithm`

---

## PIN 3: Inactive Currency "Inactive" Tag Not Showing Inline with Orange Colour — Changes Not Taking Effect

### Problem Statement
User requested that in the Currency Status page (Staff/Trainee profile):
1. The "Inactive" tag should be on the same line as the currency title
2. The "Inactive" tag should be dull orange colour

After multiple commits and pushes, changes were not visible in the deployed application. The "Inactive" tag remained on a separate line below the currency name.

### Root Cause
**Railway serves pre-built static JavaScript bundles**, not the source files directly. When source components change:
1. Source files are updated (`.tsx` files)
2. Railway attempts to rebuild but sometimes serves cached bundles
3. **Critical gap:** Build artifacts must be committed to the git repository
4. Without committing the built `index.js` bundle, Railway continues serving the old static files

The build process (`vite build --outDir dfp-neo-platform/public/flight-school-app`) generates a massive bundled JavaScript file (4.8MB) containing all React components. If this file isn't updated and committed, the UI never reflects the source changes.

### Solution

#### 1. Fixed Both Currency Components
**CurrencyPanel.tsx** (profile flyout):
```typescript
<div className="flex flex-row items-center">
  <span className={`${isInactive ? 'text-gray-400' : 'text-gray-200'}`} title={def.name}>{def.name}</span>
  {isInactive && <span className="ml-2 text-[9px] text-orange-400 font-normal whitespace-nowrap">Inactive</span>}
</div>
```

**CurrencyStatusPage.tsx** (full page view):
```typescript
<div className={`text-sm font-medium ${isInactive && !isEditing ? 'text-gray-400' : 'text-white'} flex items-center`}>
  {def.name}
  {isInactive && !isEditing && (
    <span className="ml-2 text-xs text-orange-400 px-1.5 py-0.5 rounded whitespace-nowrap">Inactive</span>
  )}
</div>
```

#### 2. Build Process — Crucial Final Step
After source changes are made, the build MUST be run and artifacts committed:
```bash
# 1. Run the build locally
cd DFP-NEO-V2-fresh
npm run build

# 2. Commit the built assets (index.js, index.js.map, index.html, index-v2.html)
git add dfp-neo-platform/public/flight-school-app/
git commit -m "Build: include updated components"

# 3. Push to trigger Railway deployment
git push
```

### Key Changes
- **Inline display:** Used `flex flex-row items-center` with `whitespace-nowrap` to keep currency name and "Inactive" tag on same line
- **Colour matching:** Inactive currency text uses `text-gray-400` matching "ID Number" title color
- **Dull orange:** "Inactive" tag uses `text-orange-400` for dull orange appearance

### Key Commits
- **Source fixes:** `f592dec8`, `e0e1738a`
- **Build commit:** `e33cc1fe` — includes pre-built JavaScript bundle

### Important Note
For Railway deployments to work correctly with this project:
1. Always run `npm run build` locally after component changes
2. Commit the generated `dfp-neo-platform/public/flight-school-app/` directory
3. The `vite build --outDir` flag in package.json is critical — it must use the correct output directory

---

## PIN 4: Currency Audit Not Recording — Silent Skip Due to Wrong User Lookup

### Problem Statement
Audit page in Currency Status (Staff/Trainee profile) showed "No audit logs found" even after making and saving currency changes.

### Root Cause
**Critical bug in `/api/audit/currency` (server.js):**

The `AuditLog` table requires a valid `userId` foreign key pointing to `User.id` (UUID primary key).

The frontend sends `currentUserId = sessionUser.userId` which is the **PMKEYS number** (e.g. `"4695103"`), stored in `User.userId` field.

The server was doing:
```javascript
// WRONG — looking for PMKEYS number in UUID field
const user = await db.user.findFirst({ where: { id: userId } });
```

But should be:
```javascript
// CORRECT — looking for PMKEYS number in userId field
const user = await db.user.findFirst({ where: { userId: String(userId) } });
```

Since no UUID matched the PMKEYS number, user lookup always failed → audit was **silently skipped** with a console warning and `{ success: true, warning: 'Audit entry skipped: user not found in DB' }`.

### Prisma Schema Reference
```prisma
model User {
  id       String  @id @default(cuid())  // UUID — primary key (used as FK)
  userId   String  @unique               // PMKEYS number — what frontend sends
  username String  @unique
  ...
}

model AuditLog {
  userId   String   // FK → User.id (UUID)
  ...
}
```

### Fix Applied (server.js)
```javascript
// 1. Look up by User.userId (PMKEYS) — what the frontend actually sends
if (userId) {
  const user = await db.user.findFirst({ where: { userId: String(userId) } });
  if (user) dbUserId = user.id;
}

// 2. Fallback: match by username or name fragments
if (!dbUserId && userName) {
  const user = await db.user.findFirst({
    where: {
      OR: [
        { username: { contains: userName, mode: 'insensitive' } },
        { lastName: { contains: nameParts[0], mode: 'insensitive' } },
        { firstName: { contains: nameParts[1], mode: 'insensitive' } },
      ]
    }
  });
  if (user) dbUserId = user.id;
}

// 3. Last resort: use first active user — audit is NEVER silently dropped
if (!dbUserId) {
  const fallbackUser = await db.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (fallbackUser) dbUserId = fallbackUser.id;
}
```

### Key Commit
- **Commit:** `dacc7ad6`
- **Branch:** `feature/comprehensive-build-algorithm`

### Key Rule Going Forward
**NEVER** silently skip audit entries. Always use a fallback user if the exact match fails. The actual display name (`userName`) is stored in the `changes` JSON field so it always shows correctly in the UI regardless of which DB user was used as the FK.

---

## Railway Deployment Reference
- Root Directory: `DFP-NEO-V2-fresh`
- Branch: `feature/comprehensive-build-algorithm`
- Build command: `npm run build` (uses `--outDir` flag in vite config — critical!)
- Auto-deploys on push

## How Users Access Currency Audit Features
1. Open Staff or Trainee profile → click **Currency** tab
2. Click **Edit** → make date changes or toggle Active/Inactive per currency
3. Click **Save** → changes recorded to DB
4. Click **Audit** → see full history: who changed what, when, and what changed