export type ThemePreference = "light" | "dark" | "system";
export function resolveTheme(preference: ThemePreference, systemDark: boolean) {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}
export const themeBootstrap = `try { const owner=localStorage.getItem('kopa-active-owner')||'preview'; const v=localStorage.getItem('kopa-theme:'+owner)||(owner==='preview'?localStorage.getItem('kopa-tools-theme'):null)||'system'; document.documentElement.dataset.theme=v==='dark'||v==='light'?v:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; document.documentElement.style.colorScheme=document.documentElement.dataset.theme; } catch { document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; }`;
