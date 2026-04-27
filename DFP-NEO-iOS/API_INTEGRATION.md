# DFP-NEO Mobile API Integration Guide

This document details the exact API contracts expected by the DFP-NEO iOS mobile app.

## 🔐 Authentication Flow

### 1. Login

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "userId": "string",
  "password": "string"
}
```

**Success Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "clx123456",
    "userId": "PILOT001",
    "displayName": "John Doe",
    "email": "john.doe@example.com",
    "status": "active",
    "permissionsRole": {
      "id": "role123",
      "name": "Trainee"
    },
    "mustChangePassword": false
  }
}
```

**Error Response** (401):
```json
{
  "error": "Unauthorized",
  "message": "Invalid user ID or password"
}
```

### 2. Token Refresh

**Endpoint**: `POST /api/auth/refresh`

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

**Error Response** (401):
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired refresh token"
}
```

### 3. Logout

**Endpoint**: `POST /api/auth/logout`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Request**: Empty body or `{}`

**Success Response** (200):
```json
{
  "success": true
}
```

### 4. Get Current User

**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Success Response** (200):
```json
{
  "id": "clx123456",
  "userId": "PILOT001",
  "displayName": "John Doe",
  "email": "john.doe@example.com",
  "status": "active",
  "permissionsRole": {
    "id": "role123",
    "name": "Trainee"
  },
  "mustChangePassword": false
}
```

## 📅 Schedule API

### Get Daily Schedule

**Endpoint**: `GET /api/schedule?date=YYYY-MM-DD`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Query Parameters**:
- `date`: Date in YYYY-MM-DD format (e.g., "2024-01-15")

**Success Response - Published Schedule** (200):
```json
{
  "schedule": {
    "id": "schedule123",
    "date": "2024-01-15",
    "isPublished": true,
    "serverTime": "2024-01-15T08:30:00.000Z",
    "events": [
      {
        "id": "event123",
        "startTime": "09:00",
        "endTime": "11:00",
        "eventType": "Flight",
        "location": "YBBN",
        "role": "Student",
        "status": "Published",
        "aircraft": "VH-ABC",
        "instructor": "CPT Smith",
        "notes": "Pre-flight briefing at 08:45"
      },
      {
        "id": "event124",
        "startTime": "13:00",
        "endTime": "14:00",
        "eventType": "Brief",
        "location": "Briefing Room 2",
        "role": "Student",
        "status": "Published",
        "aircraft": null,
        "instructor": "CPT Smith",
        "notes": null
      }
    ]
  },
  "message": null
}
```

**Success Response - Unpublished Schedule** (200):
```json
{
  "schedule": null,
  "message": "Schedule for 2024-01-16 has not been published yet"
}
```

**Error Response** (404):
```json
{
  "error": "Not Found",
  "message": "No schedule found for the specified date"
}
```

### Event Types

Valid `eventType` values:
- `"Flight"` - Flying activity
- `"FTD"` - Flight Training Device
- `"Simulator"` - Simulator session
- `"Brief"` - Briefing
- `"Duty"` - Duty period
- `"Ground"` - Ground training
- `"Other"` - Other activities

### Event Roles

Valid `role` values:
- `"Student"` - Trainee/Student
- `"Instructor"` - Instructor
- `"Crew"` - Crew member
- `"Observer"` - Observer
- `"Pilot"` - Pilot
- `"Co-Pilot"` - Co-Pilot

### Event Status

Valid `status` values:
- `"Published"` - Confirmed and published
- `"Cancelled"` - Cancelled event
- `"Amended"` - Modified after publication
- `"Tentative"` - Tentative/unconfirmed
- `"Confirmed"` - Confirmed

## 🚫 Unavailability API

### Get Unavailability Reasons

**Endpoint**: `GET /api/unavailability/reasons`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Success Response** (200):
```json
{
  "reasons": [
    {
      "id": "reason1",
      "code": "SICK",
      "description": "Sick Leave",
      "requiresApproval": true
    },
    {
      "id": "reason2",
      "code": "LEAVE",
      "description": "Annual Leave",
      "requiresApproval": true
    },
    {
      "id": "reason3",
      "code": "MEDICAL",
      "description": "Medical Appointment",
      "requiresApproval": false
    },
    {
      "id": "reason4",
      "code": "PERSONAL",
      "description": "Personal Reasons",
      "requiresApproval": true
    }
  ]
}
```

### Submit Quick Unavailability

**Endpoint**: `POST /api/unavailability/quick`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "date": "2024-01-15",
  "reasonId": "reason1",
  "notes": "Feeling unwell, unable to attend training"
}
```

