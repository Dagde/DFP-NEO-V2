const escapeOrganisationTemplateHtml = (value: unknown): string => (
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

export const downloadOrganisationStructureTemplateFile = (
  fileName = 'DFP_NEO_Organisation_Structure_Template.xls',
) => {
  const headers = ['Level', 'Level Type', 'Name', 'Parent', 'Notes'];
  const rows = [
    ['0', 'Organisation', 'Organisation', '', 'Top level organisation'],
    ['1', 'Organisation Level 1', 'Organisation Level 1', 'Organisation', 'First organisation layer below the top level'],
    ['2', 'Organisation Level 2', 'Organisation Level 2', 'Organisation Level 1', 'Second organisation layer'],
    ['3', 'Organisation Level 3', 'Organisation Level 3', 'Organisation Level 2', 'Add as many levels as needed before units'],
    ['4', 'Organisation Level 4', 'Organisation Level 4', 'Organisation Level 3', 'Optional deeper level'],
    ['5', 'Organisation Level 5', 'Organisation Level 5', 'Organisation Level 4', 'Optional deeper level'],
    ['6', 'Organisation Level 6', 'Organisation Level 6', 'Organisation Level 5', 'Optional deeper level'],
  ];
  const tableRows = [
    `<tr>${headers.map((header) => `<th>${escapeOrganisationTemplateHtml(header)}</th>`).join('')}</tr>`,
    ...rows.map((row) => `<tr>${headers.map((_, index) => `<td>${escapeOrganisationTemplateHtml(row[index] || '')}</td>`).join('')}</tr>`),
  ].join('');
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { font-family: Arial, Helvetica, sans-serif; color: #162033; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
col.level { width: 90px; }
col.type { width: 180px; }
col.name { width: 250px; }
col.parent { width: 250px; }
col.notes { width: 390px; }
.title { background: #143142; color: #ffffff; font-size: 20px; font-weight: 700; height: 34px; }
.subtitle { background: #dbeafe; color: #143142; font-size: 12px; font-weight: 600; height: 28px; }
.guide { background: #eef2f7; color: #334155; font-size: 11px; height: 24px; }
th { background: #f97316; color: #ffffff; border: 1px solid #9a3412; font-size: 12px; font-weight: 700; height: 28px; text-align: left; padding: 6px; }
td { border: 1px solid #cbd5e1; font-size: 12px; height: 26px; padding: 6px; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
<table>
<colgroup><col class="level" /><col class="type" /><col class="name" /><col class="parent" /><col class="notes" /></colgroup>
<tr><td class="title" colspan="${headers.length}">DFP NEO Organisation Structure Template</td></tr>
<tr><td class="subtitle" colspan="${headers.length}">Use this single table for all organisation levels before units. Add one row per organisation item.</td></tr>
<tr><td class="guide" colspan="${headers.length}">Level 0 is the top organisation. Level Type is the plain-English name for that layer. Each lower level names its immediate parent in the Parent column.</td></tr>
<tr><td colspan="${headers.length}"></td></tr>
${tableRows}
</table>
</body>
</html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/\.csv$/i, '.xls').replace(/\.xlsx$/i, '.xls');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
