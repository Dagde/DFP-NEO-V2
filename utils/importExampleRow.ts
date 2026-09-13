type WorksheetCell = {
    v?: unknown;
    w?: string;
    s?: {
        font?: {
            italic?: boolean;
            color?: {
                rgb?: string;
                indexed?: number;
                theme?: number;
            };
        };
        fgColor?: {
            rgb?: string;
            indexed?: number;
            theme?: number;
        };
        fillId?: number;
        fillid?: string;
    };
};

export type ImportRowRecord = {
    row: any;
    excelRowNumber: number;
};

export type ExampleRowDetection = {
    hasExampleCandidate: boolean;
    isStyledExampleRow: boolean;
    rowNumber: number;
    populatedCellCount: number;
    italicCellCount: number;
    differingColourCellCount: number;
};

const getCell = (worksheet: any, rowNumber: number, columnNumber: number): WorksheetCell | undefined => {
    const address = `${columnToName(columnNumber)}${rowNumber}`;
    return worksheet?.[address];
};

const columnToName = (columnNumber: number): string => {
    let name = '';
    let column = columnNumber;
    while (column > 0) {
        const remainder = (column - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        column = Math.floor((column - 1) / 26);
    }
    return name;
};

const normaliseCellText = (value: unknown): string => String(value ?? '').trim();

const getCellText = (cell?: WorksheetCell): string => normaliseCellText(cell?.w ?? cell?.v);

const getColourKey = (color?: { rgb?: string; indexed?: number; theme?: number }): string => {
    if (!color) return '';
    if (color.rgb) return `rgb:${color.rgb.toUpperCase()}`;
    if (color.indexed !== undefined) return `indexed:${color.indexed}`;
    if (color.theme !== undefined) return `theme:${color.theme}`;
    return '';
};

const getStyleColourKey = (cell?: WorksheetCell): string => {
    const fontColour = getColourKey(cell?.s?.font?.color);
    if (fontColour) return `font:${fontColour}`;
    const fillColour = getColourKey(cell?.s?.fgColor);
    if (fillColour) return `fill:${fillColour}`;
    if (cell?.s?.fillId !== undefined) return `fillid:${cell.s.fillId}`;
    if (cell?.s?.fillid !== undefined) return `fillid:${cell.s.fillid}`;
    if (cell?.s?.patternType) return `pattern:${cell.s.patternType}`;
    return '';
};

const workbookHasItalicFont = (workbook?: any): boolean => (
    Array.isArray(workbook?.Styles?.Fonts) && workbook.Styles.Fonts.some((font: any) => Boolean(font?.italic))
);

export const detectStyledExampleRow = (
    worksheet: any,
    headerRowNumber: number,
    headerColumnCount: number,
    workbook?: any,
): ExampleRowDetection => {
    const rowNumber = headerRowNumber + 1;
    let populatedCellCount = 0;
    let italicCellCount = 0;
    let differingColourCellCount = 0;
    const hasWorkbookItalicStyle = workbookHasItalicFont(workbook);

    for (let column = 1; column <= headerColumnCount; column += 1) {
        const headerCell = getCell(worksheet, headerRowNumber, column);
        const exampleCell = getCell(worksheet, rowNumber, column);
        if (!getCellText(exampleCell)) continue;

        populatedCellCount += 1;
        if (exampleCell?.s?.font?.italic || hasWorkbookItalicStyle) italicCellCount += 1;

        const headerColour = getStyleColourKey(headerCell);
        const exampleColour = getStyleColourKey(exampleCell);
        if (headerColour && headerColour !== exampleColour) differingColourCellCount += 1;
    }

    const hasExampleCandidate = populatedCellCount > 0;
    const italicRatio = populatedCellCount > 0 ? italicCellCount / populatedCellCount : 0;
    const colourRatio = populatedCellCount > 0 ? differingColourCellCount / populatedCellCount : 0;

    return {
        hasExampleCandidate,
        isStyledExampleRow: hasExampleCandidate && italicRatio >= 0.75 && colourRatio >= 0.5,
        rowNumber,
        populatedCellCount,
        italicCellCount,
        differingColourCellCount,
    };
};

export const buildRowRecords = (
    rawRows: any[][],
    headerRowIndex: number,
    skipExampleRow: boolean,
): ImportRowRecord[] => {
    const header = rawRows[headerRowIndex].map(cell => String(cell || '').trim());
    return rawRows
        .slice(headerRowIndex + 1)
        .map((row, index): ImportRowRecord => ({
            excelRowNumber: headerRowIndex + index + 2,
            row: header.reduce((record: any, key, columnIndex) => {
                if (key) record[key] = row[columnIndex];
                return record;
            }, {}),
        }))
        .filter(record => !skipExampleRow || record.excelRowNumber !== headerRowIndex + 2)
        .filter(record => Object.values(record.row).some(value => normaliseCellText(value)));
};
