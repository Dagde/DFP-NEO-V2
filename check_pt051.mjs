import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
await db.$connect();

// Find PT-051 backups
const backups = await db.dataBackup.findMany({ where: { type: 'historical_pt051_assessments' } });
console.log('Backup count:', backups.length);

if (backups.length > 0) {
  const b = backups[0];
  console.log('Backup id:', b.id, '| createdAt:', b.createdAt);
  console.log('Data type:', typeof b.data);
  
  const parsed = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
  console.log('Parsed type:', typeof parsed);
  console.log('Is array:', Array.isArray(parsed));
  
  if (Array.isArray(parsed)) {
    console.log('Array length:', parsed.length);
    console.log('First record keys:', Object.keys(parsed[0] || {}));
    console.log('First record sample:', JSON.stringify(parsed[0]).substring(0, 400));
  } else {
    const vals = Object.values(parsed);
    console.log('Object length:', vals.length);
    if (vals.length > 0) {
      const first = vals[0];
      console.log('First value keys:', Object.keys(first || {}));
      console.log('First value sample:', JSON.stringify(first).substring(0, 400));
      // Check course field
      const courses = new Set();
      for (const v of vals) {
        if (v.course) courses.add(v.course);
        if (v.courseName) courses.add(v.courseName);
        if (v.traineeFullName && v.traineeFullName.includes('–')) {
          courses.add(v.traineeFullName.split('–')[1].trim());
        }
      }
      console.log('Unique courses found:', [...courses]);
    }
  }
}

await db.$disconnect();
