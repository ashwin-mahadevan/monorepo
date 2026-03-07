"use client";

import { useState } from "react";
import { ArtPreview } from "@/components/art-preview";
import { PATTERNS, generateRandom, type PatternName } from "@/lib/art";

type Mode = PatternName | "custom";

const PATTERN_LABELS: { mode: Mode; label: string }[] = [
  { mode: "hi", label: "HI" },
  { mode: "heart", label: "Heart" },
  { mode: "wave", label: "Wave" },
  { mode: "diamond", label: "Diamond" },
  { mode: "random", label: "Random" },
  { mode: "custom", label: "Custom" },
];

interface DashboardProps {
  contributions?: number[][];
  artApplied?: boolean;
}

export function Dashboard({ contributions, artApplied }: DashboardProps) {
  const [mode, setMode] = useState<Mode>("hi");
  const [pattern, setPattern] = useState<boolean[][]>(PATTERNS.hi);
  const editable = mode === "custom";

  function handleSelectMode(next: Mode) {
    setMode(next);
    if (next === "random") {
      setPattern(generateRandom());
    } else if (next === "custom") {
      // Start from the currently displayed pattern so the user can edit it
    } else {
      setPattern(PATTERNS[next]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pattern selector */}
      <div className="flex flex-wrap gap-2">
        {PATTERN_LABELS.map(({ mode: m, label }) => (
          <button
            key={m}
            onClick={() => handleSelectMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Preview grid */}
      <div>
        <ArtPreview
          contributions={contributions}
          artApplied={artApplied}
          pattern={pattern}
          onPatternChange={setPattern}
          editable={editable}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <ApplyButton pattern={pattern} />
        <RemoveButton />
      </div>
    </div>
  );
}

function ApplyButton({ pattern }: { pattern: boolean[][] }) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState("");

  async function handleApply() {
    setStatus("loading");
    setResult("");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setResult("Art is being applied — this may take a few minutes.");
      } else {
        setStatus("error");
        setResult(data.error ?? "Unknown error");
      }
    } catch (err) {
      setStatus("error");
      setResult(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleApply}
        disabled={status === "loading"}
        className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition hover:bg-green-500 disabled:opacity-50"
      >
        {status === "loading" ? "Starting..." : "Apply Art"}
      </button>
      {result && (
        <p
          className={
            status === "success"
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {result}
        </p>
      )}
    </div>
  );
}

function RemoveButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState("");

  async function handleRemove() {
    setStatus("loading");
    setResult("");
    try {
      const res = await fetch("/api/remove", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setResult("Repository is being removed.");
      } else {
        setStatus("error");
        setResult(data.error ?? "Unknown error");
      }
    } catch (err) {
      setStatus("error");
      setResult(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleRemove}
        disabled={status === "loading"}
        className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
      >
        {status === "loading" ? "Removing..." : "Remove Art"}
      </button>
      {result && (
        <p
          className={
            status === "success"
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {result}
        </p>
      )}
    </div>
  );
}

export function LogoutButton() {
  return (
    <form action="/api/logout" method="POST" className="ml-auto">
      <button
        type="submit"
        className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Sign out
      </button>
    </form>
  );
}
