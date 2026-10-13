import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "wavelength-api" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
