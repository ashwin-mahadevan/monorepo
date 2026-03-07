// Contribution graph: 52 weeks x 7 days, Sunday=0 at top
// Pattern is [row (day of week)][col (week)] where true = commit

export type PatternName =
  | "hi"
  | "heart"
  | "wave"
  | "diamond"
  | "ghactivity"
  | "random";

function emptyGrid(): boolean[][] {
  return Array.from({ length: 7 }, () => Array<boolean>(52).fill(false));
}

function makeHi(): boolean[][] {
  const grid = emptyGrid();

  // H: left/right verticals + middle bar
  const startH = 20;
  for (let row = 0; row < 7; row++) {
    grid[row][startH] = true;
    grid[row][startH + 4] = true;
    if (row === 3) {
      grid[row][startH + 1] = true;
      grid[row][startH + 2] = true;
      grid[row][startH + 3] = true;
    }
  }

  // I: center vertical + top/bottom bars
  const startI = 27;
  for (let row = 0; row < 7; row++) {
    grid[row][startI + 2] = true;
  }
  for (let c = 0; c < 5; c++) {
    grid[0][startI + c] = true;
    grid[6][startI + c] = true;
  }

  return grid;
}

function makeHeart(): boolean[][] {
  const grid = emptyGrid();

  // 9-col heart centered around col 25 (cols 21–29)
  const heartShape = [
    [0, 0, 1, 1, 0, 1, 1, 0, 0], // row 0: two bumps
    [0, 1, 1, 1, 1, 1, 1, 1, 0], // row 1
    [0, 1, 1, 1, 1, 1, 1, 1, 0], // row 2
    [0, 0, 1, 1, 1, 1, 1, 0, 0], // row 3
    [0, 0, 0, 1, 1, 1, 0, 0, 0], // row 4
    [0, 0, 0, 0, 1, 0, 0, 0, 0], // row 5: tip
    [0, 0, 0, 0, 0, 0, 0, 0, 0], // row 6: empty
  ];

  const startCol = 21;
  for (let row = 0; row < 7; row++) {
    for (let c = 0; c < 9; c++) {
      if (heartShape[row][c]) {
        grid[row][startCol + c] = true;
      }
    }
  }

  return grid;
}

function makeWave(): boolean[][] {
  const grid = emptyGrid();

  // 4-period sine wave across 52 cols; amplitude fills rows 0–6
  for (let col = 0; col < 52; col++) {
    const exact = 3 + 3 * Math.sin((col * 2 * Math.PI) / 13);
    const r1 = Math.max(0, Math.min(6, Math.floor(exact)));
    const r2 = Math.max(0, Math.min(6, Math.ceil(exact)));
    grid[r1][col] = true;
    grid[r2][col] = true;
  }

  return grid;
}

function makeDiamond(): boolean[][] {
  const grid = emptyGrid();

  // Four diamond outlines centered on row 3, spaced 13 cols apart
  const centers: [number, number][] = [
    [3, 8],
    [3, 21],
    [3, 34],
    [3, 47],
  ];
  const radius = 3;

  for (const [cr, cc] of centers) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 52; col++) {
        if (Math.abs(row - cr) + Math.abs(col - cc) === radius) {
          grid[row][col] = true;
        }
      }
    }
  }

  return grid;
}

function makeGhactivity(): boolean[][] {
  const grid = emptyGrid();

  // 4×7 pixel font glyphs (4 cols wide, 7 rows tall), glyph[row][col].
  const F = false;
  const T = true;
  const GLYPHS: Record<string, boolean[][]> = {
    G: [
      [F, T, T, T],
      [T, F, F, F],
      [T, F, F, F],
      [T, F, T, T],
      [T, F, F, T],
      [T, F, F, T],
      [F, T, T, T],
    ],
    H: [
      [T, F, F, T],
      [T, F, F, T],
      [T, F, F, T],
      [T, T, T, T],
      [T, F, F, T],
      [T, F, F, T],
      [T, F, F, T],
    ],
    A: [
      [F, T, T, F],
      [T, F, F, T],
      [T, F, F, T],
      [T, T, T, T],
      [T, F, F, T],
      [T, F, F, T],
      [T, F, F, T],
    ],
    C: [
      [F, T, T, T],
      [T, F, F, F],
      [T, F, F, F],
      [T, F, F, F],
      [T, F, F, F],
      [T, F, F, F],
      [F, T, T, T],
    ],
    T: [
      [T, T, T, T],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
    ],
    I: [
      [T, T, T, T],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [T, T, T, T],
    ],
    V: [
      [T, F, F, T],
      [T, F, F, T],
      [T, F, F, T],
      [T, F, F, T],
      [T, F, F, T],
      [F, T, T, F],
      [F, T, T, F],
    ],
    Y: [
      [T, F, F, T],
      [T, F, F, T],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
      [F, T, T, F],
    ],
  };

  // "GHACTIVITY" = 10 chars × (4 wide + 1 gap) − 1 = 49 cols.
  // Center in 52: start at col 2, end at col 50.
  let col = 2;
  for (const char of "GHACTIVITY") {
    const glyph = GLYPHS[char];
    if (!glyph) continue;
    for (let row = 0; row < 7; row++) {
      for (let c = 0; c < 4; c++) {
        if (glyph[row][c] && col + c < 52) {
          grid[row][col + c] = true;
        }
      }
    }
    col += 5; // 4 wide + 1 gap
  }

  return grid;
}

export function generateRandom(): boolean[][] {
  const grid = emptyGrid();
  for (let col = 0; col < 52; col++) {
    for (let row = 0; row < 7; row++) {
      const isWeekend = row === 0 || row === 6;
      grid[row][col] = Math.random() < (isWeekend ? 0.15 : 0.4);
    }
  }
  return grid;
}

export const PATTERNS: Record<
  Exclude<PatternName, "random">,
  boolean[][]
> = {
  hi: makeHi(),
  heart: makeHeart(),
  wave: makeWave(),
  diamond: makeDiamond(),
  ghactivity: makeGhactivity(),
};

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
