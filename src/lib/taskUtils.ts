/**
 * Helper to parse a date out of a text string that contains "until/by/through/to DD/MM/YYYY" or similar patterns.
 * Returns the date as a "YYYY-MM-DD" string, or null if not parsed.
 */
export function parseUntilDate(text: string): string | null {
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

/**
 * Returns the current date in Australia/Adelaide timezone as YYYY-MM-DD.
 */
export function getAdelaideTodayStr(): string {
  const options = { timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

/**
 * Returns the absolute ISO string representing midnight today in Australia/Adelaide timezone.
 */
export function getAdelaideMidnightISO(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  
  let year = 2026, month = 1, day = 1;
  parts.forEach(p => {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
  });
  
  const tempDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Adelaide' }));
  const adelaideMidnight = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 0, 0, 0, 0);
  
  const localTime = new Date();
  const adelaideLocalTime = new Date(localTime.toLocaleString('en-US', { timeZone: 'Australia/Adelaide' }));
  const diffMs = adelaideLocalTime.getTime() - localTime.getTime();
  
  const absoluteAdelaideMidnight = new Date(adelaideMidnight.getTime() - diffMs);
  return absoluteAdelaideMidnight.toISOString();
}

/**
 * Checks if a task is from a previous handover (different date or shift).
 */
export function isTaskFromPreviousHandover(task: any): boolean {
  if (task.carry_until_date) return false;
  if (!task.handover || !task.handover.shift_date || !task.handover.shift_type) return false;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  let year = 2026, month = 1, day = 1, hour = 0;
  parts.forEach(p => {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'hour') hour = parseInt(p.value, 10);
  });
  
  if (hour === 24) hour = 0;
  
  const targetDate = new Date(year, month - 1, day);
  if (hour >= 0 && hour < 7) {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  const todayStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  
  let currentShiftType = 'morning';
  if (hour >= 7 && hour < 15) currentShiftType = 'morning';
  else if (hour >= 15 && hour < 23) currentShiftType = 'afternoon';
  else currentShiftType = 'night';

  return task.handover.shift_date !== todayStr || task.handover.shift_type !== currentShiftType;
}
