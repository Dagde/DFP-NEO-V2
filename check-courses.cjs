const pg = require('pg');
const { Client } = pg;

async function checkCourses() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all unique courses
    const coursesQuery = `
      SELECT DISTINCT course 
      FROM "Trainee" 
      ORDER BY course
    `;
    
    const result = await client.query(coursesQuery);
    console.log('Available courses:');
    result.rows.forEach(row => {
      console.log(`  - ${row.course}`);
    });

    // Get sample trainee data
    const sampleQuery = `
      SELECT "idNumber", name, course 
      FROM "Trainee" 
      LIMIT 5
    `;
    
    const sampleResult = await client.query(sampleQuery);
    console.log('\nSample trainees:');
    sampleResult.rows.forEach(row => {
      console.log(`  ${row.name} - ${row.course} (ID: ${row.idNumber})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkCourses();
