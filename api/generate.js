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
  if (!r.ok) throw new Error(j?.error || "Hugging Face request failed");
  return j;
}

function cleanText(raw) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/_{3,}/g, "")                 // remove long blanks like ______
    .replace(/\bPage\s*\d+\b/gi, "")       // remove "Page 1" etc
    .replace(/\b\d+\s*\/\s*\d+\b/g, "")    // remove "3/12" patterns
    .trim();
}

// chunk by characters (simple, reliable for serverless)
function chunkText(text, chunkSize = 3500, overlap = 300) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i = end - overlap;
    if (i < 0) i = 0;
    if (end === text.length) break;
  }
  return chunks;
}

function safeJsonParse(maybeText) {
  const first = maybeText.indexOf("{");
  const last = maybeText.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(maybeText.slice(first, last + 1));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
    if (!HF_TOKEN) return res.status(500).json({ error: "Missing HUGGINGFACE_API_KEY" });

    const cleaned = cleanText(text);
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

    // 1) Map summarize chunks
    const summarizerModel = "facebook/bart-large-cnn";
    const chunks = chunkText(cleaned, 3500, 300).slice(0, 12); // cap for speed/cost

    const chunkSummaries = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const resp = await hfPost(
        `https://api-inference.huggingface.co/models/${summarizerModel}`,
        HF_TOKEN,
        {
          inputs: chunks[idx],
          parameters: { max_length: 180, min_length: 60, do_sample: false },
          options: { wait_for_model: true },
        }
      );

      const s = Array.isArray(resp) ? resp[0]?.summary_text : "";
      if (s) chunkSummaries.push(s.trim());
    }

    if (!chunkSummaries.length) throw new Error("No summaries returned");

    // 2) Reduce summarize (summary of summaries)
    const combined = chunkSummaries.join("\n");
    const reduceResp = await hfPost(
      `https://api-inference.huggingface.co/models/${summarizerModel}`,
      HF_TOKEN,
      {
        inputs: combined.slice(0, 12000),
        parameters: { max_length: 200, min_length: 80, do_sample: false },
        options: { wait_for_model: true },
      }
    );
    const finalSummary = Array.isArray(reduceResp) ? reduceResp[0]?.summary_text : "";
    if (!finalSummary) throw new Error("No final summary returned");

    // 3) Generate study set JSON (flashcards/keypoints/glossary) from final summary
    // If Zephyr gives messy JSON for you, switch to "google/flan-t5-large".
    const genModel = "HuggingFaceH4/zephyr-7b-beta";

    const prompt = `
Return ONLY valid JSON. No markdown. No extra text.

Create study material using ONLY the text below.
Do NOT use fill-in-the-blank questions.
Do NOT output underscores like "______".
All flashcards must be normal Q/A.

JSON schema exactly:
{
  "summary": "string",
  "keyPoints": ["string"],
  "glossary": [{"term":"string","definition":"string"}],
  "flashcards": [{"term":"string","front":"string","back":"string"}]
}

Text:
${finalSummary}
`;

    const genResp = await hfPost(
      `https://api-inference.huggingface.co/models/${genModel}`,
      HF_TOKEN,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 900,
          temperature: 0.1,
          return_full_text: false,
        },
        options: { wait_for_model: true },
      }
    );

    const generatedText = Array.isArray(genResp) ? (genResp[0]?.generated_text || "") : "";
    const study = safeJsonParse(generatedText);

    // Fallback if JSON fails
    const out = study || {
      summary: finalSummary,
      keyPoints: [],
      glossary: [],
      flashcards: [{ term: "Summary", front: "What is this document about?", back: finalSummary }],
    };

    // normalize
    out.summary = typeof out.summary === "string" ? out.summary : finalSummary;
    out.keyPoints = Array.isArray(out.keyPoints) ? out.keyPoints : [];
    out.glossary = Array.isArray(out.glossary) ? out.glossary : [];
    out.flashcards = Array.isArray(out.flashcards) ? out.flashcards : [];

    // enforce no blanks
    out.flashcards = out.flashcards.map(fc => ({
      term: String(fc.term || "Card"),
      front: String(fc.front || "").replace(/_{3,}/g, ""),
      back: String(fc.back || "").replace(/_{3,}/g, ""),
    }));

    if (out.flashcards.length === 0) {
      out.flashcards = [{ term: "Summary", front: "What is this document about?", back: out.summary }];
    }

    return res.status(200).json({ wordCount, ...out });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
