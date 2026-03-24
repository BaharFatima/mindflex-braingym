// /api/generate.js
// Vercel Serverless Function (works for static HTML projects deployed to Vercel)

const SUM_MODEL = "facebook/bart-large-cnn";
// Instruction model for structured JSON. If this fails/gated, switch to "google/flan-t5-large".
const GEN_MODEL = "HuggingFaceH4/zephyr-7b-beta";

const MAX_CHUNKS = 14;          // cap cost/time
const CHUNK_SIZE = 3800;        // characters
const CHUNK_OVERLAP = 350;      // characters
const SUMMARY_REDUCE_INPUT_MAX = 12000;

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function hfPost(model, token, payload) {
  const url = `https://api-inference.huggingface.co/models/${model}`;
  const r = await fetch(url, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });

  const j = await r.json();

  if (!r.ok) {
    // HF errors often come as { error: "...", estimated_time: ... }
    const msg = j?.error || `HF request failed (${r.status})`;
    throw new Error(msg);
  }
  return j;
}

function cleanText(raw) {
  return (raw || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/_{3,}/g, " ")                  // remove ______ cloze blanks
    .replace(/\bPage\s*\d+\b/gi, " ")        // remove "Page 1"
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")     // remove "3/12" patterns
    .replace(/[•●◦■▪▫]+/g, "•")              // normalize bullets
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    chunks.push(text.slice(i, end));
    if (end === text.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

function wordCount(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

function pickSummaryText(resp) {
  // summarization pipeline returns: [{ summary_text: "..." }]
  if (Array.isArray(resp) && resp[0]?.summary_text) return String(resp[0].summary_text).trim();
  return "";
}

function pickGeneratedText(resp) {
  // text generation often returns: [{ generated_text: "..." }]
  if (Array.isArray(resp) && resp[0]?.generated_text) return String(resp[0].generated_text);
  // some models may return different shapes, keep simple
  if (typeof resp?.generated_text === "string") return resp.generated_text;
  return "";
}

function safeJsonFromText(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;

  const slice = text.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function normalizeStudySet(obj, fallbackSummary) {
  const out = obj && typeof obj === "object" ? obj : {};
  const summary = typeof out.summary === "string" && out.summary.trim().length
    ? out.summary.trim()
    : fallbackSummary;

  const keyPoints = Array.isArray(out.keyPoints) ? out.keyPoints.filter(Boolean).map(String) : [];
  const glossary = Array.isArray(out.glossary)
    ? out.glossary
        .filter(Boolean)
        .map(g => ({
          term: String(g.term || "").trim(),
          definition: String(g.definition || "").trim(),
        }))
        .filter(g => g.term && g.definition)
    : [];

  let flashcards = Array.isArray(out.flashcards)
    ? out.flashcards
        .filter(Boolean)
        .map(c => ({
          term: String(c.term || "Card").trim(),
          front: String(c.front || "").replace(/_{3,}/g, " ").trim(),
          back: String(c.back || "").replace(/_{3,}/g, " ").trim(),
        }))
        .filter(c => c.front && c.back)
    : [];

  // Ensure no cloze/fill in blank style sneaks in
  flashcards = flashcards.map(c => ({
    ...c,
    front: c.front.replace(/_{2,}/g, " ").replace(/\s+/g, " ").trim(),
    back: c.back.replace(/_{2,}/g, " ").replace(/\s+/g, " ").trim(),
  }));

  if (flashcards.length === 0) {
    flashcards = [{ term: "Summary", front: "What is this document about?", back: summary }];
  }

  return { summary, keyPoints, glossary, flashcards };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
    if (!HF_TOKEN) return res.status(500).json({ error: "Missing HUGGINGFACE_API_KEY" });

    const { text } = req.body || {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    const cleaned = cleanText(text);

    if (cleaned.length < 200) {
      return res.status(400).json({ error: "Text too short to summarize well." });
    }

    const wc = wordCount(cleaned);

    // 1) Chunk summarize (map)
    const chunks = chunkText(cleaned).slice(0, MAX_CHUNKS);

    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      const resp = await hfPost(SUM_MODEL, HF_TOKEN, {
        inputs: chunks[i],
        parameters: {
          max_length: 180,
          min_length: 60,
          do_sample: false,
        },
        options: { wait_for_model: true },
      });

      const s = pickSummaryText(resp);
      if (s) chunkSummaries.push(s);
    }

    if (!chunkSummaries.length) throw new Error("Could not summarize the document.");

    // 2) Reduce summary (summary of summaries)
    const combined = chunkSummaries.join("\n");
    const reduceResp = await hfPost(SUM_MODEL, HF_TOKEN, {
      inputs: combined.slice(0, SUMMARY_REDUCE_INPUT_MAX),
      parameters: {
        max_length: 220,
        min_length: 90,
        do_sample: false,
      },
      options: { wait_for_model: true },
    });

    const finalSummary = pickSummaryText(reduceResp) || chunkSummaries[0];

    // 3) Generate flashcards/key points/glossary from final summary (higher accuracy)
    // Strong constraints to avoid blanks and force concrete Q/A.
    const prompt = `
Return ONLY valid JSON. No markdown. No extra text.

Make study material using ONLY the text below. Do not add facts.
Do NOT create fill-in-the-blank questions.
Do NOT use underscores like "____".
Make flashcards clear and specific for students.

Output JSON schema exactly:
{
  "summary": "string",
  "keyPoints": ["string"],
  "glossary": [{"term":"string","definition":"string"}],
  "flashcards": [{"term":"string","front":"string","back":"string"}]
}

Rules:
- summary: 1 to 2 short paragraphs.
- keyPoints: exactly 6 items, each a short sentence.
- glossary: 10 items, term must appear in the text.
- flashcards: 12 items, front must be a question ending with "?".
- back should be 1 to 2 sentences max.

TEXT:
${finalSummary}
`;

    const genResp = await hfPost(GEN_MODEL, HF_TOKEN, {
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.1,
        return_full_text: false,
      },
      options: { wait_for_model: true },
    });

    const genText = pickGeneratedText(genResp);
    const parsed = safeJsonFromText(genText);

    const study = normalizeStudySet(parsed, finalSummary);

    // Final guardrail: ensure question marks on fronts
    study.flashcards = study.flashcards.map(c => ({
      ...c,
      front: c.front.endsWith("?") ? c.front : (c.front + "?"),
    }));

    return res.status(200).json({
      wordCount: wc,
      ...study,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
