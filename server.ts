import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "10mb" }));

// ---------------------------------------------------------------------------
// SQLite Database Connection
// ---------------------------------------------------------------------------
function getDatabase(): Database.Database | null {
  const dbPath = process.env.DB_PATH;
  if (!dbPath) {
    console.warn("DB_PATH not set in .env — database endpoints will return empty results.");
    return null;
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    db.pragma("journal_mode = WAL");
    return db;
  } catch (err: any) {
    console.error("Failed to open database:", err.message);
    return null;
  }
}

// Helper: Parse a JSON-array string like '["A", "B"]' into string[], fallback to []
function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Might be comma-separated
    return raw
      .replace(/[\[\]"]/g, "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
}

// Helper: Transform a DB row into the frontend Paper shape
function transformPaper(row: any): any {
  const arxivCategories = parseJsonArray(row.arxiv_categories);
  const aiKeywords = parseJsonArray(row.ai_keywords);

  // Merge arxiv_categories and ai_keywords for rich categorization
  // Use arxiv_categories as primary, add unique ai_keywords
  const allCategories = [...arxivCategories];
  for (const kw of aiKeywords) {
    if (!allCategories.some((c) => c.toLowerCase() === kw.toLowerCase())) {
      allCategories.push(kw);
    }
  }
  // If still empty, use a fallback
  const categories = allCategories.length > 0 ? allCategories : ["Artificial Intelligence"];

  // Parse authors from comma-separated string
  const authors = row.authors
    ? row.authors
        .split(",")
        .map((a: string) => a.trim())
        .filter(Boolean)
    : ["Unknown"];

  // Parse organization JSON if present
  let orgName: string | undefined;
  if (row.organization) {
    try {
      const org = JSON.parse(row.organization);
      orgName = org.fullname || org.name;
    } catch {
      orgName = undefined;
    }
  }

  // Parse date to YYYY-MM-DD
  let dateStr = row.published_date || "";
  if (dateStr.includes("T")) {
    dateStr = dateStr.split("T")[0];
  }

  return {
    id: row.paper_id,
    arxivId: row.paper_id,
    title: row.title || "Untitled Paper",
    authors,
    date: dateStr,
    categories,
    primaryCategory: categories[0],
    abstract: row.abstract || "No abstract available.",
    method: row.proposed_method || "Research contribution",
    improvesUpon: row.stance_desc || undefined,
    keyInnovation: row.core_claim || undefined,
    metricsOrGains: row.core_claim || undefined,
    citationsCount: row.upvotes || 0,
    url: row.source_url || `https://arxiv.org/abs/${row.paper_id}`,
    // Extended fields from the rich DB
    aiSummary: row.ai_summary || undefined,
    githubRepo: row.github_repo || undefined,
    githubStars: row.github_stars || undefined,
    organization: orgName || undefined,
    upvotes: row.upvotes || 0,
    task: row.task || undefined,
    stanceType: row.stance_type || undefined,
    explanation: row.explanation || undefined,
  };
}

// ---------------------------------------------------------------------------
// Database API Endpoints
// ---------------------------------------------------------------------------

// GET /api/papers — All papers from DB, joined with claims
app.get("/api/papers", (_req, res) => {
  const db = getDatabase();
  if (!db) {
    return res.json([]);
  }
  try {
    const rows = db.prepare(`
      SELECT 
        pd.paper_id, pd.title, pd.authors, pd.published_date, pd.abstract,
        pd.arxiv_categories, pd.ai_keywords, pd.ai_summary,
        pd.upvotes, pd.github_repo, pd.github_stars, pd.organization,
        pd.source_url,
        pc.task, pc.core_claim, pc.proposed_method, pc.baseline,
        pc.stance_type, pc.stance_desc
      FROM paper_details pd
      LEFT JOIN paper_claims pc ON pd.paper_id = pc.paper_id
      ORDER BY pd.published_date DESC
    `).all();

    const papers = rows.map(transformPaper);
    res.json(papers);
  } catch (err: any) {
    console.error("Error fetching papers:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// GET /api/papers/:id — Single paper with full details + explanation
app.get("/api/papers/:id", (req, res) => {
  const db = getDatabase();
  if (!db) {
    return res.status(404).json({ error: "Database not available" });
  }
  try {
    const row = db.prepare(`
      SELECT 
        pd.paper_id, pd.title, pd.authors, pd.published_date, pd.abstract,
        pd.arxiv_categories, pd.ai_keywords, pd.ai_summary,
        pd.upvotes, pd.github_repo, pd.github_stars, pd.organization,
        pd.source_url, pd.contents,
        pc.task, pc.core_claim, pc.proposed_method, pc.baseline,
        pc.stance_type, pc.stance_desc,
        ex.explanation
      FROM paper_details pd
      LEFT JOIN paper_claims pc ON pd.paper_id = pc.paper_id
      LEFT JOIN explanations ex ON pd.paper_id = ex.paper_id
      WHERE pd.paper_id = ?
    `).get(req.params.id);

    if (!row) {
      return res.status(404).json({ error: "Paper not found" });
    }

    res.json(transformPaper(row));
  } catch (err: any) {
    console.error("Error fetching paper:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// GET /api/categories — Distinct categories with paper counts
app.get("/api/categories", (_req, res) => {
  const db = getDatabase();
  if (!db) {
    return res.json([]);
  }
  try {
    const rows = db.prepare(`
      SELECT arxiv_categories, ai_keywords FROM paper_details
    `).all() as any[];

    const counts = new Map<string, number>();
    for (const row of rows) {
      const cats = parseJsonArray(row.arxiv_categories);
      const kws = parseJsonArray(row.ai_keywords);
      const all = [...cats, ...kws];
      const seen = new Set<string>();
      for (const c of all) {
        const lc = c.toLowerCase();
        if (!seen.has(lc)) {
          seen.add(lc);
          counts.set(c, (counts.get(c) || 0) + 1);
        }
      }
    }

    const result = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json(result);
  } catch (err: any) {
    console.error("Error fetching categories:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// GET /api/claims — All claims with task clusters
app.get("/api/claims", (_req, res) => {
  const db = getDatabase();
  if (!db) {
    return res.json([]);
  }
  try {
    const rows = db.prepare(`
      SELECT 
        pc.paper_id, pc.task, pc.core_claim, pc.proposed_method,
        pc.baseline, pc.stance_type, pc.stance_desc,
        pd.title, pd.published_date, pd.arxiv_categories, pd.ai_keywords
      FROM paper_claims pc
      JOIN paper_details pd ON pc.paper_id = pd.paper_id
      ORDER BY pd.published_date DESC
    `).all();

    res.json(rows);
  } catch (err: any) {
    console.error("Error fetching claims:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// GET /api/db-stats — Quick stats about the database
app.get("/api/db-stats", (_req, res) => {
  const db = getDatabase();
  if (!db) {
    return res.json({ papers: 0, claims: 0, explanations: 0, available: false });
  }
  try {
    const papersCount = (db.prepare("SELECT COUNT(*) as cnt FROM paper_details").get() as any).cnt;
    const claimsCount = (db.prepare("SELECT COUNT(*) as cnt FROM paper_claims").get() as any).cnt;
    const explanationsCount = (db.prepare("SELECT COUNT(*) as cnt FROM explanations").get() as any).cnt;

    res.json({
      papers: papersCount,
      claims: claimsCount,
      explanations: explanationsCount,
      available: true,
    });
  } catch (err: any) {
    console.error("Error fetching db stats:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ---------------------------------------------------------------------------
// Lazy initialize Gemini AI client
// ---------------------------------------------------------------------------
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint: Topic Chronological Evolution Analysis using Gemini or Ollama
app.post("/api/analyze-topic", async (req, res) => {
  try {
    const { topic, papers } = req.body;
    if (!topic || !Array.isArray(papers)) {
      return res.status(400).json({ error: "Invalid request. 'topic' and 'papers' array required." });
    }

    const paperSummaries = papers.map((p, idx) => 
      `Paper ${idx + 1}:
Title: "${p.title}"
Date: ${p.date}
Categories: ${Array.isArray(p.categories) ? p.categories.join(", ") : p.categories}
Method / Focus: ${p.method || p.primaryContribution || "N/A"}
Abstract: ${p.abstract}`
    ).join("\n\n---\n\n");

    const systemInstruction = "You are an expert computer science research analyst specializing in AI, Machine Learning, and arXiv literature. You explain technical method evolutions with sharp analytical clarity, contrasting older baseline methods against newer state-of-the-art breakthroughs.";
    
    const prompt = `${systemInstruction}\n\nYou are a world-class AI/ML research scientist analyzing the chronological development of "${topic}".

Here is a list of research papers ordered by date:
${paperSummaries}

Please provide an in-depth, rigorous, yet accessible comparative analysis of this topic's evolution:
1. **The Starting Challenge**: What core limitation or bottleneck initially sparked work on this topic?
2. **Chronological Method Progression (Method X vs Method Y)**:
   - Identify the key methods or architectures proposed chronologically.
   - For consecutive or competing papers, clearly explain *why Method Y is superior or fundamentally different from Method X* (e.g., IO complexity, quadratic vs linear attention memory, paging overhead, cache compression loss, latency vs throughput).
   - What tradeoffs were made (e.g., memory vs accuracy, compute vs latency)?
3. **Current State-of-the-Art (SOTA)**: Where does this topic stand today based on the latest paper?
4. **Key Open Questions**: What remains unsolved or represents the next frontier?

Format your response in clean Markdown with clear headings and bullet points.`;

    if (process.env.USE_OLLAMA === "true") {
      const ollamaModel = process.env.OLLAMA_MODEL || "llama3";
      const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
      
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.4
          }
        })
      });

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(`Ollama API error: ${errorMsg}`);
      }

      const data = await response.json();
      return res.json({ topic, analysis: data.response || "No analysis could be generated by Ollama." });
    }

    // Fallback to Gemini
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured in the environment. Please configure it in AI Studio settings.",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const analysis = response.text || "No analysis could be generated.";
    res.json({ topic, analysis });
  } catch (error: any) {
    console.error("Error in /api/analyze-topic:", error);
    res.status(500).json({ error: error.message || "Failed to analyze topic evolution." });
  }
});

// Endpoint: Fetch Latest Research News & Industry Developments on a Topic
app.post("/api/topic-news", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "NEWSDATA_API_KEY is not configured." });
    }
    const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(topic)}&language=en&category=technology,science`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`NewsData API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    const news = results.slice(0, 4).map((item: any) => ({
        title: item.title || "Untitled",
        source: item.source_id || "News Source",
        date: item.pubDate ? item.pubDate.split(" ")[0] : new Date().toISOString().split("T")[0],
        snippet: (item.description || item.content || `Recent development regarding ${topic}`).substring(0, 200) + '...',
        url: item.link || ""
    }));

    // If no results, fallback
    if (news.length === 0) {
      news.push({
        title: `Recent breakthroughs and production optimizations in ${topic}`,
        source: "ArXiv AI Weekly",
        date: new Date().toISOString().split("T")[0],
        snippet: `Active research community focus on improving inference efficiency, hardware acceleration, and memory overhead in modern implementations of ${topic}.`,
        url: `https://arxiv.org/search/?query=${encodeURIComponent(topic)}&searchtype=all`,
      });
    }

    res.json({ topic, news });
  } catch (error: any) {
    console.error("Error in /api/topic-news:", error);
    res.status(500).json({ error: error.message || "Failed to fetch topic news." });
  }
});

// Endpoint: Fetch live arXiv papers directly via public arXiv API
app.get("/api/arxiv/fetch", async (req, res) => {
  try {
    const query = (req.query.q as string) || "cat:cs.AI OR cat:cs.CL OR cat:cs.CV";
    const maxResults = Math.min(Number(req.query.max || 50), 100);
    const arxivUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

    const response = await fetch(arxivUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch from arXiv API" });
    }

    const xml = await response.text();
    // Return the raw XML or parsed summary
    res.json({ rawXml: xml, query });
  } catch (error: any) {
    console.error("Error fetching arXiv papers:", error);
    res.status(500).json({ error: error.message || "Failed to query arXiv" });
  }
});

// Endpoint: Categorize any new paper or abstract using Gemini
app.post("/api/categorize-paper", async (req, res) => {
  try {
    const { title, abstract } = req.body;
    if (!title && !abstract) {
      return res.status(400).json({ error: "Title or abstract required" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        categories: ["Artificial Intelligence", "Machine Learning"],
        method: "Analytical Paper",
        keyTakeaway: "Analysis based on provided abstract.",
      });
    }

    const prompt = `Analyze this research paper:
Title: "${title || ""}"
Abstract: "${abstract || ""}"

Extract:
1. 3 to 6 high-level and granular categories/topics (e.g., "KV Cache", "Large Language Models", "Attention Optimization", "Memory Efficiency", "Computer Vision").
2. The primary novel method or technique proposed (e.g., "Method Y: PagedAttention block table", "Selective State Space Model", "Speculative Drafting").
3. A 1-sentence statement on what previous baseline or method it improves upon.

Return JSON format:
{
  "categories": ["Category 1", "Category 2", ...],
  "method": "Short method name",
  "improvesUpon": "Statement of what it improves upon",
  "keyTakeaway": "1-sentence summary of contribution"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error categorizing paper:", error);
    res.status(500).json({ error: error.message || "Categorization failed" });
  }
});

import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

// Endpoint: RAG Q&A
app.post("/api/rag-qa", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const dbPath = process.env.DB_PATH;
    if (!dbPath) {
      return res.status(500).json({ error: "DB_PATH is not configured" });
    }

    // 1. Run Python script to get top 5 chunks based on embedding similarity
    const scriptPath = path.join(process.cwd(), "rag_search.py");
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${query.replace(/"/g, '\\"')}" "${dbPath}" 5`);
    
    let searchResults;
    try {
      searchResults = JSON.parse(stdout);
    } catch (e) {
      console.error("Failed to parse RAG search output:", stdout);
      console.error("Stderr:", stderr);
      return res.status(500).json({ error: "Vector search failed" });
    }

    if (!searchResults.success || !searchResults.results) {
      return res.status(500).json({ error: searchResults.error || "Search failed" });
    }

    const contextChunks = searchResults.results;

    if (contextChunks.length === 0) {
      return res.json({ answer: "I couldn't find any relevant information in the database to answer your question.", citations: [] });
    }

    // 2. Build Prompt
    const contextText = contextChunks.map((c: any, i: number) => `[Source ${i + 1}] Title: ${c.title}\nContent: ${c.text_content}`).join("\n\n");
    
    const prompt = `You are a helpful research assistant. Answer the following question based ONLY on the provided research paper excerpts.
If the excerpts do not contain the answer, say "I don't have enough information to answer that based on the database."
When you make a claim based on an excerpt, you MUST cite it using the source number in brackets, like [1] or [2].

CONTEXT:
${contextText}

QUESTION:
${query}

ANSWER:`;

    let answer = "";
    const systemInstruction = "You are a research assistant answering questions using retrieved context. Always cite your sources.";

    // 3. Call LLM (Ollama or Gemini)
    if (process.env.USE_OLLAMA === "true") {
      const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1";
      const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
      
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          system: systemInstruction,
          prompt: prompt,
          stream: false,
          options: { temperature: 0.1 }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }
      const data = await response.json();
      answer = data.response;
    } else {
      const ai = getGeminiClient();
      if (!ai) throw new Error("Gemini not configured");
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: { systemInstruction, temperature: 0.1 },
      });
      answer = response.text || "";
    }

    res.json({ answer, citations: contextChunks });
  } catch (error: any) {
    console.error("Error in RAG Q&A:", error);
    res.status(500).json({ error: error.message || "Failed to generate answer" });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
