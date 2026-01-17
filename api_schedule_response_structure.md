# GET /api/schedule Response Structure

## Request Details

**Endpoint**: `GET /api/schedule`

**Query Parameters Supported**:
- `userId` (optional) - Filter schedules by user ID
- `startDate` (optional) - Filter schedules starting from this date (ISO 8601 format)
- `endDate` (optional) - Filter schedules ending before this date (ISO 8601 format)

**Authentication**: Required (via NextAuth session cookies)

---

## Response Shape

```json
{
  "schedules": [
    {
      "id": "clxxxxxxxxxxxxxxxxxxx",
      "userId": "clxxxxxxxxxxxxxxxxxxx",
      "date": "2024-12-15",
      "data": { /* JSON object with schedule data */ },
      "version": "flight-school",
      "createdAt": "2024-12-15T10:30:00.000Z",
      "updatedAt": "2024-12-15T10:30:00.000Z",
      "user": {
        "userId": "clxxxxxxxxxxxxxxxxxxx",
        "firstName": "John",
        "lastName": "Doe",
        "role": "ADMIN"
      }
    }
  ]
}
```

---

## Complete Example Object

```json
{
  "schedules": [
    {
      "id": "clpmabc123def456ghi789jkl",
      "userId": "clpmxyz987uvw654rst321qpo",
      "date": "2024-12-15",
      "data": {
        "events": [
          {
            "id": "evt-001",
            "title": "FTD Event A",
            "startTime": "08:00",
            "endTime": "10:00",
            "instructorId": "inst-001",
            "aircraftType": "A330",
            "type": "FTD"
          },
          {
            "id": "evt-002",
            "title": "Flight Event B",
            "startTime": "14:00",
            "endTime": "16:00",
            "instructorId": "inst-002",
            "aircraftType": "PC-21",
            "type": "FLIGHT"
          }
        ],
        "notes": "Regular schedule",
        "overrides": []
      },
      "version": "flight-school",
      "createdAt": "2024-12-15T10:30:00.000Z",
      "updatedAt": "2024-12-15T11:45:00.000Z",
      "user": {
        "userId": "clpmxyz987uvw654rst321qpo",
        "firstName": "John",
        "lastName": "Doe",
        "role": "ADMIN"
      }
    }
  ]
}
```

---

## Field Definitions

### Top-Level Fields
- `schedules` (Array) - Array of schedule objects

### Schedule Object Fields
- `id` (String) - Unique schedule ID (CUID format)
- `userId` (String) - User ID who owns this schedule (references User table)
- `date` (String) - Date string in YYYY-MM-DD format
- `data` (JSON) - Schedule data content (flexible JSON structure containing events, notes, etc.)
- `version` (String) - Schedule version (default: "flight-school")
- `createdAt` (DateTime) - ISO 8601 timestamp when record was created
- `updatedAt` (DateTime) - ISO 8601 timestamp when record was last updated

### Nested User Object Fields
- `userId` (String) - User ID
- `firstName` (String) - User's first name
- `lastName` (String) - User's last name
- `role` (String) - User's role (e.g., "ADMIN", "USER", etc.)

---

## Query Parameter Examples

### Get all schedules (no filters)
```
GET /api/schedule
```

### Get schedules for a specific user
```
GET /api/schedule?userId=clpmxyz987uvw654rst321qpo
```

### Get schedules for a date range
```
GET /api/schedule?startDate=2024-12-01&endDate=2024-12-31
```

### Get schedules for a specific user in a date range
```
GET /api/schedule?userId=clpmxyz987uvw654rst321qpo&startDate=2024-12-01&endDate=2024-12-31
```

---

## Database Schema

```prisma
model Schedule {
  id        String   @id @default(cuid())
  userId    String
  date      String
  data      Json
  version   String   @default("flight-school")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, version])
  @@index([userId])
  @@index([date])
}
```

---

## Notes

1. **Data Field**: The `data` field is a flexible JSON field that can contain any structure. The example above shows a typical structure with `events`, `notes`, and `overrides`, but the actual content depends on how the application saves schedule data.

2. **Date Format**: The `date` field is stored as a String (not DateTime) in YYYY-MM-DD format.

3. **Unique Constraint**: There is a unique constraint on `[userId, date, version]`, meaning each user can only have one schedule per date per version.

4. **Sorting**: Results are returned in ascending order by `date`.

5. **Authentication**: The endpoint requires an authenticated session via NextAuth cookies.

6. **Error Responses**:
   - `401 Unauthorized` - No valid session
   - `500 Internal Server Error` - Database or server error