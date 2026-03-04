#!/usr/bin/env python3

# Read the file
with open('/workspace/components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Find and replace the qfis useMemo
qfi_tracking = '''const qfis = useMemo(() => {
        console.log('🔍 [QFI FILTER] instructorsData length:', instructorsData.length);
        const rankOrder: { [key: string]: number } = {
            'WGCDR': 1,
            'SQNLDR': 2,
            'FLTLT': 3,
            'FLGOFF': 4,
            'PLTOFF': 5,
            'Mr': 6
        };
    
        const qfiCandidates = instructorsData
            .filter(i => {
                const isQfi = i.role === 'QFI' || i.isQFI === true;
                if (isQfi) {
                    console.log(`🔍 [QFI FILTER] Found QFI: ${i.name} (${i.rank}) - role="${i.role}", isQFI=${i.isQFI}`);
                }
                return isQfi;
            });
        
        console.log('🔍 [QFI FILTER] Total QFIs found:', qfiCandidates.length);'''

pattern = r'const qfis = useMemo\(\(\) => \{[^}]*\};\s*\n\s*return instructorsData'
content = content.replace(pattern, qfi_tracking + '\n        return instructorsData')

# Write back
with open('/workspace/components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print("✅ QFI tracking added")