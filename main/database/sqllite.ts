/**
 * Name of code artifact: main/database/sqllite.ts
 * Brief description: Implements SQLite persistence for LocalNotes metadata, indexing records, and vector-search state.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import Database from "better-sqlite3";
import { load } from "sqlite-vec";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getConfigDirectoryPath } from "../helpers";

let dbInstance: Database.Database | null = null;

/**
 * Functionality: initializeDB performs the initialize db workflow used by main/database/sqllite.ts.
 * Parameters: None.
 * Returns: Returns void.
 * Usage: Call initializeDB from the owning module or component when this behavior is required.
 */
export function initializeDB(): void {
    const databasePath = path.join(getConfigDirectoryPath(), "database", "LocalNotes.db");
    const schemaPath = app.isPackaged
        ? path.join(process.resourcesPath, "assets", "schema.sql")
        : path.join(__dirname, "..", "renderer", "public", "assets", "schema.sql");

    console.log("Initializing database...");
    console.log("Database path:", databasePath);
    console.log("Schema path:", schemaPath);

    // Create directory if it doesn't exist
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log("Created database directory");
    }

    // Check if database needs initialization
    const isNewDatabase = !fs.existsSync(databasePath);

    // Connect to database
    dbInstance = new Database(databasePath);
    dbInstance.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
    `);

    load(dbInstance); //this enables vec0

    console.log("Database connected");

    // Initialize schema if new database
    if (isNewDatabase) {
        try {
            console.log("New database detected, loading schema...");
            const schema = fs.readFileSync(schemaPath, "utf8");
            dbInstance.exec(schema);
            console.log("✓ Database schema initialized successfully");
        } catch (error) {
            console.error("✗ Failed to initialize schema:", error);
            throw error;
        }
    } else {
        console.log("✓ Existing database loaded");
    }

    // Verify tables exist
    try {
        const tables = dbInstance.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table'
        `).all();
        console.log("Tables found:", tables);
    } catch (error) {
        console.error("Error verifying tables:", error);
    }
}

/**
 * Functionality: getDB performs the get db workflow used by main/database/sqllite.ts.
 * Parameters: None.
 * Returns: Returns Database.Database.
 * Usage: Call getDB from the owning module or component when this behavior is required.
 */
export function getDB(): Database.Database {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDB() first.");
    }
    return dbInstance;
}

/**
 * Functionality: closeDB performs the close db workflow used by main/database/sqllite.ts.
 * Parameters: None.
 * Returns: Returns void.
 * Usage: Call closeDB from the owning module or component when this behavior is required.
 */
export function closeDB(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        console.log("Database connection closed");
    }
}