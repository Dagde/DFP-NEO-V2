// Script to investigate Burns records via API
async function investigateBurnsViaAPI() {
    try {
        console.log('🔍 Investigating Burns records via API...\n');

        // Call the personnel API
        const response = await fetch('http://localhost:3000/api/personnel');
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const allPersonnel = data.personnel || [];
        
        console.log(`📊 Total personnel from API: ${allPersonnel.length}\n`);

        // Find all Burns records
        const burnsRecords = allPersonnel.filter(p => p.name && p.name.includes('Burns'));
        
        console.log(`📊 Total Burns records found: ${burnsRecords.length}\n`);

        if (burnsRecords.length === 0) {
            console.log('❌ No Burns records found in API response');
            return;
        }

        burnsRecords.forEach((record, index) => {
            console.log(`\n--- Burns Record ${index + 1} ---`);
            console.log(`ID: ${record.id}`);
            console.log(`PMKEYS (idNumber): ${record.idNumber}`);
            console.log(`Name: ${record.name}`);
            console.log(`Rank: ${record.rank}`);
            console.log(`Role: ${record.role}`);
            console.log(`Unit: ${record.unit}`);
            console.log(`isQFI: ${record.isQFI}`);
            console.log(`isOFI: ${record.isOFI}`);
            console.log(`Created: ${record.createdAt}`);
        });

        // Check for duplicates by idNumber
        const idNumbers = {};
        burnsRecords.forEach(record => {
            if (record.idNumber) {
                if (!idNumbers[record.idNumber]) {
                    idNumbers[record.idNumber] = [];
                }
                idNumbers[record.idNumber].push(record);
            }
        });

        console.log('\n\n🔍 Checking for duplicate idNumbers...');
        let hasDuplicates = false;
        Object.keys(idNumbers).forEach(idNumber => {
            if (idNumbers[idNumber].length > 1) {
                hasDuplicates = true;
                console.log(`\n⚠️  Found ${idNumbers[idNumber].length} records with idNumber ${idNumber}`);
                idNumbers[idNumber].forEach((rec, idx) => {
                    console.log(`   ${idx + 1}. ID: ${rec.id}, Rank: ${rec.rank}, Role: ${rec.role}`);
                });
            }
        });

        if (!hasDuplicates) {
            console.log('✅ No duplicate idNumbers found');
        }

    } catch (error) {
        console.error('❌ Error investigating Burns records:', error);
    }
}

investigateBurnsViaAPI();