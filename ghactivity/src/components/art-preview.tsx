"use client";

import { useState } from "react";
import { getCommitDates, PRESET_PATTERN } from "@/lib/art";

// GitHub contribution graph colors by intensity level (0-4)
// Light theme
const COLORS_LIGHT = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
// Dark theme
const COLORS_DARK = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

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

interface ArtPreviewProps {
  /** Existing contribution grid: 7 rows × 52 cols, values 0-4. */
  contributions?: number[][];
}

export function ArtPreview({ contributions }: ArtPreviewProps) {
  const [showArt, setShowArt] = useState(true);
  const months = getMonthLabels();
  const gridWidth = 52 * (CELL_SIZE + CELL_GAP);
  const gridHeight = 7 * (CELL_SIZE + CELL_GAP);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showArt}
          onChange={(e) => setShowArt(e.target.checked)}
          className="accent-green-600"
        />
        <span className="text-gray-600 dark:text-gray-400">Show art preview</span>
      </label>
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
            const artActive = showArt && PRESET_PATTERN[row][col];
            const existing = contributions?.[row]?.[col] ?? 0;
            const level = artActive ? 4 : existing;

            return (
              <rect
                key={`${col}-${row}`}
                x={LABEL_WIDTH + col * (CELL_SIZE + CELL_GAP)}
                y={HEADER_HEIGHT + row * (CELL_SIZE + CELL_GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={CELL_RADIUS}
                ry={CELL_RADIUS}
                className={`gh-cell-${level}`}
              />
            );
          }),
        )}

        <style>{`
          ${COLORS_LIGHT.map((c, i) => `.gh-cell-${i} { fill: ${c}; }`).join("\n")}
          @media (prefers-color-scheme: dark) {
            ${COLORS_DARK.map((c, i) => `.gh-cell-${i} { fill: ${c}; }`).join("\n")}
          }
          :root.dark .gh-cell-0 { fill: ${COLORS_DARK[0]}; }
          :root.dark .gh-cell-1 { fill: ${COLORS_DARK[1]}; }
          :root.dark .gh-cell-2 { fill: ${COLORS_DARK[2]}; }
          :root.dark .gh-cell-3 { fill: ${COLORS_DARK[3]}; }
          :root.dark .gh-cell-4 { fill: ${COLORS_DARK[4]}; }
        `}</style>
      </svg>
      </div>
    </div>
  );
}
