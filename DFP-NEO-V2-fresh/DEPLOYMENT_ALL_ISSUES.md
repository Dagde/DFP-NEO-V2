# ALL Deployment Issues - Comprehensive List

## Summary

After multiple deployment attempts, I've identified **11 files** that reference a non-existent `permissionsRole` model. These must all be fixed before deployment can succeed.

## Root Cause

The codebase was designed with a complex permissions system using these models:
- `permissionsRole`
- `PermissionCapability`
- `Capability`

However, these models were **never implemented in the Prisma schema**. The current schema only has:
- `User.role` (enum: SUPER_ADMIN, ADMIN, PILOT, INSTRUCTOR, USER)

## All Files Requiring Fixes

### 1. API Routes (4 files)
```
app/api/mobile/auth/login/route.ts
app/api/admin/users/[id]/route.ts
app/api/admin/users/route.ts
app/api/admin/users/create/route.ts
```

### 2. Admin Pages (7 files)
```
app/admin/users/page.tsx
app/admin/users/[id]/page.tsx
app/admin/users/[id]/EditUserForm.tsx
app/admin/users/create/page.tsx
app/admin/users/create/CreateUserForm.tsx
app/admin/users/UsersList.tsx
app/select/page.tsx
```

## Common Issues in Each File

### Issue 1: Including `permissionsRole` in User queries
```typescript
// ❌ WRONG (permissionsRole doesn't exist)
const user = await prisma.user.findUnique({
  include: {
    permissionsRole: true,
  }
});

// ✅ CORRECT (use role field instead)
const user = await prisma.user.findUnique({
  select: {
    role: true,
  }
});
```

### Issue 2: Querying permissionsRole model
```typescript
// ❌ WRONG (model doesn't exist)
const roles = await prisma.permissionsRole.findMany();

// ✅ CORRECT (use enum values)
const roles = ['SUPER_ADMIN', 'ADMIN', 'PILOT', 'INSTRUCTOR', 'USER'];
```

### Issue 3: Accessing permissionsRole properties
```typescript
// ❌ WRONG
if (user.permissionsRole) {
  // ...
}

// ✅ CORRECT
if (user.role === 'ADMIN') {
  // ...
}
```

## Recommended Fix Strategy

### Option A: Remove All References (RECOMMENDED)
- Remove all `permissionsRole` includes from queries
- Replace `permissionsRole` queries with hardcoded enum values
- Replace `permissionsRole` property access with `role` property
- Simple, quick, maintains current functionality

### Option B: Implement Full Permissions System
- Create `permissionsRole`, `PermissionCapability`, and `Capability` models
- Migrate existing User.role data to new system
- Update all 11 files to use new system
- More complex, time-consuming, better long-term solution

## Detailed File-by-Fix List

### app/admin/users/page.tsx
- Remove `permissionsRole: true` from User include
- Replace `prisma.permissionsRole.findMany()` with hardcoded roles array

### app/admin/users/[id]/page.tsx
- Remove `permissionsRole: true` from User include
- Replace `prisma.permissionsRole.findMany()` with hardcoded roles array

### app/admin/users/[id]/EditUserForm.tsx
- Remove `permissionsRole: true` from User include
- Replace `permissionsRole` selection with `role` enum dropdown

### app/admin/users/create/page.tsx
- Remove `permissionsRole` references
- Use `role` enum for user creation

### app/admin/users/create/CreateUserForm.tsx
- Replace permissionsRole dropdown with role enum dropdown
- Update form submission to use `role` field

### app/admin/users/UsersList.tsx
- Remove `permissionsRole` from User include
- Display `role` instead of `permissionsRole.name`

### app/select/page.tsx
- Remove `permissionsRole` references
- Use `role` for routing logic

### app/api/admin/users/route.ts
- Remove `permissionsRole: true` from User include
- Remove `permissionsRole` from create/update operations

### app/api/admin/users/[id]/route.ts
- Remove `permissionsRole: true` from User include
- Update logic to use `role` field

### app/api/admin/users/create/route.ts
- Remove `permissionsRole` from user creation
- Use `role` enum instead

### app/api/mobile/auth/login/route.ts
- Remove `permissionsRole` from login response
- Include `role` field instead

## Current Status

- ❌ **11 files** need fixes
- ❌ **No permissionsRole model** exists in schema
- ❌ **All 4 deployment attempts** failed due to this issue
- ✅ **Fixes are straightforward** - replace with existing role enum

## Next Steps

1. **Choose fix strategy:** Option A (remove references) or Option B (implement full system)
2. **Apply fixes to all 11 files**
3. **Test build locally:** `npx next build`
4. **Commit and push:** All fixes at once
5. **Verify deployment:** Railway should succeed

---

**This document provides a complete list of all issues. No more trial-and-error deployments needed!**