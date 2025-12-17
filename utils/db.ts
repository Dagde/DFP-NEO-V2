
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'fileRepositoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db: IDBDatabase;

interface FileRecord {
    id: string;
    name: string;
    folderId: string;
    content: File;
}

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(true);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addFile = (file: File, folderId: string, name: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const id = uuidv4();
        const fileRecord: FileRecord = { id, name, folderId, content: file };

        const request = store.add(fileRecord);

        request.onsuccess = () => {
            resolve(id);
        };

        request.onerror = () => {
            console.error('Error adding file:', request.error);
            reject(request.error);
        };
    });
};

export const getFile = (id: string): Promise<FileRecord | undefined> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Error getting file:', request.error);
            reject(request.error);
        };
    });
};

// Returns metadata only to avoid loading all file contents into memory
export const getAllFiles = (): Promise<{ id: string, name: string, folderId: string }[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const files: { id: string, name: string, folderId: string }[] = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const { id, name, folderId } = cursor.value;
                files.push({ id, name, folderId });
                cursor.continue();
            } else {
                resolve(files);
            }
        };

        request.onerror = () => {
            console.error('Error getting all files:', request.error);
            reject(request.error);
        };
    });
};

export const deleteFile = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting file:', request.error);
            reject(request.error);
        };
    });
};

