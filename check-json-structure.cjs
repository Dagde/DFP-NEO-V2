const pg = require('pg');
const { Client } = pg;

async function checkJsonStructure() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get sample data from Schedule table
    const sampleQuery = `
      SELECT data 
      FROM "Schedule" 
      WHERE data IS NOT NULL 
      LIMIT 2
    `;
    
    const result = await client.query(sampleQuery);
    console.log('Sample Schedule JSON data:');
    result.rows.forEach((row, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log(JSON.stringify(row.data, null, 2));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkJsonStructure();
