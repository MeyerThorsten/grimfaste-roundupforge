"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/plugins/registry";

const coreLinks = [
  { label: "Home", href: "/", order: 0 },
  { label: "Profiles", href: "/profiles", order: 10 },
  { label: "Settings", href: "/settings", order: 20 },
];

export default function NavLinks() {
  const [pluginLinks, setPluginLinks] = useState<NavItem[]>([]);

  useEffect(() => {
    import("@/lib/plugins/registry")
      .then((mod) => setPluginLinks(mod.getNavItems()))
      .catch(() => {});
  }, []);

  const allLinks = [...coreLinks, ...pluginLinks].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  );

  return (
    <div className="flex gap-4 text-sm">
      {allLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-gray-600 hover:text-gray-900"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
