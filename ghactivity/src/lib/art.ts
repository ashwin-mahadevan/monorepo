// Contribution graph: 52 weeks x 7 days, Sunday=0 at top
// Pattern is [row (day of week)][col (week)] where true = commit

// "HI" pattern (7 rows x ~20 cols, placed in the middle of the graph)
// H = cols 0-4, I = cols 6-10
const HI_PATTERN: boolean[][] = Array.from({ length: 7 }, () =>
  Array<boolean>(52).fill(false),
);

// H
function setH(startCol: number) {
  for (let row = 0; row < 7; row++) {
    HI_PATTERN[row][startCol] = true; // left vertical
    HI_PATTERN[row][startCol + 4] = true; // right vertical
    if (row === 3) {
      // middle horizontal
      HI_PATTERN[row][startCol + 1] = true;
      HI_PATTERN[row][startCol + 2] = true;
      HI_PATTERN[row][startCol + 3] = true;
    }
  }
}

// I
function setI(startCol: number) {
  for (let row = 0; row < 7; row++) {
    HI_PATTERN[row][startCol + 2] = true; // center vertical
  }
  // top and bottom horizontal bars
  for (let c = 0; c < 5; c++) {
    HI_PATTERN[0][startCol + c] = true;
    HI_PATTERN[6][startCol + c] = true;
  }
}

// Place "HI" roughly centered: start H at col 20, I at col 27
setH(20);
setI(27);

export const PRESET_PATTERN = HI_PATTERN;

export function getCommitDates(pattern: boolean[][]): Date[] {
  const dates: Date[] = [];

  // Find the most recent Sunday (start of the current contribution graph week)
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
  );
  const dayOfWeek = today.getUTCDay(); // 0 = Sunday

  // The contribution graph ends at the current week.
  // Week 51 (rightmost) = current week, week 0 (leftmost) = 52 weeks ago.
  const currentSunday = new Date(today);
  currentSunday.setUTCDate(currentSunday.getUTCDate() - dayOfWeek);

  const graphStartSunday = new Date(currentSunday);
  graphStartSunday.setUTCDate(graphStartSunday.getUTCDate() - 51 * 7);

  for (let col = 0; col < 52; col++) {
    for (let row = 0; row < 7; row++) {
      if (pattern[row][col]) {
        const d = new Date(graphStartSunday);
        d.setUTCDate(d.getUTCDate() + col * 7 + row);
        // Skip future dates
        if (d <= today) {
          dates.push(d);
        }
      }
    }
  }

  return dates;
}
