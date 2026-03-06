"use client";

import { getCommitDates, PRESET_PATTERN } from "@/lib/art";

// GitHub contribution graph colors (light theme / dark theme)
const EMPTY_LIGHT = "#ebedf0";
const EMPTY_DARK = "#161b22";
const FILLED_LIGHT = "#40c463";
const FILLED_DARK = "#39d353";

// GitHub only labels Mon, Wed, Fri
const DAY_LABELS: (string | null)[] = [
  null,
  "Mon",
  null,
  "Wed",
  null,
  "Fri",
  null,
];

// Build month labels from the actual commit date grid
function getMonthLabels(): { col: number; label: string }[] {
  const dates = getCommitDates(
    Array.from({ length: 7 }, () => Array<boolean>(52).fill(true)),
  );
  const months: { col: number; label: string }[] = [];
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  let lastMonth = -1;
  for (let col = 0; col < 52; col++) {
    const d = dates[col * 7];
    if (!d) continue;
    const m = d.getUTCMonth();
    if (m !== lastMonth) {
      months.push({ col, label: fmt.format(d) });
      lastMonth = m;
    }
  }
  return months;
}

const CELL_SIZE = 10;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const LABEL_WIDTH = 28;
const HEADER_HEIGHT = 15;

export function ArtPreview() {
  const months = getMonthLabels();
  const gridWidth = 52 * (CELL_SIZE + CELL_GAP);
  const gridHeight = 7 * (CELL_SIZE + CELL_GAP);

  return (
    <div className="overflow-x-auto">
      <svg
        width={LABEL_WIDTH + gridWidth}
        height={HEADER_HEIGHT + gridHeight}
        className="block"
      >
        {/* Month labels */}
        {months.map(({ col, label }) => (
          <text
            key={col}
            x={LABEL_WIDTH + col * (CELL_SIZE + CELL_GAP)}
            y={10}
            className="fill-gray-500 dark:fill-gray-400"
            fontSize={9}
            fontFamily="system-ui, sans-serif"
          >
            {label}
          </text>
        ))}

        {/* Day labels (Mon, Wed, Fri) */}
        {DAY_LABELS.map(
          (label, row) =>
            label && (
              <text
                key={row}
                x={0}
                y={HEADER_HEIGHT + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 1}
                className="fill-gray-500 dark:fill-gray-400"
                fontSize={9}
                fontFamily="system-ui, sans-serif"
              >
                {label}
              </text>
            ),
        )}

        {/* Grid cells */}
        {Array.from({ length: 52 }, (_, col) =>
          Array.from({ length: 7 }, (_, row) => {
            const active = PRESET_PATTERN[row][col];
            return (
              <rect
                key={`${col}-${row}`}
                x={LABEL_WIDTH + col * (CELL_SIZE + CELL_GAP)}
                y={HEADER_HEIGHT + row * (CELL_SIZE + CELL_GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={CELL_RADIUS}
                ry={CELL_RADIUS}
                className={
                  active
                    ? "gh-cell-filled"
                    : "gh-cell-empty"
                }
              />
            );
          }),
        )}

        <style>{`
          .gh-cell-empty { fill: ${EMPTY_LIGHT}; }
          .gh-cell-filled { fill: ${FILLED_LIGHT}; }
          @media (prefers-color-scheme: dark) {
            .gh-cell-empty { fill: ${EMPTY_DARK}; }
            .gh-cell-filled { fill: ${FILLED_DARK}; }
          }
          :root.dark .gh-cell-empty { fill: ${EMPTY_DARK}; }
          :root.dark .gh-cell-filled { fill: ${FILLED_DARK}; }
        `}</style>
      </svg>
    </div>
  );
}
