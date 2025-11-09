const colors = require("tailwindcss/colors");

module.exports = {
  content: ["./renderer/pages/**/*.{js,ts,jsx,tsx}", "./renderer/components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)", // Nord0
        foreground: "var(--foreground)", // Nord6
        card: {
          DEFAULT: "var(--card)", // Nord1-2
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)", // Nord8
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)", // Nord2-3
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)", // Nord10
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)", // Nord11
          foreground: "var(--destructive-forground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          1: "var(--chart-1)", // Nord8
          2: "var(--chart-2)", // Nord7
          3: "var(--chart-3)", // Nord14
          4: "var(--chart-4)", // Nord13
          5: "var(--chart-5)", // Nord15
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-boarder)",
          ring: "var(--sidebar-ring)",
        },
      },
      radius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "calc(var(--radius-sm) - 4px)",
      },
      boxShadow: {
        neumorph:
          "0 2px 6px rgba(39,44,54,0.4), 0 -2px 6px rgba(79,86,102,1), 2px 0 6px rgba(39,44,54,1), -2px 0 6px rgba(79,86,102,0.5)",
        "neumorph-insert":
          "inset 0 2px 5px rgba(39,44,54,0.35), inset 0 -2px 5px rgba(79,86,102,.25), inset 2px 0 5px rgba(39,44,54,0.3), inset -2px 0 5px rgba(79,86,102,0.2)",
        "neumorph-sm":
          "0 1px 3px rgba(39,44,54,0.35), 0 -1px 3px rgba(79,86,102,0.1), 1px 0 3px rgba(39,44,54,1), -1px 0 3px rgba(79,86,102,0.2)",
      },
    },
  },
  plugins: ["tw-animate-css"],
};
