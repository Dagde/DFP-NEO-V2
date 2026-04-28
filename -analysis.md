# DFP-NEO Backend Analysis & Mobile API Implementation Plan

## Current Backend Architecture

### Database Schema (Prisma/PostgreSQL)
**Key Tables:**
- **User** - Users with authentication
  - Fields: id, userId (unique), username, email, password, role (SUPER_ADMIN, ADMIN, PILOT, INSTRUCTOR, USER)
  - Password hashing: bcryptjs (12 rounds)
  
- **Schedule** - User schedules/events
  - Fields: id, userId, date, data (JSON), version, createdAt, updatedAt
  - Unique constraint: [userId, date, version]
  
- **Session** - Web session management
- **AuditLog** - Audit trail

### API Endpoints (Existing)
- `GET /api/schedule` - Get schedules (userId, startDate, endDate filters)
- `POST /api/schedule` - Save schedule (userId, date, data)
- `POST /api/auth/verify-password` - Verify password
- `GET /api/users-with-personnel` - User-personnel linking

### Authentication System
- **Web App**: Uses sessions (Session table + cookies)  
- **Password Verification**: bcryptjs
- **NO JWT IMPLEMENTED** - This is the critical gap

## Mobile API Requirements

The iOS app expects these endpoints:
1. `POST /api/mobile/auth/login` - JWT login
2. `POST /api/mobile/auth/refresh` - JWT refresh
3. `GET /api/mobile/schedule?date=YYYY-MM-DD` - Get user's schedule with JWT

## Implementation Tasks

### 1. Install JWT Dependencies
```bash
npm install jsonwebtoken
```

### 2. Add Mobile Authentication Endpoints
- JWT token generation
- Token validation middleware
- Login endpoint that validates credentials and returns JWT
- Refresh token endpoint

### 3. Add Mobile Schedule Endpoint
- Extract userId from JWT
- Query Schedule table
- Return schedule data in format expected by iOS app

## Database Access
- Uses Prisma ORM with PostgreSQL
- Database URL stored in DATABASE_URL environment variable
- Lazy-loaded Prisma client in server.js

## Next Steps
1. Install jsonwebtoken dependency
2. Implement mobile auth endpoints
3. Implement mobile schedule endpoint
4. Test with iOS app