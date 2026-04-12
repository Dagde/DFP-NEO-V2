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