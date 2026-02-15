export function validateFileName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
    const name = raw.trim();

    if (!name) return { ok: false, error: "File name cannot be empty." };
    if (name === "." || name === "..") return { ok: false, error: "Invalid file name." };

    // Cross-platform: "/" is never allowed in a filename
    if (name.includes("/")) return { ok: false, error: "File name cannot contain '/'." };

    // Windows-invalid characters (safe to enforce everywhere)
    if (/[<>:"\\|?*]/.test(name)) return { ok: false, error: "File name contains invalid characters." };

    // Windows: cannot end in dot/space (safe to enforce everywhere)
    if (name.endsWith(".") || name.endsWith(" ")) {
        return { ok: false, error: "File name cannot end with a dot or space." };
    }

    // Windows reserved device names (safe to enforce everywhere)
    const upper = name.toUpperCase();
    const reserved = new Set([
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ]);

    // Also reject "CON.txt" style
    const base = upper.split(".")[0];
    if (reserved.has(base)) return { ok: false, error: "This file name is reserved by the system." };

    return { ok: true, name };
}