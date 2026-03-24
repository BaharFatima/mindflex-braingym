module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables' });
  }

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

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

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      return res.status(500).json({ error: 'Gemini returned no content', raw: data });
    }

    const cleaned = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'No JSON found in Gemini response', raw: aiText });
    }

    const parsed = JSON.parse(match[0]);
    res.status(200).json(parsed);

  } catch (error) {
    res.status(500).json({ error: 'Failed: ' + error.message });
  }
}
