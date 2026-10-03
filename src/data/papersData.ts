import { Paper } from "../types";

/**
 * Minimal fallback papers — used ONLY when the database API is unreachable.
 * The real data comes from papers.db via GET /api/papers.
 */
export const FALLBACK_PAPERS: Paper[] = [
  {
    id: "fallback-1",
    arxivId: "2305.13245",
    title: "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints",
    authors: ["Joshua Ainslie", "James Lee-Thorp", "Michiel de Jong"],
    date: "2023-05-22",
    categories: ["KV Cache", "Large Language Models", "Attention Optimization"],
    primaryCategory: "KV Cache",
    method: "Grouped-Query Attention (GQA)",
    improvesUpon: "Recovers quality lost by Multi-Query Attention while preserving speed.",
    keyInnovation: "Interpolates between MHA and MQA with grouped key-value heads.",
    abstract: "Multi-query attention speeds up decoder inference but causes quality degradation. Grouped-Query Attention uses an intermediate number of key-value heads to achieve quality close to Multi-Head Attention with comparable speed.",
    url: "https://arxiv.org/abs/2305.13245",
  },
  {
    id: "fallback-2",
    arxivId: "2205.14135",
    title: "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness",
    authors: ["Tri Dao", "Daniel Y. Fu", "Stefano Ermon", "Christopher Ré"],
    date: "2022-05-27",
    categories: ["Attention Optimization", "Inference Efficiency", "GPU Systems"],
    primaryCategory: "Attention Optimization",
    method: "IO-Aware Tiling & Online Softmax",
    improvesUpon: "Standard attention requires O(N²) HBM memory for the attention matrix.",
    keyInnovation: "Tiles computation between SRAM and HBM, never materializing the full N×N matrix.",
    abstract: "FlashAttention accounts for reads and writes between GPU SRAM and HBM, achieving 2-4x speedup and linear memory.",
    url: "https://arxiv.org/abs/2205.14135",
  },
  {
    id: "fallback-3",
    arxivId: "2305.09515",
    title: "Tree of Thoughts: Deliberate Problem Solving with Large Language Models",
    authors: ["Shunyu Yao", "Dian Yu", "Jeffrey Zhao", "Karthik Narasimhan"],
    date: "2023-05-17",
    categories: ["Reasoning", "Large Language Models", "Artificial Intelligence"],
    primaryCategory: "Reasoning",
    method: "Tree of Thoughts (ToT)",
    improvesUpon: "Chain-of-thought prompting is limited to a single reasoning path.",
    keyInnovation: "Explores multiple reasoning paths with lookahead and backtracking.",
    abstract: "Tree of Thoughts generalizes over Chain of Thought prompting, enabling exploration of coherent text units as intermediate steps toward problem solving.",
    url: "https://arxiv.org/abs/2305.09515",
  },
];

// Re-export for backward compatibility with any code that still imports ALL_PAPERS
export const ALL_PAPERS = FALLBACK_PAPERS;
