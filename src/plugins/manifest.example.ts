/**
 * Example plugin manifest.
 *
 * To enable pro features:
 * 1. Copy this file to manifest.ts
 * 2. Add your plugin definitions
 *
 * The manifest is gitignored — your pro plugins stay private.
 */

import type { PluginDefinition } from "@/lib/plugins/registry";

const plugins: PluginDefinition[] = [
  // Example: Article generation plugin
  // {
  //   id: "article-gen",
  //   name: "Article Generator",
  //   version: "1.0.0",
  //   description: "Generate roundup articles from scraped product data",
  //   navItems: [
  //     { label: "Articles", href: "/articles", order: 15 },
  //   ],
  //   extensionPoints: [
  //     {
  //       slot: "project-detail-actions",
  //       componentPath: "@/plugins/article-gen/components/generate-button",
  //     },
  //   ],
  // },
];

export default plugins;
