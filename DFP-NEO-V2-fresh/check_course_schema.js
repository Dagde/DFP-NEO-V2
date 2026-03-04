const { PrismaClient } = require('@prisma/client');

async function checkCourseSchema() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
      }
    }
  });

  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Course'
      ORDER BY ordinal_position;
    `;
    console.log('Course table columns:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCourseSchema();