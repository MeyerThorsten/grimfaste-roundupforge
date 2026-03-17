"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ExtensionSlotProps {
  slot: string;
  fallback?: ReactNode;
  props?: Record<string, unknown>;
}

interface SlotComponent {
  key: string;
  Component: React.ComponentType<Record<string, unknown>>;
}

/**
 * Renders all plugin components registered for a given slot.
 * If no plugins provide components for the slot, renders the fallback (or nothing).
 *
 * Usage in any page:
 *   <ExtensionSlot slot="home-top" />
 *   <ExtensionSlot slot="project-detail-sidebar" props={{ projectId }} />
 */
export default function ExtensionSlot({ slot, fallback, props = {} }: ExtensionSlotProps) {
  const [components, setComponents] = useState<SlotComponent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadSlotComponents() {
      try {
        const registry = await import("@/lib/plugins/registry");
        const extensionPoints = registry.getExtensionPoints(slot);

        const loaded: SlotComponent[] = [];
        for (const ep of extensionPoints) {
          try {
            const mod = await import(/* webpackIgnore: true */ ep.componentPath);
            loaded.push({
              key: ep.componentPath,
              Component: mod.default,
            });
          } catch {
            console.warn(`Plugin component failed to load: ${ep.componentPath}`);
          }
        }

        setComponents(loaded);
      } catch {
        // No plugins available
      }
      setLoaded(true);
    }

    loadSlotComponents();
  }, [slot]);

  if (!loaded) return null;
  if (components.length === 0) return <>{fallback}</>;

  return (
    <>
      {components.map(({ key, Component }) => (
        <Component key={key} {...props} />
      ))}
    </>
  );
}
