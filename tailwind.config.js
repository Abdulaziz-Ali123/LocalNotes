/**
 * Name of code artifact: tailwind.config.js
 * Brief description: Defines the root Tailwind CSS configuration used by LocalNotes styling tooling.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required Tailwind configuration prolog documentation.
 * Implementation notes: This JavaScript configuration is a 4GL-style build tool artifact and should stay aligned with Tailwind's expected config shape.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // optional: define default custom properties fallback sizes if you want
    },
  },
  plugins: [],
};
