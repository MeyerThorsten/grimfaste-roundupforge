/**
 * Plugin Registry — discovers and loads plugins from the plugins/ directory.
 *
 * Each plugin exports a default PluginDefinition from its index.ts.
 * Pro features live in plugins/ (gitignored in the public repo).
 * The private pro repo provides the plugins/ directory content.
 */

export interface NavItem {
  label: string;
  href: string;
  order?: number; // lower = further left, default 100
}

export interface ExtensionPoint {
  /** Where to render: "home-top", "home-bottom", "project-detail-sidebar", etc. */
  slot: string;
  /** React component to render (loaded dynamically) */
  componentPath: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  navItems?: NavItem[];
  extensionPoints?: ExtensionPoint[];
}

let cached: PluginDefinition[] | null = null;

export function getPlugins(): PluginDefinition[] {
  if (cached) return cached;

  const result: PluginDefinition[] = [];

  try {
    // Dynamic require of the plugin manifest
    // This file is generated/maintained in the plugins/ directory
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manifest = require("@/plugins/manifest");
    if (Array.isArray(manifest.default)) {
      result.push(...manifest.default);
    } else if (Array.isArray(manifest.plugins)) {
      result.push(...manifest.plugins);
    }
  } catch {
    // No plugins directory or manifest — that's fine, open-source mode
  }

  cached = result;
  return result;
}

export function getNavItems(): NavItem[] {
  return getPlugins()
    .flatMap((p) => p.navItems || [])
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function getExtensionPoints(slot: string): ExtensionPoint[] {
  return getPlugins()
    .flatMap((p) => p.extensionPoints || [])
    .filter((ep) => ep.slot === slot);
}

export function isPluginEnabled(pluginId: string): boolean {
  return getPlugins().some((p) => p.id === pluginId);
}
