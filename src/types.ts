export interface Paper {
  id: string;
  arxivId?: string;
  title: string;
  authors: string[];
  date: string; // YYYY-MM-DD
  categories: string[];
  primaryCategory: string;
  abstract: string;
  method: string;
  improvesUpon?: string;
  keyInnovation?: string;
  metricsOrGains?: string;
  citationsCount?: number;
  url?: string;
}

export interface TopicDevelopment {
  topic: string;
  paperCount: number;
  timeline: {
    paper: Paper;
    stepNumber: number;
    deltaVsPrevious?: string;
    isMilestone?: boolean;
  }[];
  overview?: string;
}

export interface TopicNewsItem {
  title: string;
  source: string;
  date: string;
  snippet: string;
  url: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "paper" | "category";
  categoryGroup?: string;
  categories?: string[];
  radius: number;
  color: string;
  paperCount?: number;
  paperRef?: Paper;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  type: "paper-category" | "paper-paper";
}

export interface NetworkFilter {
  searchQuery: string;
  selectedCategories: string[];
  viewMode: "bipartite" | "similarity";
  yearRange: [number, number];
  minSharedCategories: number;
}
