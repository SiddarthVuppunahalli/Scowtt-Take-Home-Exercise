import OpenAI from "openai";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 10_000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
});

export async function generateMovieFact(movieTitle: string) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    instructions:
      "You write concise, accurate, family-friendly movie trivia. Return one fun fact in one or two sentences. Do not mention that you are an AI.",
    input: `Write one fun fact about the movie "${movieTitle}".`,
    max_output_tokens: 120,
  });

  const fact = response.output_text.trim();

  if (!fact) {
    throw new Error("OpenAI returned an empty movie fact.");
  }

  return fact;
}
