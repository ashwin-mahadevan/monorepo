"use client";

import { useState } from "react";

export function ApplyButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState("");

  async function handleApply() {
    setStatus("loading");
    setResult("");
    try {
      const res = await fetch("/api/apply", { method: "POST" });
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
        <p className={status === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {result}
        </p>
      )}
    </div>
  );
}

export function RemoveButton() {
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
        <p className={status === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
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
