import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { config, hasGemini } from "../config.js";

/**
 * Voice and image generation for the /learn tutor — Gemini for TTS and Imagen
 * for image generation (both reusing GEMINI_API — no extra key). Telegram voice
 * notes must be OGG/Opus, so the raw PCM that Gemini TTS returns is transcoded
 * with a bundled static ffmpeg. Every function degrades gracefully to null on any
 * failure, so the lesson always continues with text even if media is unavailable.
 */

const GEN_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Transcode raw little-endian PCM to an Ogg/Opus voice note using ffmpeg. */
function pcmToOgg(pcm: Buffer, sampleRate: number): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(null);
    const ff = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-f", "s16le",
      "-ar", String(sampleRate),
      "-ac", "1",
      "-i", "pipe:0",
      "-c:a", "libopus",
      "-b:a", "32k",
      "-f", "ogg",
      "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    ff.stdout.on("data", (d: Buffer) => chunks.push(d));
    ff.on("error", (err) => {
      console.error("ffmpeg spawn error:", err);
      resolve(null);
    });
    ff.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(new Uint8Array(Buffer.concat(chunks)));
      else resolve(null);
    });
    ff.stdin.on("error", () => {}); // ignore EPIPE if ffmpeg exits early
    ff.stdin.write(pcm);
    ff.stdin.end();
  });
}

/** Speak a short English sentence; returns Ogg/Opus bytes for a Telegram voice note. */
export async function synthesizeSpeech(text: string): Promise<Uint8Array | null> {
  if (!hasGemini || !text.trim()) return null;
  try {
    const res = await fetch(
      `${GEN_URL}/${config.geminiTtsModel}:generateContent?key=${config.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: config.geminiTtsVoice } },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error("Gemini TTS error:", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const b64 = part?.inlineData?.data;
    if (!b64) return null;
    const rate = Number(part?.inlineData?.mimeType?.match(/rate=(\d+)/)?.[1]) || 24000;
    return await pcmToOgg(Buffer.from(b64, "base64"), rate);
  } catch (err) {
    console.error("synthesizeSpeech error:", err);
    return null;
  }
}

/** Wrap a short description into a clean flashcard-style image prompt. */
function imagePrompt(subject: string): string {
  return (
    `A clear, simple, friendly illustration for an English beginner's vocabulary flashcard: ${subject}. ` +
    "Bright, clean, no text or words in the image."
  );
}

/** Gemini "flash image" / "pro image" models — generateContent, image in inlineData. */
async function genViaGemini(model: string, prompt: string): Promise<Uint8Array | null> {
  const res = await fetch(`${GEN_URL}/${model}:generateContent?key=${config.geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt(prompt) }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  if (!res.ok) {
    console.error(`Gemini image error (${model}):`, res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) =>
    p.inlineData?.mimeType?.startsWith("image/"),
  );
  const b64 = part?.inlineData?.data;
  return b64 ? new Uint8Array(Buffer.from(b64, "base64")) : null;
}

/** Imagen models — the :predict endpoint (different request/response shape from Gemini). */
async function genViaImagen(model: string, prompt: string): Promise<Uint8Array | null> {
  const res = await fetch(`${GEN_URL}/${model}:predict?key=${config.geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: imagePrompt(prompt) }],
      parameters: { sampleCount: 1 },
    }),
  });
  if (!res.ok) {
    console.error(`Imagen error (${model}):`, res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  return b64 ? new Uint8Array(Buffer.from(b64, "base64")) : null;
}

/** Call the right API for a model id: imagen-* → :predict, otherwise generateContent. */
async function tryImageModel(model: string, prompt: string): Promise<Uint8Array | null> {
  try {
    return model.toLowerCase().startsWith("imagen")
      ? await genViaImagen(model, prompt)
      : await genViaGemini(model, prompt);
  } catch (err) {
    console.error(`image model ${model} threw:`, err);
    return null;
  }
}

// Known-good current models to fall back through if the configured one isn't enabled
// on the key (Gemini flash-image via generateContent; Imagen via :predict).
const IMAGE_MODEL_FALLBACKS = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];
let workingImageModel: string | null = null; // remembered after the first success
let imageFailStreak = 0;
let imageGenOff = false; // tripped after repeated total failures (reset on restart)

/**
 * Generate a simple illustrative picture; returns image bytes, or null if image
 * generation isn't available. Tries the configured model (IMAGEN_IMAGE_MODEL —
 * may be an imagen-* or a gemini-*-image id), then known-good fallbacks, and
 * remembers whichever works so later calls are direct.
 */
export async function generateImage(prompt: string): Promise<Uint8Array | null> {
  if (!hasGemini || !prompt.trim() || imageGenOff) return null;
  const candidates = [workingImageModel, config.imagenImageModel, ...IMAGE_MODEL_FALLBACKS].filter(
    (m, i, a): m is string => !!m && a.indexOf(m) === i,
  );
  for (const model of candidates) {
    const img = await tryImageModel(model, prompt);
    if (img) {
      if (workingImageModel !== model) {
        workingImageModel = model;
        console.log(`[media] image model in use: ${model}`);
      }
      imageFailStreak = 0;
      return img;
    }
  }
  if (++imageFailStreak >= 3) {
    imageGenOff = true;
    console.error("[media] image generation unavailable on this key — disabling for this run.");
  }
  return null;
}
