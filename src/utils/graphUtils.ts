import { Paper, GraphNode, GraphLink } from "../types";

/**
 * Palette tuned for legibility against both light (#f8f7f4) and dark (#0f1117)
 * backgrounds. Colors are chosen for perceptual distinctness, not decoration.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  "KV Cache":               "#c1292e",
  "Attention Optimization": "#1d3557",
  "Speculative Decoding":   "#e07a2f",
  "Reasoning":              "#2d6a4f",
  "State Space Models":     "#9b2226",
  "Vision Transformers":    "#2563eb",
  "Mixture of Experts":     "#7c3aed",
  "Quantization":           "#0d9488",
  "Diffusion Models":       "#7e22ce",
  "Alignment":              "#b45309",
  "Computer Vision":        "#0284c7",
  "Large Language Models":  "#1e40af",
  "Inference Efficiency":   "#0369a1",
  "Robotics & Embodied AI": "#dc2626",
  "Graph Neural Networks":  "#16a34a",
  "Default":                "#6b7280",
};

export function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) {
      return color;
    }
  }
  return CATEGORY_COLORS.Default;
}

export function buildBipartiteGraph(
  papers: Paper[],
  activeCategories: Set<string>,
  searchQuery: string
): { nodes: GraphNode[]; links: GraphLink[] } {
  const filteredPapers = papers.filter((p) => {
    const matchesCategory =
      activeCategories.size === 0 ||
      p.categories.some((c) => activeCategories.has(c));
    if (!matchesCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchAuthor = p.authors.some((a) => a.toLowerCase().includes(q));
      const matchCat = p.categories.some((c) => c.toLowerCase().includes(q));
      const matchMethod = p.method.toLowerCase().includes(q);
      if (!matchTitle && !matchAuthor && !matchCat && !matchMethod) return false;
    }

    return true;
  });

  const categoryCounts = new Map<string, number>();
  filteredPapers.forEach((p) => {
    p.categories.forEach((cat) => {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });
  });

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  // Add Category nodes (only those present in filtered papers)
  categoryCounts.forEach((count, cat) => {
    nodes.push({
      id: `cat-${cat}`,
      label: cat,
      type: "category",
      categoryGroup: cat,
      radius: Math.min(28, Math.max(14, 12 + Math.sqrt(count) * 3.5)),
      color: getCategoryColor(cat),
      paperCount: count,
    });
  });

  // Add Paper nodes and links to categories
  filteredPapers.forEach((p) => {
    const primaryColor = getCategoryColor(p.primaryCategory || p.categories[0] || "");
    nodes.push({
      id: `paper-${p.id}`,
      label: p.title,
      type: "paper",
      categoryGroup: p.primaryCategory || p.categories[0],
      categories: p.categories,
      radius: 8,
      color: primaryColor,
      paperRef: p,
    });

    p.categories.forEach((cat) => {
      if (categoryCounts.has(cat)) {
        links.push({
          source: `paper-${p.id}`,
          target: `cat-${cat}`,
          weight: 1,
          type: "paper-category",
        });
      }
    });
  });

  return { nodes, links };
}

export function buildPaperSimilarityGraph(
  papers: Paper[],
  activeCategories: Set<string>,
  searchQuery: string,
  minSharedCategories: number = 2
): { nodes: GraphNode[]; links: GraphLink[] } {
  const filteredPapers = papers.filter((p) => {
    const matchesCategory =
      activeCategories.size === 0 ||
      p.categories.some((c) => activeCategories.has(c));
    if (!matchesCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchCat = p.categories.some((c) => c.toLowerCase().includes(q));
      if (!matchTitle && !matchCat) return false;
    }

    return true;
  });

  const nodes: GraphNode[] = filteredPapers.map((p) => ({
    id: `paper-${p.id}`,
    label: p.title,
    type: "paper",
    categoryGroup: p.primaryCategory || p.categories[0],
    categories: p.categories,
    radius: 9,
    color: getCategoryColor(p.primaryCategory || p.categories[0] || ""),
    paperRef: p,
  }));

  const links: GraphLink[] = [];

  for (let i = 0; i < filteredPapers.length; i++) {
    for (let j = i + 1; j < filteredPapers.length; j++) {
      const p1 = filteredPapers[i];
      const p2 = filteredPapers[j];
      const shared = p1.categories.filter((c) => p2.categories.includes(c));

      const sameTopic = p1.primaryCategory === p2.primaryCategory;
      if (shared.length >= minSharedCategories || (sameTopic && shared.length >= 1)) {
        links.push({
          source: `paper-${p1.id}`,
          target: `paper-${p2.id}`,
          weight: shared.length,
          type: "paper-paper",
        });
      }
    }
  }

  return { nodes, links };
}
