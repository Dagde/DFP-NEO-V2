import re

filepath = '/workspace/DFP-NEO-V2-fresh/App.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Fix import: remove INITIAL_SYLLABUS_DETAILS & DEFAULT_PHRASE_BANK from mockData ──
old_import = "// --- MOCK DATA ---\nimport { ESL_DATA, PEA_DATA, INITIAL_SYLLABUS_DETAILS, DEFAULT_PHRASE_BANK } from './mockData';\nimport { initializeData } from './lib/dataService';"

new_import = """// --- MOCK DATA ---
import { ESL_DATA, PEA_DATA } from './mockData';
import { initializeData } from './lib/dataService';
// --- SYLLABUS SERVICE (loads from DB at startup) ---
import { loadSyllabusFromDB } from './lib/syllabusService';
// --- DEFAULT PHRASE BANK (configuration data - not mock data) ---
import { DEFAULT_PHRASE_BANK } from './config/phraseBankConfig';"""

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("✅ Fixed import block")
else:
    print("❌ Import block not found - check manually")

# ── 2. Fix useState: syllabusDetails starts empty, add loading/error states ──
old_state = "    const [syllabusDetails, setSyllabusDetails] = useState<SyllabusItemDetail[]>(INITIAL_SYLLABUS_DETAILS);"
new_state = """    const [syllabusDetails, setSyllabusDetails] = useState<SyllabusItemDetail[]>([]);
    const [syllabusLoading, setSyllabusLoading] = useState<boolean>(true);
    const [syllabusError, setSyllabusError] = useState<string | null>(null);"""

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("✅ Fixed syllabusDetails useState")
else:
    print("❌ syllabusDetails useState not found - check manually")

# ── 3. Replace remaining INITIAL_SYLLABUS_DETAILS references with syllabusDetails ──
# Line 318: default parameter - replace with empty array
old_318 = "    syllabusDetails: SyllabusItemDetail[] = INITIAL_SYLLABUS_DETAILS\n"
new_318 = "    syllabusDetails: SyllabusItemDetail[] = []\n"
if old_318 in content:
    content = content.replace(old_318, new_318, 1)
    print("✅ Fixed line 318 default parameter")
else:
    print("❌ Line 318 default param not found - check manually")

# Lines 4441, 4444, 4607, 12387: INITIAL_SYLLABUS_DETAILS → syllabusDetails
remaining = content.count('INITIAL_SYLLABUS_DETAILS')
if remaining > 0:
    content = content.replace('INITIAL_SYLLABUS_DETAILS', 'syllabusDetails')
    print(f"✅ Replaced {remaining} remaining INITIAL_SYLLABUS_DETAILS references with syllabusDetails")
else:
    print("✅ No remaining INITIAL_SYLLABUS_DETAILS references")

# ── 4. Add syllabus loading useEffect before the main data loading useEffect ──
old_load_comment = "// Load data from API on mount — credentials:include sends session cookie automatically\n    useEffect(() => {\n        const loadInitialData = async () => {\n            console.log('🔄 Starting to load initial data...');"

new_load_comment = """// Load syllabus from DB on mount (startup loading with cache)
    useEffect(() => {
        const loadSyllabus = async () => {
            setSyllabusLoading(true);
            setSyllabusError(null);
            try {
                const result = await loadSyllabusFromDB();
                if (result.syllabus.length > 0) {
                    setSyllabusDetails(result.syllabus);
                    if (result.source === 'expired-cache') {
                        console.warn('⚠️ [Syllabus] Using expired cache:', result.error);
                        setSyllabusError(result.error || null);
                    } else {
                        console.log(`✅ [Syllabus] Loaded ${result.syllabus.length} items from ${result.source}`);
                    }
                } else {
                    console.error('❌ [Syllabus] No syllabus data available:', result.error);
                    setSyllabusError(result.error || 'No syllabus data available');
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                console.error('❌ [Syllabus] Failed to load syllabus:', msg);
                setSyllabusError(msg);
            } finally {
                setSyllabusLoading(false);
            }
        };
        loadSyllabus();
    }, []);

// Load data from API on mount — credentials:include sends session cookie automatically
    useEffect(() => {
        const loadInitialData = async () => {
            console.log('🔄 Starting to load initial data...');"""

if old_load_comment in content:
    content = content.replace(old_load_comment, new_load_comment, 1)
    print("✅ Added syllabus loading useEffect")
else:
    print("❌ Load comment not found - check manually")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ All patches applied to DFP-NEO-V2-fresh/App.tsx")
print(f"Final INITIAL_SYLLABUS_DETAILS count: {content.count('INITIAL_SYLLABUS_DETAILS')}")
print(f"Final DEFAULT_PHRASE_BANK import from mockData: {'DEFAULT_PHRASE_BANK' in content and 'mockData' in content}")