import { SyllabusItemDetail } from '../types';

/**
 * Filters syllabus items to include only those applicable to a specific LMP type
 * @param allSyllabusItems - Complete list of all syllabus items
 * @param lmpType - The LMP type to filter for (e.g., 'FIC', 'WSO', 'OFI', etc.)
 * @returns Array of syllabus items filtered by LMP type
 */
export const filterSyllabusByLMPType = (
    allSyllabusItems: SyllabusItemDetail[],
    lmpType: string
): SyllabusItemDetail[] => {
    if (!lmpType || lmpType.toLowerCase() === 'bpc+ipc') {
        // For basic pilot course, return all BGF, BIF, BNF, BNAV, SCT items
        return allSyllabusItems.filter(item => 
            item.code.startsWith('BGF') || 
            item.code.startsWith('BIF') || 
            item.code.startsWith('BNF') || 
            item.code.startsWith('BNAV') || 
            item.code.startsWith('SCT')
        );
    }

    // For specialized LMPs, filter by the courses array in each syllabus item
    return allSyllabusItems.filter(item => 
        item.courses && item.courses.includes(lmpType)
    );
};

/**
 * Gets the default LMP type for a trainee based on their course
 * @param course - The trainee's course name
 * @returns The appropriate LMP type
 */
export const getDefaultLMPTypeForCourse = (course: string): string => {
    // If the course name matches any known LMP type, use that
    const knownLMPTypes = ['FIC', 'FIC(I)', 'WSO', 'OFI', 'PLT Refresh', 'PLT CONV', 'QFI CONV', 'Staff CAT'];
    
    if (knownLMPTypes.some(lmp => course.toLowerCase().includes(lmp.toLowerCase()))) {
        for (const lmp of knownLMPTypes) {
            if (course.toLowerCase().includes(lmp.toLowerCase())) {
                return lmp;
            }
        }
    }
    
    // Default to basic pilot course
    return 'BPC+IPC';
};

/**
 * Validates if an LMP type exists in the syllabus
 * @param lmpType - The LMP type to validate
 * @param allSyllabusItems - Complete list of syllabus items
 * @returns True if LMP type is valid, false otherwise
 */
export const isValidLMPType = (
    lmpType: string, 
    allSyllabusItems: SyllabusItemDetail[]
): boolean => {
    const filteredItems = filterSyllabusByLMPType(allSyllabusItems, lmpType);
    return filteredItems.length > 0;
};