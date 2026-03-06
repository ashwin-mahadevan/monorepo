"use client";

import { PRESET_PATTERN } from "@/lib/art";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ArtPreview() {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1 text-xs text-gray-500">
          {DAYS.map((day) => (
            <div key={day} className="h-3 w-6 leading-3">
              {day}
            </div>
          ))}
        </div>
        {/* Grid columns (weeks) */}
        {Array.from({ length: 52 }, (_, col) => (
          <div key={col} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }, (_, row) => (
              <div
                key={row}
                className={`h-3 w-3 rounded-sm ${
                  PRESET_PATTERN[row][col]
                    ? "bg-green-500"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
