#!/usr/bin/env python3
import re

def fix_row3(filepath, person_type):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix Row 3: Remove col-span, add empty divs
    if person_type == 'instructor':
        old_row3 = r'(/\* Row 3 \*/\s*)<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span><span className="text-white font-medium">\{instructor\.phoneNumber \|\| \'N/A\'\}</span></div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span><span className="text-white font-medium">\{instructor\.email \|\| \'N/A\'\}</span></div>'
        new_row3 = r'''\1<div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>'''
    else:
        old_row3 = r'(/\* Row 3 \*/\s*)<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span><span className="text-white font-medium">\{trainee\.phoneNumber \|\| \'N/A\'\}</span></div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span><span className="text-white font-medium">\{trainee\.email \|\| \'N/A\'\}</span></div>'
        new_row3 = r'''\1<div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>'''
    
    content = re.sub(old_row3, new_row3, content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Fixed Row 3 in {filepath}")

fix_row3('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx', 'instructor')
fix_row3('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'trainee')

print("Done!")