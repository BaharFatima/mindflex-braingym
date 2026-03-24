export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const { text } = req.body;

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: "No text provided" });
  }

  const wordCount = text.trim().split(/\s+/).length;

  const prompt = `You are a study assistant. Analyze the following document and return a JSON object ONLY — no markdown, no backticks, no explanation.

The JSON must have exactly this structure:
{
  "flashcards": [
    { "term": "short label", "front": "question or concept", "back": "answer or explanation" }
  ],
  "keyPoints": [
    { "title": "point title", "description": "brief explanation" }
  ],
  "glossary": [
    { "term": "word or phrase", "definition": "clear definition" }
  ],
  "summary": "A 3-5 sentence plain-text summary of the document."
}

Rules:
- Generate 8-15 flashcards
- Generate 5-8 key points
- Generate 6-12 glossary terms
- Return ONLY valid JSON, nothing else

Document:
"""
${text.slice(0, 12000)}
"""`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    const raw = await response.json();

    // Extract the text content from Gemini's response
    const aiText = raw?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.error("Gemini returned no content:", JSON.stringify(raw));
      return res.status(500).json({ error: "AI returned no content" });
    }

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const cleaned = aiText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI JSON:", cleaned);
      return res.status(500).json({ error: "AI response was not valid JSON" });
    }

    // Return the structured data the frontend expects, including wordCount
    res.status(200).json({
      wordCount,
      flashcards: parsed.flashcards ?? [],
      keyPoints:  parsed.keyPoints  ?? [],
      glossary:   parsed.glossary   ?? [],
      summary:    parsed.summary    ?? "No summary available."
    });

  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Failed to connect to StudyLens engine" });
  }
}
