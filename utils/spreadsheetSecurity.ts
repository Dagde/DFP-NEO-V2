const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;

const BLOCKED_WORKBOOK_INDICATORS = [
  { token: 'vbaproject.bin', reason: 'The workbook contains macro content.' },
  { token: 'xl/embeddings/', reason: 'The workbook contains embedded objects.' },
  { token: 'xl/activexcontrols/', reason: 'The workbook contains ActiveX controls.' },
  { token: 'xl/externallinks/', reason: 'The workbook contains external workbook links.' },
  { token: 'application/vnd.ms-office.activex', reason: 'The workbook contains ActiveX content.' },
];

const LEGACY_MACRO_INDICATORS = ['_vba_project', 'vba', 'macrosheet'];

export const getSpreadsheetFileExtension = (fileName = ''): string => (
  fileName.split('.').pop()?.toLowerCase() || ''
);

export const isCsvSpreadsheetFile = (fileName = ''): boolean => (
  getSpreadsheetFileExtension(fileName) === 'csv'
);

const hasZipWorkbookSignature = (bytes: Uint8Array): boolean => (
  bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
);

const hasLegacyExcelSignature = (bytes: Uint8Array): boolean => {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
};

const arrayBufferToLatin1Lowercase = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let output = '';
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    output += String.fromCharCode(...Array.from(chunk));
  }
  return output.toLowerCase();
};

export type SpreadsheetValidationOptions = {
  maxBytes?: number;
  allowCsv?: boolean;
  allowLegacyXls?: boolean;
};

export const validateSpreadsheetBeforeParse = (
  fileName: string,
  buffer: ArrayBuffer,
  options: SpreadsheetValidationOptions = {},
): void => {
  const maxBytes = options.maxBytes ?? MAX_WORKBOOK_BYTES;
  const allowCsv = options.allowCsv ?? true;
  const allowLegacyXls = options.allowLegacyXls ?? true;
  const extension = getSpreadsheetFileExtension(fileName);

  if (buffer.byteLength <= 0) {
    throw new Error('No upload file data was supplied.');
  }
  if (buffer.byteLength > maxBytes) {
    throw new Error(`The upload file is too large. The maximum workbook size is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  if (extension === 'csv') {
    if (!allowCsv) throw new Error('CSV files are not accepted for this import.');
    return;
  }
  if (extension !== 'xlsx' && extension !== 'xls') {
    throw new Error('Please select an .xlsx, .xls or .csv file.');
  }

  const bytes = new Uint8Array(buffer);
  if (extension === 'xlsx' && !hasZipWorkbookSignature(bytes)) {
    throw new Error('The uploaded workbook does not look like a valid XLSX file.');
  }
  if (extension === 'xls') {
    if (!allowLegacyXls) throw new Error('Legacy .xls files are not accepted for this import. Save the workbook as .xlsx or .csv and try again.');
    if (!hasLegacyExcelSignature(bytes) && !hasZipWorkbookSignature(bytes)) {
      throw new Error('The uploaded XLS file does not look like a valid Excel workbook.');
    }
  }

  const searchable = arrayBufferToLatin1Lowercase(buffer);
  for (const indicator of BLOCKED_WORKBOOK_INDICATORS) {
    if (searchable.includes(indicator.token)) throw new Error(indicator.reason);
  }
  if (extension === 'xls' && LEGACY_MACRO_INDICATORS.some((indicator) => searchable.includes(indicator))) {
    throw new Error('The legacy XLS workbook appears to contain macro content.');
  }
};
