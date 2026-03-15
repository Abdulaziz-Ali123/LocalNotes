// main/settings/llm-registry.ts
import { SettingsManager } from "./settings-manager";
import { LLMModelSpec } from "./schema";

function normalizeBaseUrl(url: string) {
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

function validateSpec(spec: LLMModelSpec) {
    if (!spec?.id?.trim()) throw new Error("LLM model id is required");
    if (!spec?.name?.trim()) throw new Error("LLM model name is required");
    if (!spec?.baseUrl?.trim()) throw new Error("LLM baseUrl is required");
    if (!spec?.model?.trim()) throw new Error("LLM model string is required");
    if (!spec?.capabilities) {
        spec.capabilities = { text: true, vision: false, voice: false };
    }
}

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

export function listLLMModels(manager: SettingsManager): LLMModelSpec[] {
    const models = manager.getGlobal("llm.models") as Record<string, LLMModelSpec> | undefined;
    return Object.values(models ?? {});
}

export function getDefaultLLMModel(manager: SettingsManager): LLMModelSpec | null {
    const defId = manager.getGlobal("llm.defaultModelId") as string | null;
    if (!defId) return null;

    const models = manager.getGlobal("llm.models") as Record<string, LLMModelSpec> | undefined;
    return (models && models[defId]) ? models[defId] : null;
}

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