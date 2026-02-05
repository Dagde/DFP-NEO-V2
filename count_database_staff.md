# Database Staff Count Query

To check how many staff are in the database for each unit, you can:

## Option 1: Check Railway Logs

Look for these console logs when the app loads:
```
🔄 Merging instructor data...
  Database instructors: X
  Mock instructors: Y
```

## Option 2: Query the Database Directly

Run this SQL query in Railway's PostgreSQL:

```sql
SELECT 
  unit,
  role,
  COUNT(*) as count
FROM "Personnel"
WHERE unit IN ('1FTS', 'CFS', '2FTS')
GROUP BY unit, role
ORDER BY unit, role;
```

This will show you exactly how many staff are in each unit and their roles.

## Option 3: Use the API Endpoint

I can create a debug endpoint that returns the count of database staff by unit.
