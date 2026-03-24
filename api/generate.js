export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const { text } = req.body;

  // IMPORTANT: We need to tell Gemini EXACTLY what format to return
  const prompt = `Analyze this document and return ONLY a JSON object (no markdown, no explanation) with this exact structure:

{
  "summary": "2-3 paragraph summary",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5", "point 6", "point 7", "point 8"],
  "glossary": [
    {"term": "Term1", "definition": "Definition of term1"},
    {"term": "Term2", "definition": "Definition of term2"}
  ],
  "flashcards": [
    {"front": "Question", "back": "Answer", "term": "KeyTerm"},
    {"front": "Question 2", "back": "Answer 2", "term": "KeyTerm2"}
  ],
  "wordCount": ${text.split(/\s+/).length}
}

Generate 8 key points, 10-12 glossary terms, and 10-12 flashcards. Make them high-quality study materials.

Document text:
${text.slice(0, 30000)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000
        }
      })
    });

    const data = await response.json();
    
    // Extract the text from Gemini's response
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiText) {
      throw new Error("No response from AI");
    }

    // Clean up the response (remove markdown if present)
    let cleanText = aiText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    // Parse the JSON
    const parsedData = JSON.parse(cleanText);
    
    // Make sure it has all required fields
    if (!parsedData.flashcards || !parsedData.glossary || !parsedData.keyPoints || !parsedData.summary) {
      throw new Error("Invalid response format from AI");
    }

    // Return the properly formatted data
    res.status(200).json(parsedData);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: "Failed to process document",
      details: error.message 
    });
  }
}
