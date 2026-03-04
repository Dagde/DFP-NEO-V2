#!/usr/bin/env python3
"""
Add comprehensive data tracking to trace staff data flow from UI to database
"""

import os
import re

def track_instructor_list_view():
    """Add tracking to InstructorListView component (Add Staff button)"""
    file_path = "/workspace/components/InstructorListView.tsx"
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add tracking to the handleAddInstructor function
    # Find where new instructor data is created
    pattern = r'(const handleAddInstructor = async \(\) => \{[^}]+?)(const newInstructor = \{)'
    
    def add_tracking_before_new_instructor(match):
        before = match.group(1)
        after = match.group(2)
        tracking = '''
        // DATA TRACKING: Start of add staff operation
        console.log('🔍 [DATA TRACKING] Add Staff button clicked');
        console.log('🔍 [DATA TRACKING] Current instructors count:', instructorsData.length);
        console.log('🔍 [DATA TRACKING] Form state:', { name, rank, category, ... });
        '''
        return before + tracking + '\n' + after
    
    content = re.sub(pattern, add_tracking_before_new_instructor, content)
    
    # Add tracking after new instructor is created
    pattern = r'(const newInstructor = \{[^}]+\};)'
    
    def add_tracking_after_new_instructor(match):
        before = match.group(0)
        tracking = '''
        console.log('🔍 [DATA TRACKING] New instructor created:', newInstructor);
        console.log('🔍 [DATA TRACKING] Instructor ID:', newInstructor.idNumber);
        console.log('🔍 [DATA TRACKING] Instructor category:', newInstructor.category);
        '''
        return before + '\n' + tracking
    
    content = re.sub(pattern, add_tracking_after_new_instructor, content)
    
    # Add tracking after update
    pattern = r'(setInstructorsData\(\.\.\.instructorsData, newInstructor\);)'
    
    def add_tracking_after_update(match):
        before = match.group(0)
        tracking = '''
        console.log('🔍 [DATA TRACKING] State updated - Total instructors:', instructorsData.length + 1);
        console.log('🔍 [DATA TRACKING] Last instructor added:', instructorsData[instructorsData.length - 1]);
        '''
        return before + '\n' + tracking
    
    content = re.sub(pattern, add_tracking_after_update, content)
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(content)
    
    print("✅ Added tracking to InstructorListView")

def track_app_data_flow():
    """Add tracking to App.tsx to see data initialization"""
    file_path = "/workspace/App.tsx"
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add tracking after data initialization
    pattern = r'(const \[instructorsData, setInstructorsData\] = useState<Instructor\[\]>\(ESL_DATA\.instructors\);)'
    
    def add_tracking_after_init(match):
        before = match.group(0)
        tracking = '''
// DATA TRACKING: Initial data load
useEffect(() => {
  console.log('🔍 [DATA TRACKING] App initialized with ESL_DATA.instructors');
  console.log('🔍 [DATA TRACKING] Total instructors from mockdata:', instructorsData.length);
  console.log('🔍 [DATA TRACKING] First 3 instructors:', instructorsData.slice(0, 3).map(i => ({ id: i.idNumber, name: i.name, category: i.category })));
}, []);
'''
        return before + '\n' + tracking
    
    content = re.sub(pattern, add_tracking_after_init, content)
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(content)
    
    print("✅ Added tracking to App.tsx")

def track_staff_database_table():
    """Enhance tracking in StaffDatabaseTable component"""
    file_path = "/workspace/components/StaffDatabaseTable.tsx"
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add more detailed tracking after filtering
    pattern = r'(console\.log\(`\\u2705 StaffDatabaseTable: Real staff with userId: \$\{realStaff\.length\}`\);)'
    
    def add_detailed_tracking(match):
        before = match.group(0)
        tracking = '''
        console.log('🔍 [DATA TRACKING] Staff Database Table - Filtered real staff:');
        console.log('🔍 [DATA TRACKING] Real staff details:', realStaff.map(s => ({ id: s.idNumber, name: s.name, userId: s.userId, category: s.category })));
        console.log('🔍 [DATA TRACKING] All personnel IDs:', data.personnel.map(p => ({ id: p.idNumber, name: p.name, userId: p.userId })));
'''
        return before + '\n' + tracking
    
    content = re.sub(pattern, add_detailed_tracking, content)
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(content)
    
    print("✅ Enhanced tracking in StaffDatabaseTable")

def add_api_tracking():
    """Add tracking to API endpoints"""
    # Track personnel API
    personnel_api = "/workspace/dfp-neo-platform/app/api/personnel/route.ts"
    
    with open(personnel_api, 'r') as f:
        content = f.read()
    
    # Add tracking before query
    pattern = r'(const personnel = await prisma\.personnel\.findMany\(\{)'
    
    def add_api_tracking(match):
        before = match.group(0)
        tracking = '''
      console.log('🔍 [API TRACKING] /api/personnel - Querying database');
      console.log('🔍 [API TRACKING] Where clause:', where);
'''
        return tracking + '\n' + before
    
    content = re.sub(pattern, add_api_tracking, content)
    
    # Add tracking after query
    pattern = r'(return NextResponse\.json\(\{ personnel \}\);)'
    
    def add_api_tracking_after(match):
        before = match.group(0)
        tracking = '''
      console.log('🔍 [API TRACKING] /api/personnel - Returning', personnel.length, 'records');
      console.log('🔍 [API TRACKING] Sample records:', personnel.slice(0, 3).map(p => ({ id: p.idNumber, name: p.name, userId: p.userId })));
'''
        return tracking + '\n' + before
    
    content = re.sub(pattern, add_api_tracking_after, content)
    
    # Write back
    with open(personnel_api, 'w') as f:
        f.write(content)
    
    print("✅ Added tracking to /api/personnel endpoint")

if __name__ == "__main__":
    print("🔍 Adding comprehensive data tracking...")
    print()
    
    try:
        track_instructor_list_view()
        track_app_data_flow()
        track_staff_database_table()
        add_api_tracking()
        
        print()
        print("✅ Data tracking added successfully!")
        print()
        print("📝 What will be tracked:")
        print("   1. When you click 'Add Staff' button")
        print("   2. Form state before submission")
        print("   3. New instructor data creation")
        print("   4. State update after adding")
        print("   5. App initialization with mockdata")
        print("   6. Staff Database table filtering")
        print("   7. API endpoint queries")
        print()
        print("🎯 Next steps:")
        print("   1. Rebuild: npm run build")
        print("   2. Copy to Next.js public folder")
        print("   3. Commit and push")
        print("   4. You add new staff in the app")
        print("   5. Take screenshots")
        print("   6. Upload console logs")
        
    except Exception as e:
        print(f"❌ Error adding tracking: {e}")
        import traceback
        traceback.print_exc()