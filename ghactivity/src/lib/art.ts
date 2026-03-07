// Contribution graph: 52 weeks x 7 days, Sunday=0 at top
// Pattern is [row (day of week)][col (week)] where true = commit

export type PatternName = "hi" | "heart" | "wave" | "diamond" | "random";

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
};

// 3×5 pixel font (3 cols wide, 5 rows tall) for watermark glyphs.
// Each glyph is glyph[row][col], row 0 = top.
const WATERMARK_FONT: Record<string, boolean[][]> = {
  g: [
    [true, true, true],
    [true, false, false],
    [true, true, true],
    [false, false, true],
    [true, true, true],
  ],
  h: [
    [true, false, true],
    [true, false, true],
    [true, true, true],
    [true, false, true],
    [true, false, true],
  ],
  a: [
    [false, true, false],
    [true, false, true],
    [true, true, true],
    [true, false, true],
    [true, false, true],
  ],
  c: [
    [true, true, true],
    [true, false, false],
    [true, false, false],
    [true, false, false],
    [true, true, true],
  ],
  t: [
    [true, true, true],
    [false, true, false],
    [false, true, false],
    [false, true, false],
    [false, true, false],
  ],
};

// Watermark text rendered as lit cells in the contribution graph.
// Placed at rows 1–5 (Mon–Fri), cols 33–51 (right side).
const WATERMARK_TEXT = "ghact";
const WATERMARK_ROW_START = 1;
const WATERMARK_COL_START = 33;

/** Returns a copy of pattern with the "ghact" watermark overlaid as lit cells. */
export function addWatermark(pattern: boolean[][]): boolean[][] {
  const grid = pattern.map((r) => [...r]);
  let col = WATERMARK_COL_START;
  for (const char of WATERMARK_TEXT) {
    const glyph = WATERMARK_FONT[char];
    if (!glyph) continue;
    for (let r = 0; r < glyph.length; r++) {
      for (let c = 0; c < glyph[r].length; c++) {
        if (glyph[r][c]) {
          const gridRow = WATERMARK_ROW_START + r;
          const gridCol = col + c;
          if (gridRow < 7 && gridCol < 52) {
            grid[gridRow][gridCol] = true;
          }
        }
      }
    }
    col += glyph[0].length + 1; // 3 wide + 1 gap
  }
  return grid;
}

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
