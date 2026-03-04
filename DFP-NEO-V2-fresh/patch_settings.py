import re

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# 1. Add filteredTraineeMockdata state and handler after the existing filteredMockdata block
old_block = """    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);

    // Initialize filtered mockdata with instructorsData
    React.useEffect(() => {
        setFilteredMockdata(props.instructorsData);
    }, [props.instructorsData]);

    const handleDeleteFromMockdata = (idNumber: number) => {
        setFilteredMockdata(prev => prev.filter(instructor => instructor.idNumber !== idNumber));
        props.onShowSuccess(`Staff member removed from mockdata display`);
    };"""

new_block = """    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);
    const [filteredTraineeMockdata, setFilteredTraineeMockdata] = useState<any[]>([]);

    // Initialize filtered mockdata with instructorsData
    React.useEffect(() => {
        setFilteredMockdata(props.instructorsData);
    }, [props.instructorsData]);

    // Initialize filtered trainee mockdata with traineesData
    React.useEffect(() => {
        setFilteredTraineeMockdata(props.traineesData);
    }, [props.traineesData]);

    const handleDeleteFromMockdata = (idNumber: number) => {
        setFilteredMockdata(prev => prev.filter(instructor => instructor.idNumber !== idNumber));
        props.onShowSuccess(`Staff member removed from mockdata display`);
    };

    const handleDeleteTraineeFromMockdata = (idNumber: number) => {
        setFilteredTraineeMockdata(prev => prev.filter(trainee => trainee.idNumber !== idNumber));
        props.onShowSuccess(`Trainee removed from mockdata display`);
    };"""

# Try to find and replace with flexible whitespace
# Use line-by-line approach
lines = content.split('\n')
new_lines = []
i = 0
replaced = False
while i < len(lines):
    line = lines[i]
    if not replaced and 'filteredMockdata, setFilteredMockdata' in line and 'useState<Instructor' in line:
        # Find the end of the handleDeleteFromMockdata block
        start = i
        end = i
        for j in range(i, min(i+20, len(lines))):
            if 'Staff member removed from mockdata display' in lines[j]:
                # find the closing }; line
                for k in range(j, min(j+5, len(lines))):
                    if lines[k].strip() == '};':
                        end = k
                        break
                break
        
        # Replace the block
        new_lines.append('    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);')
        new_lines.append('    const [filteredTraineeMockdata, setFilteredTraineeMockdata] = useState<any[]>([]);')
        new_lines.append('')
        new_lines.append('    // Initialize filtered mockdata with instructorsData')
        new_lines.append('    React.useEffect(() => {')
        new_lines.append('        setFilteredMockdata(props.instructorsData);')
        new_lines.append('    }, [props.instructorsData]);')
        new_lines.append('')
        new_lines.append('    // Initialize filtered trainee mockdata with traineesData')
        new_lines.append('    React.useEffect(() => {')
        new_lines.append('        setFilteredTraineeMockdata(props.traineesData);')
        new_lines.append('    }, [props.traineesData]);')
        new_lines.append('')
        new_lines.append('    const handleDeleteFromMockdata = (idNumber: number) => {')
        new_lines.append('        setFilteredMockdata(prev => prev.filter(instructor => instructor.idNumber !== idNumber));')
        new_lines.append("        props.onShowSuccess(`Staff member removed from mockdata display`);")
        new_lines.append('    };')
        new_lines.append('')
        new_lines.append('    const handleDeleteTraineeFromMockdata = (idNumber: number) => {')
        new_lines.append('        setFilteredTraineeMockdata(prev => prev.filter(trainee => trainee.idNumber !== idNumber));')
        new_lines.append("        props.onShowSuccess(`Trainee removed from mockdata display`);")
        new_lines.append('    };')
        
        i = end + 1
        replaced = True
        print(f"Replaced filteredMockdata block (lines {start}-{end})")
    else:
        new_lines.append(line)
        i += 1

if not replaced:
    print("WARNING: filteredMockdata block not found!")

content = '\n'.join(new_lines)

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)

print("Done patching state/handlers.")