import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "ghactivity - GitHub Contribution Graph Art",
  description: "Draw pixel art on your GitHub contribution graph",
} satisfies Metadata;

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <main className="mx-auto max-w-4xl px-4 py-12">{props.children}</main>
      </body>
    </html>
  );
}
