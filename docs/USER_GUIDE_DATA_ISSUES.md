# User Guide: Handling Data Issues

## Overview

This guide helps you understand and resolve data issues that may occur when working with trainee records, especially after bulk uploads.

## Common Data Issues

### 1. Missing Trainee Names
**Problem**: Trainees appear as "Unknown" in the roster
**Cause**: Bulk upload missing name fields
**Solution**: 
- Edit the trainee record to add proper name
- Re-upload with complete name data

### 2. Missing Course Information
**Problem**: Trainees show "No Course" or appear in wrong groups
**Cause**: Course field missing or incorrect in upload
**Solution**:
- Update course field in trainee profile
- Ensure correct course names in bulk upload files

### 3. Sorting Errors
**Problem**: Roster doesn't sort properly or crashes
**Cause**: Invalid data in sorting fields
**Solution**:
- Use data repair function (if available)
- Check for invalid characters in names/courses

## Bulk Upload Guidelines

### Required Fields
Your upload file MUST include:
- **name** OR **fullName** (at least one)
- **course** (for proper grouping)

### Recommended Format
```csv
name,fullName,course,class,squadron,rank
John Smith,John Smith,Course A,Class 1,Squadron 1,Trainee
Jane Doe,Jane Doe,Course B,Class 2,Squadron 2,Trainee
```

### Common Mistakes to Avoid
❌ Leaving name fields empty  
❌ Using "undefined" or "null" as values  
❌ Missing course information  
❌ Duplicate trainee records  

✅ Complete name information  
✅ Valid course names  
✅ Consistent data format  
✅ Unique trainee records  

## Troubleshooting Steps

### When Roster Crashes or Shows Errors

1. **Refresh the Page**
   - Sometimes a simple reload resolves temporary issues

2. **Check Console Messages**
   - Press F12 to open browser console
   - Look for error messages (red text)
   - Note any specific error details

3. **Validate Your Data**
   - Ensure all trainees have names
   - Check course assignments
   - Look for duplicate records

4. **Use Data Repair (if available)**
   - Click any "Repair Data" buttons shown
   - Follow the on-screen instructions
   - Reload after repair completes

### When Bulk Upload Fails

1. **Check File Format**
   - Ensure CSV format
   - Verify required columns exist
   - Check for special characters

2. **Validate Data Content**
   - No empty name fields
   - Valid course names
   - Proper text encoding

3. **Test with Small Sample**
   - Try uploading 2-3 records first
   - Verify those work before full upload

## Error Messages Explained

### "Cannot read properties of undefined (reading 'localeCompare')"
**What it means**: The app tried to sort trainees but found missing data
**How to fix**: Use data repair or fix the underlying data issues

### "Trainee Schedule Error"
**What it means**: Invalid trainee data prevented schedule loading
**How to fix**: Check trainee records for missing required fields

### "Data Validation Issues Found"
**What it means**: The system detected problems in your data
**How to fix**: Use the repair function or manually fix identified issues

## Best Practices

### Before Bulk Upload
1. **Backup Current Data**: Export existing trainee data
2. **Validate Your File**: Check format and required fields
3. **Test Sample**: Upload a few records first
4. **Review Results**: Verify data appears correctly

### After Upload
1. **Verify All Trainees**: Check everyone appears correctly
2. **Test Sorting**: Ensure roster sorts properly
3. **Check Groupings**: Verify course assignments
4. **Monitor Issues**: Watch for error messages

### Regular Maintenance
1. **Periodic Validation**: Check for data issues regularly
2. **Backup Data**: Keep regular backups
3. **Clean Duplicates**: Remove duplicate records
4. **Update Outdated Info**: Keep trainee information current

## Getting Help

### Self-Service Resources
- Use built-in data repair functions
- Check console for detailed error messages
- Review this guide for common solutions

### When to Contact Support
Contact support if you:
- Experience repeated crashes after trying repairs
- Have data corruption that repair doesn't fix
- Need help with complex bulk uploads
- Encounter error messages not covered in this guide

### Information to Provide
When requesting help, please include:
- Exact error messages
- Steps that led to the problem
- Browser console output (screenshots help)
- Sample of the data causing issues (if possible)

## Prevention Tips

### Data Quality
- Always include required fields
- Use consistent formatting
- Validate data before upload
- Keep backups of good data

### Regular Checks
- Periodically validate your data
- Check for duplicate records
- Verify course assignments
- Monitor for unusual behavior

### Upload Process
- Test with small samples first
- Validate large files before upload
- Review results immediately
- Roll back changes if issues occur

---

**Remember**: Most data issues are preventable with proper validation and can be fixed using the built-in repair functions. Keep your data clean and follow the upload guidelines for the best experience.