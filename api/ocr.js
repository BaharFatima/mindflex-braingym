export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = "K85088363188957"; // your OCR.Space key

  try {

    const { image } = req.body;

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: API_KEY
      },
      body: new URLSearchParams({
        base64Image: image,
        language: "eng",
        OCREngine: "2"
      })
    });

    const data = await response.json();

    const text =
      data?.ParsedResults?.[0]?.ParsedText || "";

    return res.status(200).json({ text });

  } catch (error) {

    console.error(error);

    return res.status(500).json({ text: "" });

  }
}
