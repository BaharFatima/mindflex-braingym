
import vision from "@google-cloud/vision";

export default async function handler(req, res) {
  try {
    const client = new vision.ImageAnnotatorClient({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS)
    });

    const base64Image = req.body.image.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    const [result] = await client.textDetection({
      image: { content: base64Image }
    });

    const text = result.textAnnotations?.[0]?.description || "";

    res.status(200).json({ text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OCR failed" });
  }
}
