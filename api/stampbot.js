export default async function handler(req, res) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const assistant_id = "asst_8JwGnLcVMYxFhHCFVGkepyLR";

  // ✅ Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(200).end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  let userInput;
  try {
    userInput = JSON.parse(req.body).userInput;
  } catch (err) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Start a new thread
  const thread = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    }
  }).then(r => r.json());

  const thread_id = thread.id;

  // Send the user's message to the thread
  await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "user", content: userInput })
  });

  // Run the assistant
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

  // Get the assistant's reply
  const messages = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  }).then(r => r.json());

  const content = messages.data[0].content[0];

  // ✅ Handle output from the function (tool_calls)
  if (content.type === "tool_calls") {
    const toolCall = content.tool_calls?.[0];
    const functionArgs = JSON.parse(toolCall.function.arguments);

    if (functionArgs.image_url) {
      res.status(200).json({ type: "image", url: functionArgs.image_url });
    } else {
      res.status(500).json({ error: "No image_url returned from function" });
    }
  } else if (content.type === "text") {
    res.status(200).json({ type: "text", value: content.text.value });
  } else {
    res.status(500).json({ error: "Unexpected content type" });
  }
}
