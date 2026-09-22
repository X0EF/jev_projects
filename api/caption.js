const PROMPT =
  "Write alt text for a Discord moderation check. One or two sentences. Say what is visible, any words on screen. These frames are from one short attachment.";

const MAX_FRAMES = 2;
const MAX_B64 = 700000;

function framesOf(body) {
  const raw = Array.isArray(body.frames) ? body.frames : [];
  return raw.slice(0, MAX_FRAMES).map((item) => {
    const s = String(item || "");
    const i = s.indexOf(",");
    return (s.startsWith("data:") && i >= 0 ? s.slice(i + 1) : s).replace(/\s/g, "");
  }).filter(Boolean);
}

async function openai(key, frames) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          ...frames.map((b64) => ({
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64," + b64 },
          })),
        ],
      }],
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return { error: (json.error && json.error.message) || "OpenAI error", status: r.status };
  const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  return { text: String(text || "").trim() };
}

async function gemini(key, frames) {
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            ...frames.map((b64) => ({ inline_data: { mime_type: "image/jpeg", data: b64 } })),
          ],
        }],
      }),
    }
  );
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return { error: (json.error && json.error.message) || "Gemini error", status: r.status };
  const parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
  const text = (parts || []).map((p) => p.text || "").join("").trim();
  return { text };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const provider = body.provider === "gemini" ? "gemini" : body.provider === "openai" ? "openai" : "";
  const apiKey = String(body.apiKey || "").trim();
  const frames = framesOf(body);
  if (!provider) return res.status(400).json({ error: "Pick OpenAI or Gemini" });
  if (!apiKey || apiKey.length > 300) return res.status(400).json({ error: "Enter a vision API key" });
  if (!frames.length) return res.status(400).json({ error: "No frames to describe" });
  if (frames.some((f) => f.length > MAX_B64)) return res.status(400).json({ error: "Frame is too large" });
  const out = provider === "gemini" ? await gemini(apiKey, frames) : await openai(apiKey, frames);
  if (out.error) return res.status(out.status || 502).json({ error: out.error });
  if (!out.text) return res.status(502).json({ error: "Vision model returned no description" });
  return res.status(200).json({ text: out.text });
};
