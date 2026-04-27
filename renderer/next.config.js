/**
 * Name of code artifact: renderer/next.config.js
 * Brief description: Defines the exported Next.js renderer build configuration for the Nextron application.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required Next.js configuration prolog documentation.
 * Implementation notes: This JavaScript configuration is a 4GL-style build tool artifact and should stay aligned with Next.js and Nextron build expectations.
 */

/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  distDir: process.env.NODE_ENV === "production" ? "../app" : ".next",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {},
  webpack: (config) => {
    return config;
  },
};
