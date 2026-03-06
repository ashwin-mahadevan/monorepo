"use client";

import { useState } from "react";

export function ApplyButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<string>("");

  async function handleApply() {
    setStatus("loading");
    setResult("");
    try {
      const res = await fetch("/api/apply", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setResult(
          `Created ${data.commitsCreated} commits in ${data.repo}`,
        );
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
        {status === "loading" ? "Applying..." : "Apply Art"}
      </button>
      {result && (
        <p
          className={
            status === "success" ? "text-green-400" : "text-red-400"
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
        className="text-sm text-gray-400 transition hover:text-gray-200"
      >
        Sign out
      </button>
    </form>
  );
}
