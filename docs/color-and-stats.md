# Using simple-statistics and the color palette to render nodes

This document explains how we compute and map node centrality scores to sizes and colors using:
- simple-statistics for numeric summarization and normalization, and
- the project's color-palette utilities (KEPLER_COLOR_PALETTES and colorPaletteToColorRange) to build color scales.

## High level steps

1. Collect centrality scores from your node data (e.g., degree or eigenvector scores).
2. Use simple-statistics to compute normalization parameters (min, max, quantiles or z-scores).
3. Select a palette from `KEPLER_COLOR_PALETTES` and produce a color range via `colorPaletteToColorRange`.
4. Create a color scale (e.g., with `chroma.scale(...)`) using the color range.
5. Map each node's normalized score to:
   - a fill color via the color scale, and
   - a radius via a size mapping (linear or non-linear).
6. Apply color and radius when rendering/updating D3 nodes.

## Why simple-statistics?

`simple-statistics` provides stable helpers for:
- min/max, mean, standard deviation,
- quantiles (useful to avoid outlier-driven ranges),
- z-score normalization or percentile normalization.

Using quantiles or z-scores makes the visualization robust to outliers.

## Palette selection

The repository exposes `KEPLER_COLOR_PALETTES` and `colorPaletteToColorRange(...)`. Use a sequential palette for continuous centrality scores. Example approach:
- pick a palette (e.g., `"Viridis"`),
- create a color range with `steps = 7`,
- build a chroma color scale and set domain = [minScore, maxScore].

## Example TypeScript (concise)

The example below shows the mapping logic you can reuse in `GraphView` when preparing nodes for D3 rendering.

```ts
// filepath: /Users/wluo/Projects/cursor-projects/obsidian-graph-analysis/docs/color-and-stats.md
// Example: map centrality scores -> color & size

import ss from 'simple-statistics';
import chroma from 'chroma-js';
import { KEPLER_COLOR_PALETTES, colorPaletteToColorRange } from '../src/utils/color-palette';
// types
type Node = { id: string; name: string; centralityScore?: number };

// 1) collect scores
const nodes: Node[] = /* your nodes with centralityScore populated */;
const scores = nodes.map(n => (n.centralityScore ?? 0));

// 2) compute robust domain (use quantiles to limit outlier effect)
const min = ss.min(scores);
const max = ss.max(scores);
// optional: use 1st and 99th percentiles to clamp
const q1 = ss.quantileSorted(scores.slice().sort((a,b)=>a-b), 0.01);
const q99 = ss.quantileSorted(scores.slice().sort((a,b)=>a-b), 0.99);
const domainMin = Math.max(min, q1);
const domainMax = Math.min(max, q99);

// guard against degenerate domain
const domain = domainMax > domainMin ? [domainMin, domainMax] : [min, min + 1];

// 3) pick a sequential palette (example: Viridis)
const palette = KEPLER_COLOR_PALETTES.find(p => p.name === 'Viridis' && p.type === 'sequential');
// fallback
const chosen = palette ?? KEPLER_COLOR_PALETTES.find(p => p.type === 'sequential')!;

// 4) build a color range (choose steps)
const miniRange = colorPaletteToColorRange(chosen, { steps: 7, reversed: false });

// 5) build chroma scale from the palette colors and set domain
const colorScale = chroma.scale(miniRange.colors).domain(domain);

// 6) create a normalized size mapping (linear or power)
function scoreToRadius(score: number, nodesCount: number) {
  // example: normalize to [6, 24], exaggerate small differences with sqrt
  const [dMin, dMax] = domain;
  const clamp = Math.min(dMax, Math.max(dMin, score));
  const t = (clamp - dMin) / (dMax - dMin || 1);
  // adapt scale by node count to avoid too-small circles in dense graphs
  const baseMin = 6;
  const baseMax = Math.max(12, Math.min(40, 12 + Math.log10(Math.max(10, nodesCount)) * 6));
  // smooth easing
  const eased = Math.sqrt(t);
  return baseMin + eased * (baseMax - baseMin);
}

// 7) apply when rendering nodes in D3
// (inside your update/join code)
nodes.forEach(n => {
  const score = n.centralityScore ?? 0;
  const fill = colorScale(score).hex(); // e.g. "#443a83"
  const r = scoreToRadius(score, nodes.length);
  // set attributes on circle element:
  // d3selection.attr('fill', fill).attr('r', r)
  // and for labels use contrasting color if needed
});
```

## Notes and tips

- If your graph contains many nodes, consider using percentile normalization (e.g., map 5th..95th percentile -> domain) to avoid a few high hubs dominating the color/size range.
- Use `colorBlindSafe` flag available on palette objects to warn users in UI if selected palette is not colorblind safe.
- For diverging datasets (positive/negative), prefer a diverging palette and split around zero.
- Keep the color scale domain stable across interactions (e.g., when filtering) so color meaning remains consistent.

This short guide and the example should make it straightforward to map centrality values to visual encodings in the plugin's GraphView.
