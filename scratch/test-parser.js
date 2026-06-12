function parseUntilDate(text) {
  if (!text) return null;

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthRegexStr = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-zA-Z]*';

  // Lowercase the text for matching
  const input = text.toLowerCase();

  // Look for keywords: until, by, through, to followed by spaces
  const dateMarker = /(?:until|by|through|to)\s+/i;
  const markerMatch = input.match(dateMarker);
  if (!markerMatch || markerMatch.index === undefined) return null;

  // Extract the string after the keyword
  const datePart = input.substring(markerMatch.index + markerMatch[0].length).trim();

  // 1. Match DD/MM/YYYY or DD-MM-YYYY
  let match = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const day = String(parseInt(match[1], 10)).padStart(2, '0');
    const month = String(parseInt(match[2], 10)).padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // 2. Match YYYY-MM-DD or YYYY/MM/DD
  match = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = String(parseInt(match[2], 10)).padStart(2, '0');
    const day = String(parseInt(match[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Match DD Month YYYY (e.g. 15th June 2026 or 15 June 2026)
  match = datePart.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s+(\d{4})/);
  if (match) {
    const day = String(parseInt(match[1], 10)).padStart(2, '0');
    const monthName = match[2].substring(0, 3);
    const monthIdx = months.indexOf(monthName);
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }

  // 4. Match Month DD YYYY (e.g. June 15, 2026 or June 15th 2026)
  match = datePart.match(new RegExp(`^${monthRegexStr}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(\\d{4})`));
  if (match) {
    const monthName = match[1].substring(0, 3);
    const monthIdx = months.indexOf(monthName);
    const day = String(parseInt(match[2], 10)).padStart(2, '0');
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }

  // 5. Match DD Month (e.g. 15th June or 15 June) -> defaults to current year
  match = datePart.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)/);
  if (match) {
    const day = String(parseInt(match[1], 10)).padStart(2, '0');
    const monthName = match[2].substring(0, 3);
    const monthIdx = months.indexOf(monthName);
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, '0');
      const year = new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
  }

  // 6. Match Month DD (e.g. June 15 or June 15th) -> defaults to current year
  match = datePart.match(new RegExp(`^${monthRegexStr}\\s+(\\d{1,2})(?:st|nd|rd|th)?`));
  if (match) {
    const monthName = match[1].substring(0, 3);
    const monthIdx = months.indexOf(monthName);
    const day = String(parseInt(match[2], 10)).padStart(2, '0');
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, '0');
      const year = new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

console.log('1:', parseUntilDate('Monitor vitals twice daily until 15/06/2026.'));
console.log('2:', parseUntilDate('Perform task until 15 June 2026'));
console.log('3:', parseUntilDate('Perform task until June 15'));
console.log('4:', parseUntilDate('Perform task until June 15, 2026'));
console.log('5:', parseUntilDate('until 15-06-2026'));
console.log('6:', parseUntilDate('by 15/06/2026'));
console.log('7:', parseUntilDate('through 15/06/2026'));
console.log('8:', parseUntilDate('to 15/06/2026'));