**Success Response** (200):
```json
{
  "id": "unavail123",
  "status": "Pending",
  "startDateTime": "2024-01-15T08:00:00.000Z",
  "endDateTime": "2024-01-15T23:00:00.000Z",
  "reason": {
    "id": "reason1",
    "code": "SICK",
    "description": "Sick Leave",
    "requiresApproval": true
  },
  "notes": "Feeling unwell, unable to attend training",
  "submittedAt": "2024-01-15T07:30:00.000Z",
  "message": "Unavailability registered. Awaiting supervisor approval."
}
```

**Error Response - Conflict** (409):
```json
{
  "error": "Conflict",
  "message": "Unavailability conflicts with scheduled events",
  "conflicts": [
    "Flight training at 09:00-11:00",
    "Briefing at 13:00-14:00"
  ]
}
```

### Submit Custom Unavailability

**Endpoint**: `POST /api/unavailability/create`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "startDateTime": "2024-01-15T14:00:00.000Z",
  "endDateTime": "2024-01-15T16:00:00.000Z",
  "reasonId": "reason3",
  "notes": "Dental appointment"
}
```

**Success Response** (200):
```json
{
  "id": "unavail124",
  "status": "Approved",
  "startDateTime": "2024-01-15T14:00:00.000Z",
  "endDateTime": "2024-01-15T16:00:00.000Z",
  "reason": {
    "id": "reason3",
    "code": "MEDICAL",
    "description": "Medical Appointment",
    "requiresApproval": false
  },
  "notes": "Dental appointment",
  "submittedAt": "2024-01-15T07:45:00.000Z",
  "message": "Unavailability automatically approved."
}
```

**Error Response - Validation** (400):
```json
{
  "error": "Bad Request",
  "message": "End date must be after start date"
}
```

### Unavailability Status Values

- `"Pending"` - Awaiting approval
- `"Approved"` - Approved by supervisor
- `"Rejected"` - Rejected by supervisor
- `"Conflicted"` - Conflicts with existing schedule

## 🔒 Security Requirements

### HTTPS Only
All API calls must use HTTPS. The app will reject HTTP connections.

### Authentication Header
All authenticated endpoints require:
```
Authorization: Bearer {accessToken}
```

### Token Expiry
- Access tokens should expire after 1 hour (3600 seconds)
- Refresh tokens should be long-lived (7-30 days)
- The app will automatically refresh tokens when they expire

### CORS Configuration
If your API is on a different domain, configure CORS to allow:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

## 📊 Response Codes

### Success Codes
- `200 OK` - Request successful
- `201 Created` - Resource created successfully

### Client Error Codes
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Request conflicts with current state

### Server Error Codes
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

## 🧪 Testing Your API

### Test Authentication
```bash
# Login
curl -X POST https://dfp-neo.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"PILOT001","password":"password123"}'

# Refresh Token
curl -X POST https://dfp-neo.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Test Schedule
```bash
# Get Schedule
curl -X GET "https://dfp-neo.com/api/schedule?date=2024-01-15" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Unavailability
```bash
# Get Reasons
curl -X GET https://dfp-neo.com/api/unavailability/reasons \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Submit Quick Unavailability
curl -X POST https://dfp-neo.com/api/unavailability/quick \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15","reasonId":"reason1","notes":"Test"}'
```

## 🔄 Data Synchronization

### Schedule Updates
- The app polls for schedule updates on pull-to-refresh
- Schedule data is cached locally for offline viewing
- Last update timestamp is displayed to the user

### Real-time Requirements
- Schedule changes should be reflected within 2 seconds of refresh
- Unavailability submissions should be processed immediately
- Status updates should be available within 5 seconds

## 📝 Implementation Checklist

Backend developers should ensure:

- [ ] All endpoints return correct HTTP status codes
- [ ] Authentication tokens are JWT format
- [ ] Token expiry is properly enforced
- [ ] HTTPS is enforced (no HTTP)
- [ ] CORS is configured correctly
- [ ] Error messages are user-friendly
- [ ] Date/time formats are ISO 8601
- [ ] Schedule publication state is respected
- [ ] Unavailability conflicts are detected
- [ ] All required fields are validated
- [ ] Response times are under 2 seconds
- [ ] Rate limiting is implemented
- [ ] Audit logging is enabled

## 🚀 Going Live

Before production deployment:

1. **Test all endpoints** with the mobile app
2. **Verify SSL certificate** is valid and trusted
3. **Configure rate limiting** to prevent abuse
4. **Enable audit logging** for security
5. **Set up monitoring** for API health
6. **Document any custom fields** or extensions
7. **Provide API status page** for uptime monitoring

## 📞 Support

For API integration questions:
- Review this document thoroughly
- Test with curl/Postman first
- Check server logs for errors
- Contact DFP-NEO backend team