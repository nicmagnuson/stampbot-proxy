export default async function handler(req, res) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const assistant_id = "asst_8JwGnLcVMYxFhHCFVGkepyLR";

  // ✅ Handle CORS preflight request
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(200).end();
    return;
  }

  // ✅ Fix CORS on actual requests
  res.setHeader("Access-Control-Allow-Origin", "*");

  let userInput;
  try {
    userInput = JSON.parse(req.body).userInput;
  } catch (err) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const thread = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    }
  }).then(r => r.json());

  const thread_id = thread.id;

  await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "user", content: userInput })
  });

  const run = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assistant_id })
  }).then(r => r.json());

  let status = "queued";
  let result;
  while (status !== "completed") {
    await new Promise(res => setTimeout(res, 2000));
    result = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run.id}`, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    }).then(r => r.json());
    status = result.status;
  }

  const messages = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  }).then(r => r.json());

  const content = messages.data[0].content[0];

  if (content.type === "text") {
    res.status(200).json({ type: "text", value: content.text.value });
  } else if (content.type === "image_file") {
    const file_id = content.image_file.file_id;
    res.status(200).json({ type: "image", url: `https://api.openai.com/v1/files/${file_id}/content` });
  } else {
    res.status(500).json({ error: "Unexpected content type" });
  }
}
