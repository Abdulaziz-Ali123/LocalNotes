/**
 * Name of code artifact: renderer/pages/_app.tsx
 * Brief description: Defines a Next.js renderer page for a LocalNotes application route.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Shaun; Abdulaziz-Ali123; m518n748
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import React, { useEffect } from "react";
import type { AppProps } from "next/app";

import "../styles/tw-animate.css";
import "../styles/globals.css";
import { ThemeProvider } from "@/renderer/lib/theme";
import { useBoundStore } from "@/renderer/store/useBoundStore";

import 'katex/dist/katex.min.css'
import { ErrorToastProvider } from "@/renderer/components/feedback/ErrorToastProvider";

// App Component

/**
 * Functionality: MyApp performs the my app workflow used by renderer/pages/_app.tsx.
 * Parameters: { Component, pageProps } (AppProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call MyApp from the owning module or component when this behavior is required.
 */
function MyApp({ Component, pageProps }: AppProps) {
  const initializeSettings = useBoundStore((s) => s.settings.initialize);

  // Load settings from the main process on app mount
  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  return (
      <ThemeProvider>
          <ErrorToastProvider>
              <div className="h-screen w-full">
                <Component {...pageProps} />
              </div>
          </ErrorToastProvider>
    </ThemeProvider>
  );
}

export default MyApp;
