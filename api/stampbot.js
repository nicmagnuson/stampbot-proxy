export default async function handler(req, res) {
  console.log("🔔 Received a request to /api/stampbot");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(200).end();
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const assistant_id = "asst_83wGnLcVMYxFfHCFVGkepyLR";

  // Set CORS header for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");

  let userInput;
  try {
    console.log("📦 Raw req.body:", req.body);
    userInput = req.body.userInput; // ✅ Fixed to remove JSON.parse
  } catch (err) {
    console.error("❌ Failed to parse request body:", err);
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Create a thread
  const thread = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    }
  }).then(r => r.json());

  const thread_id = thread.id;

  // Add user message to the thread
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

  // Poll run status
  let status = "queued";
  let result;
  while (status !== "completed") {
    await new Promise(res => setTimeout(res, 2000));
    result = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run.id}`, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    }).then(r => r.json());
    status = result.status;
  }

  // Get the messages from the thread
  const messages = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  }).then(r => r.json());

  console.log("🧠 Full OpenAI response:", JSON.stringify(messages, null, 2));

  const firstMessage = messages.data?.[0];

  if (!firstMessage) {
    return res.status(500).json({ error: "No messages returned from assistant." });
  }

  const content = firstMessage.content?.[0];
  const tool_calls = firstMessage.tool_calls;

  if (content?.type === "text") {
    return res.status(200).json({ type: "text", value: content.text.value });
  } else if (tool_calls?.[0]?.function?.name === "generate_black_and_white_lineart") {
    const args = JSON.parse(tool_calls[0].function.arguments);
    if (args?.image_url) {
      return res.status(200).json({ type: "image", url: args.image_url });
    } else {
      return res.status(500).json({ error: "No image_url returned by tool." });
    }
  } else {
    return res.status(200).json({ type: "text", value: "🤔 Assistant returned an unexpected format. Try again?" });
  }
}

export const config = {
  maxDuration: 60, // Increased timeout to 60 seconds
};
