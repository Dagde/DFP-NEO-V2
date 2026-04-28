# Mobile API Testing Guide

## Quick Test Commands

### 1. Login Test
Replace `YOUR_USER_ID` and `YOUR_PASSWORD` with actual credentials:

```bash
curl -X POST https://dfp-neo.com/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","password":"YOUR_PASSWORD"}'
```

**Expected Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user123",
    "userId": "user123",
    "displayName": "Test User",
    "email": "test@example.com",
    "isActive": true,
    "role": "STUDENT"
  }
}
```

### 2. Schedule Test
First, get your access token from the login response, then:

```bash
curl -X GET "https://dfp-neo.com/api/mobile/schedule?date=2026-04-27" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "events": [
    {
      "id": "evt-001",
      "title": "Flight Training",
      "startTime": "09:00",
      "endTime": "11:00",
      "type": "Dual",
      "aircraftType": "C172",
      "instructorId": "inst-001"
    }
  ],
  "message": "Found 1 events for 2026-04-27"
}
```

### 3. Refresh Token Test
```bash
curl -X POST https://dfp-neo.com/api/mobile/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

**Expected Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Error Response Examples

### Invalid Credentials (401)
```json
{
  "error": "Invalid userId or password"
}
```

### Missing Required Fields (400)
```json
{
  "error": "userId and password are required"
}
```

### Invalid/Expired Token (401)
```json
{
  "error": "No access token provided"
}
```

or

```json
{
  "error": "Invalid or expired access token"
}
```

### No Schedule Found (200)
```json
{
  "events": [],
  "message": "No schedule found for this date."
}
```

## iPhone App Integration Checklist

### Swift Code Integration

#### 1. Login Function
```swift
func login(userId: String, password: String) async throws -> (accessToken: String, refreshToken: String, user: User) {
    let url = URL(string: "https://dfp-neo.com/api/mobile/auth/login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = ["userId": userId, "password": password]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
        throw AuthError.loginFailed
    }
    
    let result = try JSONDecoder().decode(LoginResponse.self, from: data)
    return (result.accessToken, result.refreshToken, result.user)
}
```

#### 2. Schedule Fetch Function
```swift
func fetchSchedule(date: Date, accessToken: String) async throws -> [ScheduleEvent] {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    let dateString = formatter.string(from: date)
    
    var components = URLComponents(string: "https://dfp-neo.com/api/mobile/schedule")!
    components.queryItems = [URLQueryItem(name: "date", value: dateString)]
    
    var request = URLRequest(url: components.url!)
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
        throw NetworkError.fetchFailed
    }
    
    let result = try JSONDecoder().decode(ScheduleResponse.self, from: data)
    return result.events
}
```

#### 3. Token Refresh Function
```swift
func refreshToken(refreshToken: String) async throws -> (accessToken: String, newRefreshToken: String) {
    let url = URL(string: "https://dfp-neo.com/api/mobile/auth/refresh")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = ["refreshToken": refreshToken]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
        throw AuthError.refreshFailed
    }
    
    let result = try JSONDecoder().decode(RefreshResponse.self, from: data)
    return (result.accessToken, result.refreshToken)
}
```

## Common Issues & Solutions

### Issue: "Invalid userId or password"
**Solution**: 
- Verify userId exists in User table
- Check password is correct (case-sensitive)
- Ensure user's password is bcrypt hashed in database

### Issue: "Account is inactive"
**Solution**: 
- Check `isActive` field in User table
- Set `isActive = true` for the user

### Issue: "Invalid or expired access token"
**Solution**: 
- Verify token format: `Authorization: Bearer {token}`
- Check token hasn't expired (1 hour expiry)
- Implement automatic token refresh in iOS app

### Issue: Schedule returns empty array
**Solution**: 
- Verify schedule exists in Schedule table for that user+date
- Check `userId` matches the logged-in user's userId
- Different dates may have different schedules

## Debugging Tips

### 1. Enable Debug Logging
All mobile API endpoints log to console:
- ✅ Successful operations show with green checkmark
- ❌ Failed operations show with red X

Example log output:
```
✅ Mobile login successful for userId=user123, role=USER
✅ Mobile schedule retrieved for userId=user123, date=2026-04-27, events=5
❌ Mobile login failed: User not found for userId=invalid
```

### 2. Check Server Health
```bash
curl https://dfp-neo.com/api/health
```

### 3. Verify Database Connection
Check that Prisma can connect:
- Look for "✅ Prisma connected to database" in server startup logs

### 4. Test JWT Secret
Ensure `JWT_SECRET` environment variable is set:
```bash
echo $JWT_SECRET
```

## Performance Considerations

### 1. Token Refresh Strategy
- Refresh tokens when you get 401 responses
- Store refresh token securely in Keychain
- Implement exponential backoff for failed refreshes

### 2. Schedule Caching
- Cache schedules locally in iOS app
- Refresh when user changes dates
- Use background fetch for updates

### 3. Request Size
- Limit date range queries to single days
- Implement pagination if schedules become large

## Security Best Practices

### 1. Token Storage
- Store access tokens in UserDefaults (or memory)
- Store refresh tokens in Keychain
- Clear tokens on logout

### 2. HTTPS Only
- Always use HTTPS in production
- Validate SSL certificates
- Don't disable ATS (App Transport Security)

### 3. Token Expiry
- Access tokens: 1 hour (configurable via JWT_ACCESS_EXPIRY)
- Refresh tokens: 7 days (configurable via JWT_REFRESH_EXPIRY)

### 4. Error Handling
- Never log sensitive data (passwords, full tokens)
- Show user-friendly error messages
- Implement proper error boundaries

## Monitoring

### Key Metrics to Track
- Login success rate
- Token refresh frequency
- API response times
- Error rates by endpoint

### Log Patterns to Watch
- Failed login attempts (could indicate brute force)
- High refresh token usage (could indicate token issues)
- Slow database queries
- Memory usage patterns

---

**Last Updated**: April 27, 2026
**Status**: ✅ Ready for Testing