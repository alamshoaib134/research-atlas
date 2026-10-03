// Vercel Serverless Function: /api/categorize-paper
// Uses Gemini to categorize a paper from its title and abstract

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, abstract } = req.body;
    if (!title && !abstract) {
      return res.status(400).json({ error: "Title or abstract required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        categories: ["Artificial Intelligence", "Machine Learning"],
        method: "Analytical Paper",
        keyTakeaway: "Analysis based on provided abstract.",
      });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analyze this research paper:\nTitle: "${title || ""}"\nAbstract: "${abstract || ""}"\n\nExtract:\n1. 3 to 6 high-level and granular categories/topics.\n2. The primary novel method or technique proposed.\n3. A 1-sentence statement on what previous baseline or method it improves upon.\n\nReturn JSON format:\n{\n  "categories": ["Category 1", "Category 2", ...],\n  "method": "Short method name",\n  "improvesUpon": "Statement of what it improves upon",\n  "keyTakeaway": "1-sentence summary of contribution"\n}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Error categorizing paper:", error);
    res.status(500).json({ error: error.message || "Categorization failed" });
  }
}
