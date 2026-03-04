#!/usr/bin/env python3
import re

def fix_row3(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix Row 3 for Instructor Profile
    old_row3 = r'''                        {/* Row 3 */}
                        <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div className="col-span-4"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>'''
    
    new_row3 = r'''                        {/* Row 3 */}
                        <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>'''
    
    if 'instructor.phoneNumber' in content:
        content = content.replace(old_row3, new_row3)
    
    # Fix Row 3 for Trainee Profile
    old_row3_trainee = r'''                              {/* Row 3 */}
                              <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div className="col-span-4"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>'''
    
    new_row3_trainee = r'''                              {/* Row 3 */}
                              <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>'''
    
    if 'trainee.phoneNumber' in content:
        content = content.replace(old_row3_trainee, new_row3_trainee)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Fixed Row 3 in {filepath}")

fix_row3('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx')
fix_row3('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx')

print("Done!")