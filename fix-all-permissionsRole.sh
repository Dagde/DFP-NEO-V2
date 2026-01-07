#!/bin/bash

# Find all files with permissionsRole references
files=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -l "permissionsRole")

echo "Files to fix:"
echo "$files"
echo ""

# Fix each file
for file in $files; do
    echo "Processing: $file"
    
    # Remove permissionsRole from includes
    sed -i '/permissionsRole: true,/d' "$file"
    sed -i '/permissionsRole: {/,/},/d' "$file"
    
    # Replace prisma.permissionsRole with a comment or remove
    sed -i 's/prisma\.permissionsRole/findMany({}) \/\* TODO: permissionsRole model not implemented \*\//g' "$file"
    sed -i 's/prisma\.permissionsRole\.findUnique({.*})/{ name: "Not Implemented", capabilities: [] } \/\* TODO: permissionsRole model not implemented \*\//g' "$file"
    
    echo "  ✓ Fixed"
done

echo ""
echo "All files processed!"