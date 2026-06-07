async function callOpenAI({ system, messages, temperature = 0.3, model = process.env.OPENAI_MODEL || "gpt-4o-mini" }) {
  if (!process.env.OPENAI_API_KEY) {
    return { provider: "local", text: null, configured: false };
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: system },
        ...messages
      ]
    })
  });
  const json = await response.json();
  if (!response.ok) {
    const error = new Error(json.error?.message || "OpenAI request failed");
    error.status = response.status;
    error.details = json.error || json;
    throw error;
  }
  return { provider: "openai", configured: true, text: json.choices?.[0]?.message?.content || "" };
}

function buildSeniorGuruSystemPrompt(context = {}) {
  return [
    "You are Guru, a warm senior support companion inside TheSeniorGuru.",
    "Respond in short, calm, practical sentences. Avoid medical diagnosis.",
    "When the request involves medication, safety, falls, chest pain, breathing trouble, confusion, or emergency risk, recommend contacting trusted circle, clinician, or emergency services.",
    "Classify intent into one of: ride, medication, food, loneliness, task, scan, story, music, safety, family, general.",
    `Resident context: ${JSON.stringify(context).slice(0, 4000)}`
  ].join("\n");
}

module.exports = { callOpenAI, buildSeniorGuruSystemPrompt };
