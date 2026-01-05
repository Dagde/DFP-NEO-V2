# DFP-NEO Mobile API Implementation

## Overview
This document describes the implementation of the mobile API endpoints for the DFP-NEO iOS app.

## API Endpoints Implemented

### Authentication Endpoints

#### 1. POST `/api/mobile/auth/login`
- **Purpose**: Authenticate user and return JWT tokens
- **Request Body**:
  ```json
  {
    "userId": "string",
    "password": "string"
  }
  ```
- **Response**: Access token, refresh token, and user data
- **Implementation**: `app/api/mobile/auth/login/route.ts`

#### 2. POST `/api/mobile/auth/refresh`
- **Purpose**: Refresh expired access token
- **Request Body**:
  ```json
  {
    "refreshToken": "string"
  }
  ```
- **Response**: New access token
- **Implementation**: `app/api/mobile/auth/refresh/route.ts`

#### 3. POST `/api/mobile/auth/logout`
- **Purpose**: Logout user (client-side token deletion)
- **Response**: Success confirmation
- **Implementation**: `app/api/mobile/auth/logout/route.ts`

#### 4. GET `/api/mobile/auth/me`
- **Purpose**: Get current user information
- **Headers**: `Authorization: Bearer {token}`
- **Response**: User data
- **Implementation**: `app/api/mobile/auth/me/route.ts`

### Schedule Endpoints

#### 5. GET `/api/mobile/schedule?date=YYYY-MM-DD`
- **Purpose**: Get user's schedule for a specific date
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**: `date` (YYYY-MM-DD format)
- **Response**: Schedule with events or message if unpublished
- **Implementation**: `app/api/mobile/schedule/route.ts`

### Unavailability Endpoints

#### 6. GET `/api/mobile/unavailability/reasons`
- **Purpose**: Get list of unavailability reasons
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Array of reasons with codes and approval requirements
- **Implementation**: `app/api/mobile/unavailability/reasons/route.ts`

#### 7. POST `/api/mobile/unavailability/quick`
- **Purpose**: Submit full-day unavailability
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "date": "YYYY-MM-DD",
    "reasonId": "string",
    "notes": "string (optional)"
  }
  ```
- **Response**: Unavailability record with status
- **Implementation**: `app/api/mobile/unavailability/quick/route.ts`

#### 8. POST `/api/mobile/unavailability/create`
- **Purpose**: Submit custom time-range unavailability
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "startDateTime": "ISO 8601 datetime",
    "endDateTime": "ISO 8601 datetime",
    "reasonId": "string",
    "notes": "string (optional)"
  }
  ```
- **Response**: Unavailability record with status
- **Implementation**: `app/api/mobile/unavailability/create/route.ts`

## Database Schema Changes

### New Models Added

#### UnavailabilityReason
```prisma
model UnavailabilityReason {
  id                String   @id @default(cuid())
  code              String   @unique
  description       String
  requiresApproval  Boolean  @default(true)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  unavailabilities  Unavailability[]
}
```

#### Unavailability
```prisma
model Unavailability {
  id              String   @id @default(cuid())
  userId          String
  reasonId        String
  startDateTime   DateTime
  endDateTime     DateTime
  status          String   @default("Pending")
  notes           String?
  submittedAt     DateTime @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?
  conflicts       Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation("UserUnavailability")
  reason          UnavailabilityReason @relation()
}
```

## Utility Libraries

### JWT Authentication (`lib/mobile-auth.ts`)
- `generateAccessToken(userId)` - Generate 1-hour access token
- `generateRefreshToken(userId)` - Generate 30-day refresh token
- `verifyToken(token)` - Verify and decode JWT
- `getUserFromToken(token)` - Get user from access token
- `formatUserForMobile(user)` - Format user data for API response

### Middleware (`lib/mobile-middleware.ts`)
- `authenticateMobileRequest(request)` - Authenticate mobile API requests

## Security Features

1. **JWT-based Authentication**
   - Access tokens expire after 1 hour
   - Refresh tokens expire after 30 days
   - Tokens signed with NEXTAUTH_SECRET

2. **Authorization**
   - All protected endpoints require Bearer token
   - Token validation on every request
   - User status check (must be 'active')

3. **Input Validation**
   - Date format validation
   - Required field validation
   - Datetime range validation

4. **HTTPS Enforcement**
   - Production deployment requires HTTPS
   - Tokens transmitted securely

## Deployment Steps

### 1. Database Migration
```bash
cd dfp-neo-platform
npx prisma db push
```

### 2. Seed Unavailability Reasons
```bash
npx ts-node prisma/seed-unavailability-reasons.ts
```

### 3. Environment Variables
Ensure `NEXTAUTH_SECRET` is set in Railway:
```
NEXTAUTH_SECRET=your-secret-key-here
```

### 4. Deploy to Railway
```bash
git add .
git commit -m "Add mobile API endpoints"
git push origin feature/comprehensive-build-algorithm
```

### 5. Test Endpoints
Use the test commands in `DFP-NEO-iOS/API_INTEGRATION.md`

## Testing Checklist

- [ ] Test login with valid credentials
- [ ] Test login with invalid credentials
- [ ] Test token refresh
- [ ] Test logout
- [ ] Test get current user
- [ ] Test get schedule for published date
- [ ] Test get schedule for unpublished date
- [ ] Test get unavailability reasons
- [ ] Test submit quick unavailability without conflicts
- [ ] Test submit quick unavailability with conflicts
- [ ] Test submit custom unavailability
- [ ] Test all endpoints with invalid/expired tokens
- [ ] Test all endpoints with missing authorization header

## API Response Codes

### Success
- `200 OK` - Request successful
- `201 Created` - Resource created

### Client Errors
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Schedule conflict

### Server Errors
- `500 Internal Server Error` - Server error

## Known Limitations

1. **Schedule Conflict Detection**
   - Current implementation does basic conflict detection
   - Time overlap checking could be more sophisticated
   - Consider implementing proper time range overlap algorithm

2. **Token Blacklisting**
   - Logout doesn't blacklist tokens (client-side deletion only)
   - Consider implementing Redis-based token blacklist for production

3. **Rate Limiting**
   - Not currently implemented
   - Should add rate limiting middleware for production

4. **Audit Logging**
   - Mobile API actions not logged to audit system
   - Consider adding audit logging for security

## Future Enhancements

1. Add endpoint to view user's unavailability history
2. Add endpoint to cancel/modify submitted unavailability
3. Add push notification support for schedule changes
4. Add real-time schedule updates via WebSocket
5. Add batch operations for multiple unavailability submissions
6. Add supervisor approval workflow endpoints
7. Implement proper rate limiting
8. Add comprehensive audit logging

## Support

For questions or issues:
- Review this documentation
- Check `DFP-NEO-iOS/API_INTEGRATION.md` for API contract
- Test with curl/Postman before testing with iOS app
- Check server logs for detailed error messages