import express from "express";
import fetch from "node-fetch";
import { exec } from "child_process";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const TMP = "/tmp";

async function download(url, output) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}`);
  const fileStream = fs.createWriteStream(output);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

app.post("/render", async (req, res) => {
  try {
    const { backgroundVideo, voiceover, music } = req.body;

    if (!backgroundVideo || !voiceover) {
      return res.status(400).json({ error: "Missing required media URLs" });
    }

    const id = uuid();
    const bg = path.join(TMP, `${id}-bg.mp4`);
    const vo = path.join(TMP, `${id}-vo.mp3`);
    const mu = path.join(TMP, `${id}-mu.mp3`);
    const out = path.join(TMP, `${id}.mp4`);

    await download(backgroundVideo, bg);
    await download(voiceover, vo);
    if (music) await download(music, mu);

    const cmd = `
ffmpeg -y \
-i ${bg} \
-i ${vo} \
${music ? `-i ${mu}` : ""} \
-filter_complex "${music ? "[2:a]volume=0.2[a2];[1:a][a2]amix=inputs=2[a]" : ""}" \
-map 0:v \
-map ${music ? '"[a]"' : "1:a"} \
-shortest \
-s 1080x1920 \
${out}
    `;

    await new Promise((resolve, reject) => {
      exec(cmd, (err) => (err ? reject(err) : resolve()));
    });

    // For now, just return success (upload comes next step)
    res.json({ success: true, file: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FFmpeg render service on ${PORT}`));
