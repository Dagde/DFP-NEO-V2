#!/usr/bin/env python3

# Fix InstructorProfileFlyout
with open('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx', 'r') as f:
    content = f.read()

# Find and replace Row 3
old = '''                        {/* Row 3 */}
                        <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div className="col-span-4"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>'''

new = '''                        {/* Row 3 */}
                        <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>'''

content = content.replace(old, new)

with open('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Fixed InstructorProfileFlyout")

# Fix TraineeProfileFlyout
with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'r') as f:
    content = f.read()

old = '''                              {/* Row 3 */}
                              <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div className="col-span-4"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>'''

new = '''                              {/* Row 3 */}
                              <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>'''

content = content.replace(old, new)

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Fixed TraineeProfileFlyout")