export const seedDefaultTemplates = async (): Promise<void> => {
    await initDB();
    const files = await getAllFiles();
    const folderId = "logbook_templates";
    const miscFolderId = "miscellaneous";
    
    // Clean up old templates to force update
    const oldXlsx = files.find(f => f.name === "ADF_Logbook_Template.xlsx" && f.folderId === folderId);
    if (oldXlsx) await deleteFile(oldXlsx.id);
    
    const oldPdf = files.find(f => f.name === "ADF_Logbook_Template.pdf" && f.folderId === folderId);
    if (oldPdf) await deleteFile(oldPdf.id);

    const oldNeoLogo = files.find(f => f.name === "NEO_Logo.pdf" && f.folderId === miscFolderId);
    if (oldNeoLogo) await deleteFile(oldNeoLogo.id);
    
    // 1. Excel Template Generation
    if ((window as any).XLSX) {
        const XLSX = (window as any).XLSX;
        const ws_data = [
             [
                "Year", "Date", "Type", "Tail (Mark)", "Captain", "Co-Pilot / 2nd Pilot / Crew", "Duty",
                "Day Flying", "", "",
                "Night Flying", "", "",
                "TOTAL", 
                "Captain", "Instructor", "Sim", "Actual", "2D App", "3D App",
                "Simulator", "", "", "" 
            ],
            [
                "", "", "", "", "", "", "",
                "P1", "P2", "Dual",
                "P1", "P2", "Dual",
                "",
                "", "", "", "", "", "",
                "P1", "P2", "Dual", "TOTAL"
            ],
            [
                "", "", "", "", "", "", "Totals brought Forward",
                "", "", "",
                "", "", "",
                "",
                "", "", "", "", "", "",
                "", "", "", ""
            ]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        
        if(!ws['!merges']) ws['!merges'] = [];
        // Vertical merges for single-row headers
        [0, 1, 2, 3, 4, 5, 6, 13, 14, 15, 16, 17, 18, 19].forEach(c => {
            ws['!merges'].push({ s: { r: 0, c: c }, e: { r: 1, c: c } });
        });
        // Horizontal merges for grouped headers
        ws['!merges'].push({ s: { r: 0, c: 7 }, e: { r: 0, c: 9 } }); // Day
        ws['!merges'].push({ s: { r: 0, c: 10 }, e: { r: 0, c: 12 } }); // Night
        ws['!merges'].push({ s: { r: 0, c: 20 }, e: { r: 0, c: 23 } }); // Simulator

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Logbook");
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const file = new File([blob], "ADF_Logbook_Template.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        
        await addFile(file, folderId, "ADF_Logbook_Template.xlsx");
        console.log("Seeded Logbook Template (XLSX)");
    }

    // 2. PDF Template Generation
    if ((window as any).jspdf) {
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(18);
        doc.text("ADF Logbook Template", 14, 15);

        const bfRow = [
            { content: 'Totals brought Forward', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, 
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
        ];

        doc.autoTable({
            startY: 20,
            head: [
                [
                    { content: 'Year', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Date', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Type', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Tail\n(Mark)', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Captain', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Co-Pilot /\n2nd Pilot /\nCrew', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Duty', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Day Flying', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'Night Flying', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'TOTAL', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Captain', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Instructor', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Sim', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Actual', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: '2D App', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: '3D App', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Simulator', colSpan: 4, styles: { halign: 'center' } },
                ],
                [
                    'P1', 'P2', 'Dual', // Day
                    'P1', 'P2', 'Dual', // Night
                    'P1', 'P2', 'Dual', 'TOTAL' // Simulator
                ]
            ],
            body: [
                bfRow,
                ...Array(20).fill(['','','','','','','','','','','','','','','','','','','','','','','',''])
            ],
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, lineColor: [150, 150, 150], lineWidth: 0.1 },
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
             columnStyles: { 
                 0: { cellWidth: 10 }, 1: { cellWidth: 12 }, 2: { cellWidth: 12 }, 3: { cellWidth: 15 },
                 4: { cellWidth: 20 }, 5: { cellWidth: 20 }, 6: { cellWidth: 25 },
             }
        });

        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], "ADF_Logbook_Template.pdf", { type: "application/pdf" });

        await addFile(file, folderId, "ADF_Logbook_Template.pdf");
        console.log("Seeded Logbook Template (PDF)");
        
        
        // 3. NEO Logo PDF Generation (Miscellaneous)
        const logoDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = logoDoc.internal.pageSize.getWidth();
        const pageHeight = logoDoc.internal.pageSize.getHeight();
        const cx = pageWidth / 2;
        const cy = pageHeight / 2;
        const scale = 2.0;
        
        // Draw Logo
        // Shield Background
        logoDoc.setFillColor(0, 0, 0); // Black
        logoDoc.setDrawColor(0, 0, 0);
        // Top
        logoDoc.line(cx - 30 * scale, cy - 35 * scale, cx + 30 * scale, cy - 35 * scale);
        // Right down
        logoDoc.line(cx + 30 * scale, cy - 35 * scale, cx + 30 * scale, cy - 5 * scale);
        // Left down
        logoDoc.line(cx - 30 * scale, cy - 35 * scale, cx - 30 * scale, cy - 5 * scale);
        // Right curve tip
        logoDoc.line(cx + 30 * scale, cy - 5 * scale, cx, cy + 55 * scale);
        // Left curve tip
        logoDoc.line(cx - 30 * scale, cy - 5 * scale, cx, cy + 55 * scale);
        
        // Fill Shield
        logoDoc.rect(cx - 30 * scale, cy - 35 * scale, 60 * scale, 30 * scale, 'F');
        logoDoc.triangle(cx - 30 * scale, cy - 5 * scale, cx + 30 * scale, cy - 5 * scale, cx, cy + 55 * scale, 'F');
        
        // Face
        logoDoc.setFillColor(255, 255, 255); 
        logoDoc.roundedRect(cx - 20 * scale, cy - 25 * scale, 40 * scale, 50 * scale, 8 * scale, 8 * scale, 'F');

        // Sunglasses
        logoDoc.setFillColor(0, 0, 0); 
        logoDoc.roundedRect(cx - 20 * scale, cy - 15 * scale, 40 * scale, 12 * scale, 2 * scale, 2 * scale, 'F');

        // Nose
        logoDoc.setFillColor(200, 200, 200);
        logoDoc.triangle(cx - 3 * scale, cy + 2 * scale, cx + 3 * scale, cy + 2 * scale, cx, cy + 6 * scale, 'F');

        // Mouth
        logoDoc.setDrawColor(100, 100, 100);
        logoDoc.setLineWidth(1.5 * scale);
        logoDoc.line(cx - 6 * scale, cy + 15 * scale, cx + 6 * scale, cy + 15 * scale);

        // Collar
        logoDoc.setFillColor(0, 0, 0);
        logoDoc.triangle(cx - 15 * scale, cy + 50 * scale, cx + 15 * scale, cy + 50 * scale, cx, cy + 25 * scale, 'F');

        const logoBlob = logoDoc.output('blob');
        const logoFile = new File([logoBlob], "NEO_Logo.pdf", { type: "application/pdf" });
        await addFile(logoFile, miscFolderId, "NEO_Logo.pdf");
        console.log("Seeded NEO Logo PDF");
    }
};
