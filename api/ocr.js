export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = "K85088363188957";

  try {

    const { image } = req.body;

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        base64Image: image,
        language: "eng"
      })
    });

    const data = await response.json();

    const text =
      data.ParsedResults?.[0]?.ParsedText || "";

    res.status(200).json({ text });

  } catch (error) {

    res.status(500).json({ text: "" });

  }
}
