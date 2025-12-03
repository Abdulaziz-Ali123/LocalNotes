// renderer/components/ThemeSelector.tsx
import { useTheme, type ThemeType } from "@/renderer/lib/theme";

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2 text-sm p-3">
      <h2 className="font-semibold mb-1">Theme</h2>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeType)}
        className="w-full p-2 rounded bg-sidebar text-sidebar-foreground border border-sidebar-border focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
      >
        <option value="nord">Nord (Default)</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="cozy">Cozy</option>
        <option value="darker">Darker</option>
      </select>
    </div>
  );
}
