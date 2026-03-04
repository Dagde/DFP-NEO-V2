# Mobile Authentication API Response Structure

## POST /api/mobile/auth/login

### Request Body
```json
{
  "userId": "string",
  "password": "string"
}
```

### Response (Success - 200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHhtYWJjMTIzZGVmNDU2Z2hpNzg5amtsIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTczNDI0MTIwMCwiZXhwIjoxNzM0MjQ0ODAwfQ.OMITTED",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHhtYWJjMTIzZGVmNDU2Z2hpNzg5amtsIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MzQyNDEyMDAsImV4cCI6MTczNjgzMzIwMH0.OMITTED",
  "expiresIn": 3600,
  "user": {
    "id": "clxmabc123def456ghi789jkl",
    "userId": "ABC12345",
    "displayName": "John Doe",
    "email": "john.doe@example.com",
    "isActive": true,
    "role": "ADMIN"
  }
}
```

### Response (Error - 400 Bad Request)
```json
{
  "error": "Bad Request",
  "message": "User ID and password are required"
}
```

### Response (Error - 401 Unauthorized)
```json
{
  "error": "Unauthorized",
  "message": "Invalid user ID or password"
}
```

or

```json
{
  "error": "Unauthorized",
  "message": "Account is not active"
}
```

or

```json
{
  "error": "Unauthorized",
  "message": "Password not set. Please use the web portal to set your password."
}
```

---

## POST /api/mobile/auth/refresh

### Request Body
```json
{
  "refreshToken": "string"
}
```

### Response (Success - 200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHhtYWJjMTIzZGVmNDU2Z2hpNzg5amtsIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTczNDI0MTIwMCwiZXhwIjoxNzM0MjQ0ODAwfQ.OMITTED",
  "expiresIn": 3600
}
```

### Response (Error - 400 Bad Request)
```json
{
  "error": "Bad Request",
  "message": "Refresh token is required"
}
```

### Response (Error - 401 Unauthorized)
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired refresh token"
}
```

---

## Field Definitions

### Login Response Fields

| Field Name | Type | Description |
|------------|------|-------------|
| `accessToken` | String | JWT access token (valid for 1 hour) |
| `refreshToken` | String | JWT refresh token (valid for 30 days) |
| `expiresIn` | Number | Access token expiry time in seconds (3600 = 1 hour) |
| `user.id` | String | Internal user ID (CUID format, references User table) |
| `user.userId` | String | User ID displayed to users |
| `user.displayName` | String | Full name of the user |
| `user.email` | String | User's email address |
| `user.isActive` | Boolean | Whether the user account is active |
| `user.role` | String | User's role (e.g., "ADMIN", "USER", etc.) |

### Refresh Response Fields

| Field Name | Type | Description |
|------------|------|-------------|
| `accessToken` | String | New JWT access token (valid for 1 hour) |
| `expiresIn` | Number | Access token expiry time in seconds (3600 = 1 hour) |

---

## Token Details

### Access Token
- **Algorithm**: HS256
- **Payload Structure**:
  ```json
  {
    "userId": "clxmabc123def456ghi789jkl",
    "type": "access",
    "iat": 1734241200,
    "exp": 1734244800
  }
  ```
- **Expiry**: 1 hour (3600 seconds)
- **Usage**: Include in `Authorization: Bearer <accessToken>` header for authenticated requests

### Refresh Token
- **Algorithm**: HS256
- **Payload Structure**:
  ```json
  {
    "userId": "clxmabc123def456ghi789jkl",
    "type": "refresh",
    "iat": 1734241200,
    "exp": 1736833200
  }
  ```
- **Expiry**: 30 days (2,592,000 seconds)
- **Usage**: Use to obtain new access tokens without re-authenticating

---

## JWT Payload Structure (Decoded)

### Access Token Payload
```json
{
  "userId": "clxmabc123def456ghi789jkl",
  "type": "access",
  "iat": 1734241200,
  "exp": 1734244800
}
```

### Refresh Token Payload
```json
{
  "userId": "clxmabc123def456ghi789jkl",
  "type": "refresh",
  "iat": 1734241200,
  "exp": 1736833200
}
```

### Payload Fields
- `userId` (String) - Internal user ID from User table
- `type` (String) - Token type: "access" or "refresh"
- `iat` (Number) - Issued at timestamp (Unix epoch)
- `exp` (Number) - Expiration timestamp (Unix epoch)

---

## Authentication Flow

### 1. Login Flow
```
POST /api/mobile/auth/login
  ↓
Returns: accessToken, refreshToken, expiresIn, user
  ↓
Store accessToken and refreshToken securely
  ↓
Use accessToken in Authorization header for API calls
```

### 2. Refresh Token Flow
```
POST /api/mobile/auth/refresh
  ↓
Body: { refreshToken }
  ↓
Returns: new accessToken, expiresIn
  ↓
Replace old accessToken with new one
  ↓
Continue using new accessToken for API calls
```

### 3. Using Access Token
```
GET /api/protected-endpoint
Headers:
  Authorization: Bearer <accessToken>
```

---

## Error Handling

### Common Error Codes
- **400 Bad Request** - Missing required fields (userId, password, or refreshToken)
- **401 Unauthorized** - Invalid credentials, expired token, or inactive account
- **500 Internal Server Error** - Server error during authentication

### Error Response Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

---

## Security Notes

1. **Token Storage**: Store tokens securely on the mobile device (e.g., Keychain on iOS, Keystore on Android)
2. **HTTPS Only**: Always use HTTPS for authentication endpoints
3. **Token Refresh**: Implement automatic token refresh when access token expires
4. **Logout**: Implement logout by discarding stored tokens
5. **Password Security**: Passwords are hashed using bcrypt before storage

---

## Related Endpoints

- `POST /api/mobile/auth/me` - Get current user info (requires access token)
- `POST /api/mobile/auth/logout` - Logout (client-side token deletion)

---

## User ID Field Notes

There are two user ID fields returned:

1. **`id`** (user.id) - Internal database ID (CUID format)
   - Used internally for database operations
   - Example: `"clxmabc123def456ghi789jkl"`

2. **`userId`** (user.userId) - User-facing ID
   - Displayed to users
   - Used for login
   - Example: `"ABC12345"`

**Important**: The JWT payload contains the internal `id` field, not the display `userId` field.