import express from "express";
import fetch from "node-fetch";
import { exec } from "child_process";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const TMP = "/tmp";

// ---------- helpers ----------
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

// ---------- render endpoint ----------
app.post("/render", async (req, res) => {
  try {
    const { backgroundVideo, voiceover, music } = req.body;

    if (!backgroundVideo || !voiceover) {
      return res.status(400).json({
        error: "backgroundVideo and voiceover are required"
      });
    }

    const id = uuid();

    const bg = path.join(TMP, `${id}-bg.mp4`);
    const vo = path.join(TMP, `${id}-vo.mp3`);
    const mu = path.join(TMP, `${id}-mu.mp3`);
    const out = path.join(TMP, `${id}.mp4`);

    // download assets
    await download(backgroundVideo, bg);
    await download(voiceover, vo);
    if (music) await download(music, mu);

    // audio logic
    const audioPart = music
      ? `-i ${mu} -filter_complex "[2:a]volume=0.2[a2];[1:a][a2]amix=inputs=2[a]" -map "[a]"`
      : `-map 1:a`;

    const cmd = `
ffmpeg -y \
-i ${bg} \
-i ${vo} \
${audioPart} \
-map 0:v \
-shortest \
-vf "scale=1080:1920:force_original_aspect_ratio=cover" \
-c:v libx264 \
-pix_fmt yuv420p \
${out}
`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err) => (err ? reject(err) : resolve()));
    });

    res.json({
      success: true,
      file: out
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ---------- server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FFmpeg render service running on port ${PORT}`);
});
