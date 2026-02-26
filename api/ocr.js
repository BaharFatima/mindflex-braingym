
const vision = require("@google-cloud/vision");

module.exports = async function (req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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

    return res.status(200).json({ text });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
