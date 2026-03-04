# Course Date Persistence Debugging Changes

## Summary
Added comprehensive logging to both server and client to track course date save/load operations.

## Changes Made

### 1. Server (`server.js`)
- **GET /api/courses**: Added detailed logging showing:
  - Query parameters received
  - Number of courses found in database
  - Individual course details (name, start date, end date, color)

- **PUT /api/courses**: Added detailed logging showing:
  - Request body and query parameters
  - Course name being searched for
  - Whether existing course was found or new course created
  - Current dates vs new dates being saved
  - Error details with stack traces

### 2. Client (`App.tsx`)

#### saveCourseToDatabase()
- Logs when function is called with course name, startDate, gradDate
- Shows which course object was found
- Displays the complete request body being sent
- Logs response status and body
- Indicates success or failure

#### loadCoursesFromDatabase()
- Logs when function is called with school parameter
- Shows response status
- Displays response data
- Logs number of courses found in database
- Shows mapped course details
- Logs when falling back to default courses

#### handleUpdateGradDate()
- Logs when handler is called with course name and new grad date
- Shows when courses state is updated
- Indicates when database save is called
- Confirms completion

#### handleUpdateStartDate()
- Logs when handler is called with course name and new start date
- Shows when courses state is updated
- Indicates when database save is called
- Confirms completion

## How to Use Debug Logs

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for 🔵 (blue) logs from client-side operations
4. Look for 🟢 (green) logs from update handlers

### Step 2: Check Server Logs
Access Railway server logs to see:
- 📡 (purple) logs - API requests received
- ✅ (green) logs - Successful operations
- ❌ (red) logs - Errors with stack traces

## Expected Flow When Changing a Date

1. **User changes date in UI**
   - 🟢 handleUpdateStartDate/GradDate called
   - 🟢 Courses state updated
   - 🟢 saveCourseToDatabase called

2. **Client sends to server**
   - 🔵 saveCourseToDatabase sends PUT request
   - 🔵 Request body shows data being sent
   - 🔵 Response status from server

3. **Server processes request**
   - 📡 PUT /api/courses receives request
   - 🔍 Searches for existing course
   - ✅ Updates or creates course in database
   - Returns success response

4. **User refreshes page**
   - 🔵 loadCoursesFromDatabase called
   - 📡 GET /api/courses receives request
   - ✅ Returns courses from database
   - 🔵 Mapped courses loaded into state

## Possible Issues to Check

1. **API not called**: Check if client logs show fetch being called
2. **Server not receiving**: Check if server logs show 📡 PUT request
3. **Database not updating**: Check if server logs show ✅ update success
4. **Dates not loading**: Check if server logs show 📡 GET request and ✅ courses returned
5. **Mapping issue**: Check if client logs show mapped courses correctly

## Next Steps After Deploying

1. Change a course date in the UI
2. Check browser console for client logs
3. Check Railway logs for server logs
4. Refresh the page
5. Check if dates persist
6. Share screenshots of console/server logs if issue persists

## Deployment Instructions

The changes are committed locally (commit: `0041ce8`). To deploy:

```bash
# From your local machine:
cd /path/to/DFP-NEO-V2
git pull origin feature/comprehensive-build-algorithm
# (Or manually merge the changes)
git push origin feature/comprehensive-build-algorithm
```

Railway will auto-deploy after the push.