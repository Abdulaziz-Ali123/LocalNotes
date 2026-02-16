import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getConfigDirectoryPath } from "../helpers";

let dbInstance: Database.Database | null = null;

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
            WHERE type='table' AND name IN ('directories', 'chunks', 'files')
        `).all();
        console.log("Tables found:", tables);
    } catch (error) {
        console.error("Error verifying tables:", error);
    }
}

export function getDB(): Database.Database {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDB() first.");
    }
    return dbInstance;
}

export function closeDB(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        console.log("Database connection closed");
    }
}