import dotenv from "dotenv";
import { resolve } from "path";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, ".env") });

// Setup API credentials
const anthropicKey = process.env["ANTHROPIC_API_KEY"];
const openaiKey = process.env["OPENAI_API_KEY"];
const modelProvider = process.env["MODEL_PROVIDER"] || "anthropic";

if (modelProvider === "anthropic" && !anthropicKey) {
  throw new Error("Please set the ANTHROPIC_API_KEY environment variable.");
}

if (modelProvider === "openai" && !openaiKey) {
  throw new Error("Please set the OPENAI_API_KEY environment variable.");
}

export async function generateTextWithModel({
  prompt,
  system = "You are a helpful assistant.",
}) {
  const model =
    modelProvider === "openai"
      ? openai("gpt-4o")
      : anthropic("claude-3-5-sonnet-20240620");

  return generateText({
    model,
    system,
    prompt,
  });
}
