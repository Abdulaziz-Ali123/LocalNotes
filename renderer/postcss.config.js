/**
 * Name of code artifact: renderer/postcss.config.js
 * Brief description: Provides source code for the LocalNotes Electron and Next.js application.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

module.exports = {
  plugins: {
    tailwindcss: {
      config: "./tailwind.config.js",
    },
    autoprefixer: {},
  },
};
