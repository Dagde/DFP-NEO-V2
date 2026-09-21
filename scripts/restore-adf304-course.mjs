import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const course = {
  name: 'ADF304',
  code: 'ADF304',
  color: '#f08a24',
  startDate: '',
  endDate: '',
  totalStudents: 0,
  raafCount: 0,
  navyCount: 0,
  armyCount: 0,
  location: 'East Sale',
  unit: '1FTS+CFS',
  lmpType: '',
  academicLmpType: '',
  courseCommander: '',
  deputyCourseCommander: '',
  status: 'ACTIVE',
};

try {
  const restored = await prisma.course.upsert({
    where: { code: course.code },
    update: {
      ...course,
      updatedAt: new Date(),
    },
    create: course,
  });

  console.log('ADF304 restored as an empty active course record.');
  console.log(JSON.stringify({
    id: restored.id,
    name: restored.name,
    code: restored.code,
    status: restored.status,
    location: restored.location,
    unit: restored.unit,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
