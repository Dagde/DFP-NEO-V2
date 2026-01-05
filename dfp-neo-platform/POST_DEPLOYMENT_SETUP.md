# Post-Deployment Setup Guide

## ✅ Current Status
Mobile API endpoints have been deployed with **temporary static data** for unavailability functionality.

## 🔄 Required Steps After Initial Deployment

### 1. Update Database Schema
Once Railway deployment succeeds, run these commands in the Railway console:

```bash
npx prisma db push
```

This will add the new database tables:
- `UnavailabilityReason`
- `Unavailability`

### 2. Seed Unavailability Reasons
Run the seed script to populate unavailability reasons:

```bash
npx ts-node prisma/seed-unavailability-reasons.ts
```

### 3. Update Unavailability Endpoints
After database schema is updated, update these files to use database instead of static data:

**File: `app/api/mobile/unavailability/reasons/route.ts`**
- Replace static reasons list with: `prisma.unavailabilityReason.findMany()`

**File: `app/api/mobile/unavailability/quick/route.ts`**
- Replace static reason lookup with: `prisma.unavailabilityReason.findUnique()`
- Replace mock response with: `prisma.unavailability.create()`

**File: `app/api/mobile/unavailability/create/route.ts`**
- Replace static reason lookup with: `prisma.unavailabilityReason.findUnique()`
- Replace mock response with: `prisma.unavailability.create()`

## 📋 Test the API

### Authentication Endpoints
```bash
# Test Login
curl -X POST https://dfp-neo.com/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","password":"YOUR_PASSWORD"}'

# Test Get Current User
curl -X GET https://dfp-neo.com/api/mobile/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Schedule Endpoint
```bash
# Test Schedule
curl -X GET "https://dfp-neo.com/api/mobile/schedule?date=2024-01-15" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Unavailability Endpoints
```bash
# Test Get Reasons
curl -X GET https://dfp-neo.com/api/mobile/unavailability/reasons \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Test Quick Unavailability
curl -X POST https://dfp-neo.com/api/mobile/unavailability/quick \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15","reasonId":"reason1","notes":"Test submission"}'
```

## 🔧 Environment Variables Required

Ensure these are set in Railway:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret key for JWT signing

## 📝 Notes

- Initial deployment uses static data for unavailability endpoints
- Full database functionality requires schema migration and endpoint updates
- Authentication and schedule endpoints work immediately after deployment
- iOS app can test basic functionality even before database updates