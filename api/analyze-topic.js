// Vercel Serverless Function: /api/analyze-topic
// Uses Gemini or Ollama (via env vars) to analyze topic evolution

export const config = {
  maxDuration: 60, // Allow up to 60s for LLM responses
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { topic, papers } = req.body;
    if (!topic || !Array.isArray(papers)) {
      return res.status(400).json({ error: "Invalid request. 'topic' and 'papers' array required." });
    }

    const paperSummaries = papers
      .map(
        (p, idx) =>
          `Paper ${idx + 1}:\nTitle: "${p.title}"\nDate: ${p.date}\nCategories: ${Array.isArray(p.categories) ? p.categories.join(", ") : p.categories}\nMethod / Focus: ${p.method || p.primaryContribution || "N/A"}\nAbstract: ${p.abstract}`
      )
      .join("\n\n---\n\n");

    const systemInstruction =
      "You are an expert computer science research analyst specializing in AI, Machine Learning, and arXiv literature. You explain technical method evolutions with sharp analytical clarity, contrasting older baseline methods against newer state-of-the-art breakthroughs.";

    const prompt = `${systemInstruction}\n\nYou are a world-class AI/ML research scientist analyzing the chronological development of "${topic}".\n\nHere is a list of research papers ordered by date:\n${paperSummaries}\n\nPlease provide an in-depth, rigorous, yet accessible comparative analysis of this topic's evolution:\n1. **The Starting Challenge**: What core limitation or bottleneck initially sparked work on this topic?\n2. **Chronological Method Progression (Method X vs Method Y)**:\n   - Identify the key methods or architectures proposed chronologically.\n   - For consecutive or competing papers, clearly explain *why Method Y is superior or fundamentally different from Method X* (e.g., IO complexity, quadratic vs linear attention memory, paging overhead, cache compression loss, latency vs throughput).\n   - What tradeoffs were made (e.g., memory vs accuracy, compute vs latency)?\n3. **Current State-of-the-Art (SOTA)**: Where does this topic stand today based on the latest paper?\n4. **Key Open Questions**: What remains unsolved or represents the next frontier?\n\nFormat your response in clean Markdown with clear headings and bullet points.`;

    // Try Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: "GEMINI_API_KEY not configured. Set it in Vercel environment variables.",
      });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const analysis = response.text || "No analysis could be generated.";
    res.json({ topic, analysis });
  } catch (error) {
    console.error("Error in /api/analyze-topic:", error);
    res.status(500).json({ error: error.message || "Failed to analyze topic evolution." });
  }
}
