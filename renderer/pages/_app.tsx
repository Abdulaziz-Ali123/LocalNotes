import React, { useEffect } from "react";
import type { AppProps } from "next/app";

import "../styles/tw-animate.css";
import "../styles/globals.css";
import { ThemeProvider } from "@/renderer/lib/theme";
import { useBoundStore } from "@/renderer/store/useBoundStore";

import 'katex/dist/katex.min.css'
import { ErrorToastProvider } from "@/renderer/components/feedback/ErrorToastProvider";

// App Component

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
