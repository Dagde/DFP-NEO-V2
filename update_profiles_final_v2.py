#!/usr/bin/env python3
import re

def update_instructor_profile(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update Row 1: Replace empty div with Seat Config
    old_row1 = r'(<div><span className="text-gray-400 block text-\[10px\]">Secondary Callsign</span>.*?</div>\s*)<div></div>'
    new_row1 = r'\1<div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{instructor.seatConfig}</span></div>'
    content = re.sub(old_row1, new_row1, content)
    
    # Update Row 2: Replace Seat Config with Crew
    content = re.sub(
        r'(<div><span className="text-gray-400 block text-\[10px\]">Unit</span>.*?</div>\s*)<div><span className="text-gray-400 block text-\[10px\]">Seat Config</span>.*?</div>',
        r'\1<div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{instructor.crew || \'N/A\'}</span></div>',
        content
    )
    
    # Update Row 3: Remove col-span, add empty divs
    old_row3 = r'(/\* Row 3 \*/\s*)<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span>.*?</div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span>.*?</div>'
    new_row3 = r'''\1<div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>'''
    content = re.sub(old_row3, new_row3, content)
    
    # Increase trainee thumbnail size from w-7 h-7 to w-9 h-9
    content = re.sub(r'w-7 h-7 bg-gray-600 rounded-full', r'w-9 h-9 bg-gray-600 rounded-full', content)
    content = re.sub(r'w-7 h-7 bg-gray-700/50 rounded-full', r'w-9 h-9 bg-gray-700/50 rounded-full', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

def update_trainee_profile(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update Row 1: Replace empty div with Seat Config
    old_row1 = r'(<div><span className="text-gray-400 block text-\[10px\]">Secondary Callsign</span>.*?</div>\s*)<div></div>'
    new_row1 = r'\1<div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{trainee.seatConfig}</span></div>'
    content = re.sub(old_row1, new_row1, content)
    
    # Update Row 2: Replace Seat Config with Crew
    content = re.sub(
        r'(<div><span className="text-gray-400 block text-\[10px\]">Unit</span>.*?</div>\s*)<div><span className="text-gray-400 block text-\[10px\]">Seat Config</span>.*?</div>',
        r'\1<div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{trainee.crew || \'N/A\'}</span></div>',
        content
    )
    
    # Update Row 3: Remove col-span, add empty divs
    old_row3 = r'(/\* Row 3 \*/\s*)<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span>.*?</div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span>.*?</div>'
    new_row3 = r'''\1<div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>'''
    content = re.sub(old_row3, new_row3, content)
    
    # Increase instructor thumbnail size from w-7 h-7 to w-9 h-9
    content = re.sub(r'w-7 h-7 bg-gray-600 rounded-full', r'w-9 h-9 bg-gray-600 rounded-full', content)
    content = re.sub(r'w-7 h-7 bg-gray-700/50 rounded-full', r'w-9 h-9 bg-gray-700/50 rounded-full', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

# Update both files
update_instructor_profile('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx')
update_trainee_profile('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx')

print("Done!")