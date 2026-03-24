api/geneate.js

const HF_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

async function hfPost(url, token, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: HF_HEADERS(token),
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error || "Hugging Face request failed";
    throw new Error(`${msg}`);
  }
  return j;
}

function safeJsonParse(maybeText) {
  // Try to extract JSON even if model wraps it with text
  const first = maybeText.indexOf("{");
  const last = maybeText.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = maybeText.slice(first, last + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
    if (!HF_TOKEN) return res.status(500).json({ error: "Missing HUGGINGFACE_API_KEY" });

    const input = text.trim().slice(0, 12000);
    const wordCount = input.split(/\s+/).filter(Boolean).length;

    // Step 1: summary (abstractive)
    const summarizerModel = "facebook/bart-large-cnn";
    const summaryResp = await hfPost(
      `https://api-inference.huggingface.co/models/${summarizerModel}`,
      HF_TOKEN,
      {
        inputs: input,
        parameters: { max_length: 180, min_length: 60, do_sample: false },
        options: { wait_for_model: true },
      }
    );

    const summary =
      Array.isArray(summaryResp) && summaryResp[0]?.summary_text
        ? summaryResp[0].summary_text
        : "";

    if (!summary) throw new Error("No summary returned");

    // Step 2: generate study set JSON (flashcards, glossary, keypoints)
    // You can swap model if this one fails in your account/region.
    const genModel = "HuggingFaceH4/zephyr-7b-beta"; // try this first
    const prompt = `
You are an assistant that creates study materials.
Return ONLY valid JSON. No markdown. No extra text.

Create:
- summary: 1 to 2 short paragraphs
- keyPoints: 5 bullet-style strings
- glossary: 8 items (term + definition)
- flashcards: 10 items (term + front question + back answer)

Constraints:
- Keep language simple for students.
- No hallucinations; only use the provided content.
- If content is insufficient, create fewer items but keep JSON valid.

JSON schema exactly:
{
  "summary": "string",
  "keyPoints": ["string"],
  "glossary": [{"term":"string","definition":"string"}],
  "flashcards": [{"term":"string","front":"string","back":"string"}]
}

CONTENT:
${summary}
`;

    const genResp = await hfPost(
      `https://api-inference.huggingface.co/models/${genModel}`,
      HF_TOKEN,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 800,
          temperature: 0.2,
          return_full_text: false,
        },
        options: { wait_for_model: true },
      }
    );

    // HF text-generation often returns an array with generated_text
    const generatedText =
      Array.isArray(genResp) ? (genResp[0]?.generated_text || "") : (genResp?.generated_text || "");

    let study = safeJsonParse(generatedText);

    // Fallback if JSON fails: return at least summary so UI works
    if (!study) {
      study = {
        summary,
        keyPoints: [],
        glossary: [],
        flashcards: [{ term: "Summary", front: "What is the summary?", back: summary }],
      };
    }

    // Ensure required fields exist
    study.summary = typeof study.summary === "string" ? study.summary : summary;
    study.keyPoints = Array.isArray(study.keyPoints) ? study.keyPoints : [];
    study.glossary = Array.isArray(study.glossary) ? study.glossary : [];
    study.flashcards = Array.isArray(study.flashcards) ? study.flashcards : [];

    if (study.flashcards.length === 0) {
      study.flashcards = [{ term: "Summary", front: "What is the summary?", back: study.summary }];
    }

    return res.status(200).json({
      wordCount,
      ...study,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
