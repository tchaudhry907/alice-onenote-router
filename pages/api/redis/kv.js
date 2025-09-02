import { Configuration, OpenAIApi } from "openai";

export default async function handler(req, res) {
  try {
    // Setup OpenAI client
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // Example request
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello from Redis KV route!" }],
    });

    res.status(200).json({
      message: response.data.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to connect to OpenAI" });
  }
}
