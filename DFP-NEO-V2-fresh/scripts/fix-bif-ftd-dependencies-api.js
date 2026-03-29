// This script creates a one-time API endpoint to fix BIF FTD dependencies
// Then it calls that endpoint to apply the fix to the production database

async function applyFix() {
  const apiUrl = 'https://dfp-neo-v2-production.up.railway.app/api/fix-bif-ftd-dependencies';
  
  try {
    console.log('🚀 Calling API to fix BIF FTD dependencies...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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