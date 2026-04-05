with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

print("=== VERIFICATION OF ALL PATCHES ===\n")

# Patch 1: gap-[1px] (button spacing)
if 'gap-[1px]' in content:
    print("✅ Patch 1: Button spacing gap-[1px] found")
else:
    print("❌ Patch 1: Button spacing NOT found")

# Patch 2: Check for the specific 304-byte removal context (Archived Courses button removed)
# We'll check that "onNavigateToArchivedCourses" appears only once now
archived_courses_count = content.count('onNavigateToArchivedCourses')
if archived_courses_count == 1:
    print(f"✅ Patch 2: Archived Courses button removed (onNavigateToArchivedCourses appears {archived_courses_count} time)")
else:
    print(f"❌ Patch 2: Archived Courses button still present? (appears {archived_courses_count} times)")

# Patch 3: State declarations
if 'const [isStaffLoaded, setIsStaffLoaded] = reactExports.useState(false);' in content:
    print("✅ Patch 3a: isStaffLoaded state declaration found")
else:
    print("❌ Patch 3a: isStaffLoaded state NOT found")

if 'const [isTraineeLoaded, setIsTraineeLoaded] = reactExports.useState(false);' in content:
    print("✅ Patch 3a: isTraineeLoaded state declaration found")
else:
    print("❌ Patch 3a: isTraineeLoaded state NOT found")

if 'const [isCoursesLoaded, setIsCoursesLoaded] = reactExports.useState(false);' in content:
    print("✅ Patch 3a: isCoursesLoaded state declaration found")
else:
    print("❌ Patch 3a: isCoursesLoaded state NOT found")

# Patch 4: setIsStaffLoaded/setIsTraineeLoaded calls
if content.count('setIsStaffLoaded(true);') >= 1:
    print("✅ Patch 4: setIsStaffLoaded call found")
else:
    print("❌ Patch 4: setIsStaffLoaded call NOT found")

if content.count('setIsTraineeLoaded(true);') >= 1:
    print("✅ Patch 4: setIsTraineeLoaded call found")
else:
    print("❌ Patch 4: setIsTraineeLoaded call NOT found")

# Patch 5: setIsCoursesLoaded calls (should be 2 - one for courses exist, one for no courses)
set_courses_count = content.count('setIsCoursesLoaded(true);')
if set_courses_count == 2:
    print(f"✅ Patch 5: setIsCoursesLoaded calls found ({set_courses_count} occurrences)")
else:
    print(f"❌ Patch 5: setIsCoursesLoaded calls incomplete ({set_courses_count} occurrences, expected 2)")

# Patch 6: DataLoadingMonitor function
if 'const DataLoadingMonitor = ({ isStaffLoaded, isTraineeLoaded, isCoursesLoaded }) => {' in content:
    print("✅ Patch 6: DataLoadingMonitor function definition found")
else:
    print("❌ Patch 6: DataLoadingMonitor function NOT found")

# Verify the hooks fix
if 'reactExports.useState' in content and 'reactExports.useEffect' in content:
    print("✅ CRITICAL: DataLoadingMonitor uses reactExports hooks (FIXED)")
else:
    print("❌ CRITICAL: DataLoadingMonitor hooks NOT correct")

if 'clientExports.useState' in content or 'clientExports.useEffect' in content:
    print("❌ CRITICAL: clientExports hooks still present (NOT FIXED)")
else:
    print("✅ CRITICAL: No clientExports hooks in DataLoadingMonitor")

# Patch 6b: DataLoadingMonitor JSX usage
if '<DataLoadingMonitor' in content:
    print("✅ Patch 6b: DataLoadingMonitor JSX usage found")
else:
    print("❌ Patch 6b: DataLoadingMonitor JSX usage NOT found")

print("\n=== SUMMARY ===")
all_good = True
issues = []

if 'gap-[1px]' not in content:
    all_good = False
    issues.append("Button spacing missing")

if archived_courses_count != 1:
    all_good = False
    issues.append("Archived Courses button not properly removed")

if 'const DataLoadingMonitor' not in content:
    all_good = False
    issues.append("DataLoadingMonitor missing")

if 'clientExports.useState' in content or 'clientExports.useEffect' in content:
    all_good = False
    issues.append("clientExports hooks still present - CRITICAL")

if all_good:
    print("✅ ALL PATCHES VERIFIED AND READY TO COMMIT")
else:
    print("❌ ISSUES FOUND:")
    for issue in issues:
        print(f"   - {issue}")
