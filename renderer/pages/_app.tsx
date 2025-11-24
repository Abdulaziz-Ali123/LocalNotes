import React from "react";
import type { AppProps } from "next/app";

import "../styles/globals.css";
import { ThemeProvider } from "@/renderer/lib/theme";

// App Component

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <div className="h-screen w-full overflow-hidden">
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}

export default MyApp;
