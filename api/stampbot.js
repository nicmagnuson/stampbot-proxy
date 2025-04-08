export default async function handler(req, res) {
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
    userInput = JSON.parse(req.body).userInput;
  } catch (err) {
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
  
  // 🧪 DEBUG LOG
  console.log("🔍 Full message from OpenAI:", JSON.stringify(messages, null, 2));
  

  const content = messages.data[0].content?.[0];
  const tool_calls = messages.data[0].tool_calls;

  if (content?.type === "text") {
    res.status(200).json({ type: "text", value: content.text.value });
  } else if (tool_calls?.length && tool_calls[0].function.name === "generate_black_and_white_lineart") {
    const args = JSON.parse(tool_calls[0].function.arguments);
    if (args?.image_url) {
      res.status(200).json({ type: "image", url: args.image_url });
    } else {
      res.status(500).json({ error: "No image_url returned by tool" });
    }
  } else {
    res.status(500).json({ error: "Unexpected content type" });
  }
}
