/**
 * CSV cells that spreadsheets would treat as formulas are prefixed with a
 * single quote. Counts stay numeric text without a leading formula marker.
 */

const FORMULA_START = /^[\t\r\n ]*[=+\-@]/;

const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const csvLine = (cells) => cells.map(csvCell).join(',');

const renderCsv = (rows) => `${rows.map(csvLine).join('\n')}\n`;

const reportStamp = (title, period, generatedAt = new Date()) => [
  ['Report', title],
  ['Generated at', generatedAt.toISOString()],
  ['Time zone', period?.timeZone || 'Asia/Manila'],
  ['Period start', period?.from || ''],
  ['Period end', period?.to || ''],
  ['Period start UTC', period?.start || ''],
  ['Period end UTC', period?.end || ''],
  ['Grouping', period?.grouping || ''],
];

module.exports = {
  csvCell,
  renderCsv,
  reportStamp,
};
