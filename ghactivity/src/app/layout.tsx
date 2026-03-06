import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata = {
  title: "ghactivity - GitHub Contribution Graph Art",
  description: "Draw pixel art on your GitHub contribution graph",
} satisfies Metadata;

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider>
          <main className="mx-auto max-w-4xl px-4 py-12">
            {props.children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
