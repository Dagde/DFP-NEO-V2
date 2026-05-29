// This script creates a one-time API endpoint to fix BIF FTD dependencies
// Then it calls that endpoint to apply the fix to the production database

async function applyFix() {
  const apiBase = process.env.DFP_NEO_MAINTENANCE_API_URL;
  const maintenanceSecret = process.env.DFP_NEO_MAINTENANCE_SECRET;
  if (!apiBase) {
    throw new Error('DFP_NEO_MAINTENANCE_API_URL must be set before running this maintenance script');
  }
  if (!maintenanceSecret) {
    throw new Error('DFP_NEO_MAINTENANCE_SECRET must be set before running this maintenance script');
  }
  const apiUrl = `${apiBase.replace(/\/$/, '')}/api/fix-bif-ftd-dependencies`;
  
  try {
    console.log('🚀 Calling API to fix BIF FTD dependencies...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Maintenance-Secret': maintenanceSecret
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('\n✅ Fix applied successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
    throw error;
  }
}

applyFix();
