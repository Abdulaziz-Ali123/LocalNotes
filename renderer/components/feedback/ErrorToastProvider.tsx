/**
 * File: renderer/components/feedback/ErrorToastProvider.tsx
 * Purpose: Provides a lightweight global error toast system for the renderer.
 * Summary of what was added/changed:
 * - Adds a small provider-based toast system for user-facing error messages.
 * - Exposes a useErrorToast hook for showing short-lived error toasts.
 * - Avoids introducing an additional dependency for notifications.
 * Author: Malek Kchaou
 * Date: 2026-03-28
 * Housekeeping note:
 * - This is intentionally limited to error toasts for now to keep the implementation low-overhead.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

/**
 * Represents a single error toast item rendered by the provider.
 */
interface ErrorToastItem {
    id: string;
    message: string;
}

/**
 * Public context contract exposed to renderer components.
 */
interface ErrorToastContextValue {
    showErrorToast: (message: string) => void;
}

const ErrorToastContext = createContext<ErrorToastContextValue | null>(null);

/**
 * Provides global error-toast state and renders the active toast list.
 * The provider is meant to be mounted once at the top of the renderer tree.
 */
export function ErrorToastProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [toasts, setToasts] = useState<ErrorToastItem[]>([]);

    /**
     * Adds a new error toast and removes it automatically after a short delay.
     * This keeps the UI simple and avoids requiring manual dismissal for now.
     */
    const showErrorToast = useCallback((message: string) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        setToasts((current) => [...current, { id, message }]);

        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4000);
    }, []);

    /**
     * Memoize the public context value so consumers do not re-render unnecessarily.
     */
    const value = useMemo(
        () => ({
            showErrorToast,
        }),
        [showErrorToast]
    );

    return (
        <ErrorToastContext.Provider value={value}>
            {children}

            {/* 
        Fixed-position toast container rendered once for the entire app.
        Pointer events are disabled so it does not interfere with the editor UI.
      */}
            <div
                style={{
                    position: "fixed",
                    top: 16,
                    right: 16,
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    pointerEvents: "none",
                }}
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        style={{
                            minWidth: 240,
                            maxWidth: 360,
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: "#b91c1c",
                            color: "#ffffff",
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
                            fontSize: 14,
                            lineHeight: 1.4,
                        }}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ErrorToastContext.Provider>
    );
}

/**
 * Hook used by renderer components to show user-facing error toasts.
 * It must be called from within the mounted provider tree.
 */
export function useErrorToast(): ErrorToastContextValue {
    const context = useContext(ErrorToastContext);

    if (!context) {
        throw new Error("useErrorToast must be used within ErrorToastProvider");
    }

    return context;
}