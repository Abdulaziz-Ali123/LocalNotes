/**
 * File: renderer/lib/extractJson.ts
 * Purpose: Robust JSON extraction from LLM responses.
 * Handles markdown fences, thinking tags, brace-matched extraction,
 * and truncated responses.
 */

/**
 * Extracts the first complete JSON object from an LLM response string.
 * Handles common artifacts: markdown fences, <think> blocks, trailing prose.
 * If the JSON is truncated (unmatched braces), it attempts to repair it
 * by closing open brackets and braces.
 */
export function extractJsonFromLLMResponse(raw: string): any {
  let text = raw;

  // 1. Strip <think>...</think> blocks (reasoning models)
  const thinkRe = /<think>[\s\S]*?<\/think>/gi;
  text = text.replace(thinkRe, "").trim();

  // 2. Strip markdown code fences
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // 3. Find the first '{' and brace-match to find the closing '}'
  const startIdx = text.indexOf("{");
  if (startIdx === -1) {
    throw new Error("No JSON object found in LLM response.");
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;
  const openStack: string[] = []; // track open brackets/braces for repair

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") { depth++; openStack.push("{"); }
    else if (ch === "[") { openStack.push("["); }
    else if (ch === "}") {
      depth--;
      if (openStack.length && openStack[openStack.length - 1] === "{") openStack.pop();
      if (depth === 0) {
        endIdx = i;
        break;
      }
    } else if (ch === "]") {
      if (openStack.length && openStack[openStack.length - 1] === "[") openStack.pop();
    }
  }

  // If braces matched perfectly, parse and return
  if (endIdx !== -1) {
    const jsonStr = text.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  }

  // --- Truncated response: try to repair ---
  console.warn("[extractJson] JSON appears truncated. Attempting repair...");

  let partial = text.substring(startIdx);

  // If we're inside a string, close it
  if (inString) {
    partial += '"';
  }

  // Remove any trailing comma or colon (invalid trailing chars)
  partial = partial.replace(/[,:\s]+$/, "");

  // Close any open brackets/braces in reverse order
  for (let i = openStack.length - 1; i >= 0; i--) {
    partial += openStack[i] === "[" ? "]" : "}";
  }

  try {
    return JSON.parse(partial);
  } catch (repairErr) {
    // Last resort: try an aggressive cleanup
    // Remove the last incomplete item in an array (common with truncated responses)
    const lastComma = partial.lastIndexOf(",");
    if (lastComma !== -1) {
      const trimmed = partial.substring(0, lastComma);
      // Re-close brackets
      let attempt = trimmed;
      let opens = 0;
      let closes = 0;
      let bOpens = 0;
      let bCloses = 0;
      for (const c of attempt) {
        if (c === "{") opens++;
        if (c === "}") closes++;
        if (c === "[") bOpens++;
        if (c === "]") bCloses++;
      }
      for (let i = 0; i < bOpens - bCloses; i++) attempt += "]";
      for (let i = 0; i < opens - closes; i++) attempt += "}";

      try {
        return JSON.parse(attempt);
      } catch {
        // give up
      }
    }

    throw new Error(
      "Could not parse LLM response as JSON (response may be truncated). " +
      "Try generating fewer questions or using a model with higher token limits."
    );
  }
}
