const express = require("express");
const path = require("path");
const vision = require("@google-cloud/vision");

const app = express();
const PORT = process.env.PORT || 8080;

// Parse JSON body
app.use(express.json({ limit: "10mb" }));

// Serve static files
app.use(express.static(__dirname));

// OCR Route
app.post("/api/ocr", async (req, res) => {
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

    res.json({ text });

  } catch (err) {
    console.error(err);
    res.status(500).send("OCR failed");
  }
});

app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
