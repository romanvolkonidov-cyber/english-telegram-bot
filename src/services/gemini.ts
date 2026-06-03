import { config, hasGemini } from "../config.js";

export interface VoiceEvaluation {
  transcript: string;
  feedback: string;
}

/**
 * Transcribe and give feedback on a spoken answer using Gemini.
 * Mirrors rv2class/app/api/evaluate-voice (same model, prompt and parsing).
 * Returns null if no API key is configured or the call fails — voice answers
 * are still stored for the teacher in that case.
 */
export async function evaluateVoiceAnswer(
  audioBase64: string,
  mimeType: string,
  questionText: string,
): Promise<VoiceEvaluation | null> {
  if (!hasGemini) return null;

  const prompt = `You are a warm and honest English language teacher giving feedback to a student.

The student was given this speaking prompt:
"${questionText}"

Listen carefully to their recorded answer. Then provide:

TRANSCRIPT: Write exactly what the student said (verbatim transcription).

FEEDBACK: Give honest, encouraging feedback in natural everyday spoken English (not textbook English). Your feedback must:
- Be truthful — never praise what wasn't good or skip real mistakes
- Lead with what was genuinely good or natural
- Point out any mistakes clearly but kindly (grammar, vocabulary, unnatural phrasing)
- Show how a native speaker would naturally say the same thing when relevant
- Be motivating

CRITICAL — match feedback length to answer length:
- If the answer is very short (a name, one word, or one short sentence), give 1–2 short sentences of feedback. A two-word answer does NOT deserve a paragraph.
- If the answer is a few sentences, give 2–3 sentences of feedback.
- If the answer is a detailed story or long response, a fuller paragraph is fine.
- Never pad with empty encouragement to reach a word count. Say what needs to be said and stop.

Format your response EXACTLY like this (use these exact labels):
TRANSCRIPT: [verbatim transcription]
FEEDBACK: [your feedback]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType || "audio/ogg", data: audioBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.65, maxOutputTokens: 800 },
        }),
      },
    );

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const transcriptMatch = raw.match(/TRANSCRIPT:\s*([\s\S]*?)(?=\nFEEDBACK:|$)/i);
    const feedbackMatch = raw.match(/FEEDBACK:\s*([\s\S]*)$/i);

    return {
      transcript: transcriptMatch?.[1]?.trim() ?? "",
      feedback: feedbackMatch?.[1]?.trim() ?? raw.trim(),
    };
  } catch (err) {
    console.error("evaluateVoiceAnswer error:", err);
    return null;
  }
}
