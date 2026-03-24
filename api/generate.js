export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const { text } = req.body;

  const prompt = `You are a study assistant. Analyze the document below and return ONLY a valid JSON object. No markdown, no backticks, no explanation — raw JSON only.

Use this exact structure:
{
  "flashcards": [
    { "term": "Short topic label", "front": "Question?", "back": "Answer." }
  ],
  "keyPoints": ["Key point 1", "Key point 2"],
  "glossary": [
    { "term": "Word", "definition": "Definition." }
  ],
  "summary": "2-3 sentence summary of the document.",
  "wordCount": 500
}

Generate at least 8 flashcards, 5 key points, and 5 glossary terms.

DOCUMENT:
${text.substring(0, 8000)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();

    // Extract text from Gemini response
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      return res.status(500).json({ error: "Gemini returned no content", raw: data });
    }

    // Strip markdown fences if Gemini adds them
    const cleaned = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Find JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: "No JSON found in Gemini response", raw: aiText });
    }
