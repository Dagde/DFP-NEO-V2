# DFP-NEO Build Algorithm — Thorough Analysis of Current Bugs

## Executive Summary

There are **three distinct root-cause bugs** causing the two reported symptoms:
1. Instructors not being allocated to flight tiles
2. Mockdata staff appearing in FTD (and potentially other events)

---

## BUG 1 — DB Instructors Have Role `INSTRUCTOR`, Algorithm Requires `QFI`

### The Problem

The build algorithm (in `generateDfpInternal`) uses two filters for flight/FTD eligibility:

**Flight candidates (line ~2401):**
```typescript
if (type === 'flight' && ip.role !== 'QFI') return false;
```

**FTD candidates (line ~2390–2398):**
```typescript
const simIps = instructors.filter(i => i.role === 'SIM IP' && ...);
const availableQfis = instructors.filter(i => i.role === 'QFI' && ...);
candidates = [...simIps, ...availableQfis];
```

**Night flying pool (line ~1937):**
```typescript
if (ip.role !== 'QFI') return false;
```

### What the DB actually has

From the production database:
```
Roles: { 'INSTRUCTOR': 93, 'QFI': 1, 'SIM IP': 6 }
```

- **93 of 100 DB staff** have `role = 'INSTRUCTOR'`
- Only **Burns** has `role = 'QFI'`
- **6 SIM IPs** are correct

The mockdata creates all instructors with `role: 'QFI'`, so they pass every filter. But the 93 DB instructors with `role: 'INSTRUCTOR'` are rejected by every flight/FTD filter. This means **only Burns can ever be allocated to a flight tile**, and only the 6 SIM IPs plus Burns can be allocated to FTD tiles.

### Why mockdata staff appear in FTD

When the build runs, the `instructorsData` useMemo (in App.tsx ~line 4065) includes **both DB and mockdata instructors** when both toggles are on. The mockdata instructors have `role: 'QFI'`, so they pass all filters and get allocated. DB instructors (role: 'INSTRUCTOR') get filtered out. The result: flight tiles show only Burns (the only DB QFI) and mockdata QFIs fill in; FTD tiles show SIM IPs (correct) plus mockdata QFIs (wrong) instead of DB instructors.

### Fix Required

Update all 93 DB `INSTRUCTOR` records to have `role = 'QFI'`. They are flying instructors — QFI is the correct role. The algorithm was designed with the mockdata role taxonomy in mind (`QFI`, `SIM IP`, `INSTRUCTOR` in mock = Ground-only instructor), but the DB was seeded with `INSTRUCTOR` for all.

Additionally, `isFlyingSupervisor` and `isExecutive` flags need to be set on the appropriate DB records (currently all default to `false`) — WGCDRs and SQNLDRs above a certain seniority should have `isExecutive: true` and designated supervisors `isFlyingSupervisor: true`.

---

## BUG 2 — Night Instructor "Reservation" Uses `idNumber` to Find Instructor, But All DB Staff Have `idNumber: null`

### The Problem

After selecting night flying instructors, the algorithm tries to add a "day unavailability reservation" to block them from day events:

```typescript
// Line ~1963
const instructorToUpdate = instructors.find(i => i.idNumber === nfi.idNumber);
if (instructorToUpdate) {
    instructorToUpdate.unavailability.push(reservationPeriod);
}
```

All 100 DB personnel have `idNumber: null`. So `i.idNumber === nfi.idNumber` becomes `null === null` — which is `true` for **every** instructor. This means the first instructor found (alphabetically, Anderson, David) gets the reservation, not the intended night instructor. 

**Effect:** The correct night instructor does NOT get blocked from day events. Other instructors may be incorrectly blocked. However, since the night pool only picks `role === 'QFI'` instructors, and currently only Burns is QFI, this bug has limited visible effect for now — but once Bug 1 is fixed and all 93 are QFI, this will cause serious scrambling.

### Fix Required

Change the lookup to use `i.name === nfi.name` (or `i.id === nfi.id`) instead of `i.idNumber === nfi.idNumber`:

```typescript
// Before (broken):
const instructorToUpdate = instructors.find(i => i.idNumber === nfi.idNumber);

// After (correct):
const instructorToUpdate = instructors.find(i => i.name === nfi.name);
```

---

## BUG 3 — `instructorsData` useMemo Has No Location Filter; All 100 DB Staff (ESL + PEA) Enter the Build Regardless of Selected School

### The Problem

The `instructorsData` useMemo (line ~4065) filters only by `_dataSource` (mock vs. DB toggle), but performs **no location filtering**:

```typescript
const instructorsData = useMemo(() => {
    const { staff: mockOn, staffDb: dbOn } = dataSourceSettings;
    if (!mockOn && !dbOn) return [];
    if (mockOn && dbOn) return allInstructorsData;                         // ALL instructors, no location filter
    if (mockOn && !dbOn) return allInstructorsData.filter(i => (i as any)._dataSource !== 'database');
    return allInstructorsData.filter(i => (i as any)._dataSource === 'database');  // ALL DB, no location filter
}, [allInstructorsData, dataSourceSettings]);
```

This is then passed directly into the build config:
```typescript
const instructorsInBuild = instructorsData;  // line 8303
```

So when building at ESL, the build receives **all 100 DB instructors** including the 37 who are at Pearce (2FTS). When building at PEA, all 63 ESL instructors are included too.

