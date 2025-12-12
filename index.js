import express from "express";
import fetch from "node-fetch";
import { spawn } from "child_process";
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
    console.log("▶ render request received");

    const { backgroundVideo, voiceover, music } = req.body;
    if (!backgroundVideo || !voiceover) {
      return res.status(400).json({ error: "Missing URLs" });
    }

    const id = uuid();
    const bg = path.join(TMP, `${id}-bg.mp4`);
    const vo = path.join(TMP, `${id}-vo.mp3`);
    const mu = path.join(TMP, `${id}-mu.mp3`);
    const out = path.join(TMP, `${id}.mp4`);

    await download(backgroundVideo, bg);
    await download(voiceover, vo);
    if (music) await download(music, mu);

    const args = [
      "-y",
      "-i", bg,
      "-i", vo
    ];

    if (music) {
      args.push(
        "-i", mu,
        "-filter_complex",
        "[2:a]volume=0.2[a2];[1:a][a2]amix=inputs=2[a]",
        "-map", "[a]"
      );
    } else {
      args.push("-map", "1:a");
    }

    args.push(
      "-map", "0:v",
      "-shortest",
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      out
    );

    console.log("▶ ffmpeg args:", args.join(" "));

    const ff = spawn("ffmpeg", args);

    ff.stderr.on("data", d => console.log(d.toString()));

    ff.on("close", code => {
      if (code !== 0) {
        return res.status(500).json({ error: "FFmpeg failed", code });
      }

      console.log("✔ render complete");
      res.json({ success: true, file: out });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FFmpeg render service running on port ${PORT}`);
});
