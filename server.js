const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve all root files
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});