The `isInstructorEligibleByUnit` function does enforce unit matching when `staffSharingEnabled = false`, which would prevent cross-location instructor allocation. However the entire pool is iterated, slowing the build and causing confusing diagnostic output. More critically: **if staff sharing is enabled**, all 100 instructors become candidates regardless of location, which is wrong.

### The trainees useMemo DOES have location filtering

```typescript
const locationFilteredTrainees = allTraineesData.filter(t => {
    if (t.location) return t.location === locationFullName;
    if (t.unit) {
        if (t.unit.startsWith('2FTS')) return locationFullName === 'Pearce';
        if (t.unit.startsWith('1FTS') || t.unit.startsWith('CFS')) return locationFullName === 'East Sale';
    }
    return true;
});
```

The same logic should be applied to `instructorsData`.

### Fix Required

Add location filtering to the `instructorsData` useMemo:

```typescript
const instructorsData = useMemo(() => {
    const { staff: mockOn, staffDb: dbOn } = dataSourceSettings;
    const locationFullName = school === 'ESL' ? 'East Sale' : 'Pearce';
    
    const locationFiltered = allInstructorsData.filter(i => {
        if (!i.location && !i.unit) return true; // no location data, include by default
        if (i.location) return i.location === locationFullName;
        if (i.unit) {
            if (i.unit.startsWith('2FTS')) return locationFullName === 'Pearce';
            if (i.unit.startsWith('1FTS') || i.unit.startsWith('CFS')) return locationFullName === 'East Sale';
        }
        return true;
    });
    
    if (!mockOn && !dbOn) return [];
    if (mockOn && dbOn) return locationFiltered;
    if (mockOn && !dbOn) return locationFiltered.filter(i => (i as any)._dataSource !== 'database');
    return locationFiltered.filter(i => (i as any)._dataSource === 'database');
}, [allInstructorsData, dataSourceSettings, school]);
```

---

## BUG 4 (Secondary) — `isFlyingSupervisor` and `isExecutive` Flags Not Set on DB Staff

### The Problem

The Duty Supervisor scheduling loop at line ~2900 filters using:
```typescript
const dutySupEligible = instructors.filter(i =>
    (i.isFlyingSupervisor || i.unavailability.some(u => u.reason === 'TMUF - Ground Duties only' && ...)) &&
    ...
);
```

All 100 DB personnel have `isFlyingSupervisor: false` (the Prisma default). This means **no DB instructor qualifies as a Duty Supervisor**, so the Duty Sup slot will either be empty or filled entirely by mockdata instructors.

Similarly, `isExecutive: false` for all DB staff means no one gets the executive event limits applied, which may cause over-scheduling.

### Fix Required

Set `isFlyingSupervisor: true` on the WGCDRs and designated SQNLDRs who hold Flying Supervisor qualification. Set `isExecutive: true` on WGCDRs and OCs Flight.

---

## Summary Table

| Bug | Root Cause | Symptom | Fix |
|-----|-----------|---------|-----|
| **1** | 93 DB instructors have `role='INSTRUCTOR'`, algorithm requires `role='QFI'` for flight/FTD | No DB instructors allocated to flights; mockdata QFIs fill in instead | Update DB: set `role='QFI'` for all flying instructors |
| **2** | Night reservation lookup uses `i.idNumber === nfi.idNumber` but all DB staff have `idNumber: null` | Wrong instructor gets night reservation (all null IDs match) | Change lookup to use `i.name === nfi.name` |
| **3** | `instructorsData` useMemo has no location filter; all 100 DB staff enter the build | Both ESL and PEA instructors mixed in every build | Add location filter to `instructorsData` useMemo (same logic as `traineesData`) |
| **4** | `isFlyingSupervisor: false` on all DB staff | No DB instructor qualifies as Duty Supervisor; slot left empty or filled by mockdata | Set `isFlyingSupervisor: true` on qualifying DB personnel |

---

## Recommended Fix Order

1. **Fix Bug 1 (DB role update)** — This is a database change. Run a script to update `role` from `'INSTRUCTOR'` to `'QFI'` for all non-SIM-IP, non-Burns DB personnel who are flying instructors. This immediately makes all 93 DB instructors eligible for flight/FTD tiles.

2. **Fix Bug 2 (night reservation lookup)** — Code change in `App.tsx` line ~1963. One-line fix.

3. **Fix Bug 3 (location filter)** — Code change in `App.tsx` `instructorsData` useMemo. Prevents wrong-location instructors from entering the build.

4. **Fix Bug 4 (isFlyingSupervisor)** — DB update to set flags on WGCDRs/SQNLDRs who are Flying Supervisors.

---

## The No-Mockdata Requirement

To ensure no mockdata staff or trainees appear in the daily schedule at all, the cleanest solution is to ensure:

1. The **"Staff (Mock)"** data source toggle is turned **OFF** in settings — this is a user-controlled toggle that should be OFF in production use
2. The **"Trainee (Mock)"** data source toggle is also **OFF**
3. Only the **"Staff DB"** and **"Trainee DB"** toggles are ON

When only DB toggles are ON, `instructorsData` filters to `_dataSource === 'database'` only, and no mockdata enters the build. The fix for Bug 1 then ensures those DB instructors are correctly allocated.

However, until Bug 1 is fixed (roles updated), turning off mockdata means NO instructors can be allocated to flights (only Burns), which is worse than the current state. **Bug 1 must be fixed first.**