# User-Personnel Linkage Debug

## Problem
The app shows "INSTRUCTOR" (from User table) instead of "SQNLDR" (from Personnel table) for Alexander Burns.

## Root Cause
The app cannot link the logged-in User record to the correct Personnel record in the database.

## Debug Endpoint
Access: https://dfp-neo.com/api/debug/user-personnel-linkage

This endpoint shows:
- User record details (userId, name, role)
- Personnel record linked by userId
- Personnel record matching by idNumber (PMKEYS)
- Sample of all Personnel records

## Expected Results
If linkage is working, we should see:
1. User.userId matches Personnel.userId (direct link)
2. OR User.userId matches Personnel.idNumber (PMKEYS match)

## Current Unknown
We need to see the actual database values to understand:
- What is User.userId for Alexander Burns?
- What is Personnel.userId for "Burns, Alexander"?
- Is there a Personnel record for him at all?
