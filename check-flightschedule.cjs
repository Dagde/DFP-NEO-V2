const pg = require('pg');
const { Client } = pg;

async function checkFlightSchedule() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get columns from FlightSchedule table
    const columnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'FlightSchedule' 
      ORDER BY ordinal_position
    `;
    
    const result = await client.query(columnsQuery);
    console.log('FlightSchedule table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Get count
    const countQuery = `SELECT COUNT(*) as count FROM "FlightSchedule"`;
    const countResult = await client.query(countQuery);
    console.log(`\nTotal records: ${countResult.rows[0].count}`);

    // Get sample data
    console.log('\nSample FlightSchedule records:');
    const sampleQuery = `
      SELECT * FROM "FlightSchedule" 
      LIMIT 2
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log(JSON.stringify(row, null, 2));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkFlightSchedule();
