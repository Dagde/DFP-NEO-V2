const pg = require('pg');
const { Client } = pg;

async function checkSchema() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get columns from Schedule table
    const columnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Schedule' 
      ORDER BY ordinal_position
    `;
    
    const result = await client.query(columnsQuery);
    console.log('Schedule table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Get sample data
    console.log('\nSample Schedule records:');
    const sampleQuery = `
      SELECT * FROM "Schedule" 
      LIMIT 3
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach(row => {
      console.log(JSON.stringify(row, null, 2));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkSchema();
