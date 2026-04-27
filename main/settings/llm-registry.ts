/**
 * Git-history contributors: Wesley McDougal; Malek Kchaou
 */

// main/settings/llm-registry.ts
import { SettingsManager } from "./settings-manager";
import { LLMModelSpec } from "./schema";

/**
 * Functionality: normalizeBaseUrl performs the normalize base url workflow used by main/settings/llm-registry.ts.
 * Parameters: url (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call normalizeBaseUrl from the owning module or component when this behavior is required.
 */
function normalizeBaseUrl(url: string) {
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Functionality: validateSpec performs the validate spec workflow used by main/settings/llm-registry.ts.
 * Parameters: spec (LLMModelSpec).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call validateSpec from the owning module or component when this behavior is required.
 */
function validateSpec(spec: LLMModelSpec) {
    if (!spec?.id?.trim()) throw new Error("LLM model id is required");
    if (!spec?.name?.trim()) throw new Error("LLM model name is required");
    if (!spec?.baseUrl?.trim()) throw new Error("LLM baseUrl is required");
    if (!spec?.model?.trim()) throw new Error("LLM model string is required");
    if (!spec?.capabilities) {
        spec.capabilities = { text: true, vision: false, voice: false };
    }
}

/**
 * Functionality: upsertLLMModel performs the upsert llmmodel workflow used by main/settings/llm-registry.ts.
 * Parameters: manager (SettingsManager); spec (LLMModelSpec); setAsDefault (boolean).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call upsertLLMModel from the owning module or component when this behavior is required.
 */
export async function upsertLLMModel(
    manager: SettingsManager,
    spec: LLMModelSpec,
    setAsDefault: boolean = true
) {
    validateSpec(spec);

    const normalized: LLMModelSpec = {
        ...spec,
        baseUrl: normalizeBaseUrl(spec.baseUrl),
        apiKey: spec.apiKey ?? "",
        capabilities: spec.capabilities ?? { text: true, vision: false, voice: false },
    };

    // Store model under llm.models.<id>
    await manager.setGlobal(`llm.models.${normalized.id}`, normalized);

    // Optionally set as default
    if (setAsDefault) {
        await manager.setGlobal("llm.defaultModelId", normalized.id);
    }
}

/**
 * Functionality: listLLMModels performs the list llmmodels workflow used by main/settings/llm-registry.ts.
 * Parameters: manager (SettingsManager).
 * Returns: Returns LLMModelSpec[].
 * Usage: Call listLLMModels from the owning module or component when this behavior is required.
 */
export function listLLMModels(manager: SettingsManager): LLMModelSpec[] {
    const models = manager.getGlobal("llm.models") as Record<string, LLMModelSpec> | undefined;
    return Object.values(models ?? {});
}

/**
 * Functionality: getDefaultLLMModel performs the get default llmmodel workflow used by main/settings/llm-registry.ts.
 * Parameters: manager (SettingsManager).
 * Returns: Returns LLMModelSpec | null.
 * Usage: Call getDefaultLLMModel from the owning module or component when this behavior is required.
 */
export function getDefaultLLMModel(manager: SettingsManager): LLMModelSpec | null {
    const defId = manager.getGlobal("llm.defaultModelId") as string | null;
    if (!defId) return null;

    const models = manager.getGlobal("llm.models") as Record<string, LLMModelSpec> | undefined;
    return (models && models[defId]) ? models[defId] : null;
}

/**
 * Functionality: deleteLLMModel performs the delete llmmodel workflow used by main/settings/llm-registry.ts.
 * Parameters: manager (SettingsManager); modelId (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call deleteLLMModel from the owning module or component when this behavior is required.
 */
export async function deleteLLMModel(manager: SettingsManager, modelId: string) {
    // Remove override (defaults are empty so this effectively deletes)
    await manager.resetGlobal(`llm.models.${modelId}`);

    // If it was the default, pick another or null
    const defId = manager.getGlobal("llm.defaultModelId") as string | null;
    if (defId === modelId) {
        const models = manager.getGlobal("llm.models") as Record<string, LLMModelSpec> | undefined;
        const remainingIds = Object.keys(models ?? {});
        await manager.setGlobal("llm.defaultModelId", remainingIds.length ? remainingIds[0] : null);
    }
}