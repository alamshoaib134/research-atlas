// Vercel Serverless Function: /api/rag-qa
// Client-side fuzzy search replacement for the Python RAG pipeline
// Uses Gemini to answer based on matching paper content

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, papers } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Papers are sent from the client (already loaded from static JSON)
    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.json({
        answer: "No papers are loaded to search through. Please load papers first.",
        citations: [],
      });
    }

    // Simple keyword-based relevance scoring
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const scored = papers
      .map((paper) => {
        const searchText = `${paper.title} ${paper.abstract} ${(paper.categories || []).join(" ")} ${paper.method || ""}`.toLowerCase();
        let score = 0;
        for (const term of queryTerms) {
          const count = (searchText.match(new RegExp(term, "gi")) || []).length;
          score += count;
          // Boost title matches
          if (paper.title.toLowerCase().includes(term)) score += 3;
        }
        return { ...paper, score };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant papers matching your query. Try rephrasing or using different keywords.",
        citations: [],
      });
    }

    // Build context from top matches
    const contextText = scored
      .map(
        (c, i) =>
          `[Source ${i + 1}] Title: ${c.title}\nAbstract: ${c.abstract}\nMethod: ${c.method || "N/A"}`
      )
      .join("\n\n");

    const prompt = `You are a helpful research assistant. Answer the following question based ONLY on the provided research paper excerpts.
If the excerpts do not contain the answer, say "I don't have enough information to answer that based on the available papers."
When you make a claim based on an excerpt, you MUST cite it using the source number in brackets, like [1] or [2].

CONTEXT:
${contextText}

QUESTION:
${query}

ANSWER:`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback: return the matched papers without AI synthesis
      return res.json({
        answer: `Here are the most relevant papers I found:\n\n${scored.map((p, i) => `**[${i + 1}] ${p.title}**\n${p.abstract.substring(0, 200)}...`).join("\n\n")}`,
        citations: scored.map((p) => ({
          paper_id: p.id,
          title: p.title,
          text_content: p.abstract.substring(0, 300),
          authors: p.authors,
        })),
      });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a research assistant answering questions using retrieved context. Always cite your sources.",
        temperature: 0.1,
      },
    });

    const answer = response.text || "";
    const citations = scored.map((p) => ({
      paper_id: p.id,
      title: p.title,
      text_content: p.abstract.substring(0, 300),
      authors: p.authors,
    }));

    res.json({ answer, citations });
  } catch (error) {
    console.error("Error in RAG Q&A:", error);
    res.status(500).json({ error: error.message || "Failed to generate answer" });
  }
}
