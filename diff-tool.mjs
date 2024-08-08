import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import dotenv from "dotenv";
import { generateText } from "ai";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env in the current working directory
dotenv.config({ path: resolve(__dirname, ".env") });
console.log("Loaded environment variables from current working directory");

// Setup API credentials
const anthropicKey = process.env["ANTHROPIC_API_KEY"];
const openaiKey = process.env["OPENAI_API_KEY"];
const modelProvider = process.env["MODEL_PROVIDER"] || "anthropic";

if (modelProvider === "anthropic" && !anthropicKey) {
  console.error("Please set the ANTHROPIC_API_KEY environment variable.");
  process.exit(1);
}

if (modelProvider === "openai" && !openaiKey) {
  console.error("Please set the OPENAI_API_KEY environment variable.");
  process.exit(1);
}

function getDiffFromMain(maxDiffSize = 1000) {
  console.log("Getting diff from main branch...");
  const diffCommand = `
    git diff main --name-only | grep -vE 'package-lock.json|yarn.lock|pnpm-lock.yaml|public/.*\\.(css|js)|\\.min\\.' | while read file; do
      echo "File: $file";
      git diff main -- "$file" | awk -v max=${maxDiffSize} '
        NR <= max {print} 
        NR == max+1 {print "... (diff truncated due to size)"; exit}
      ';
      echo;
    done
  `;
  return new Promise((resolve, reject) => {
    try {
      const stdout = execSync(diffCommand, { maxBuffer: 100 * 1024 * 1024 });
      console.log("Diff successfully retrieved");
      resolve(stdout.toString());
    } catch (error) {
      console.error("Error getting diff:", error);
      reject(error);
    }
  });
}

async function generatePRDescription(diff, filesUnderMaxLength, readmeContent) {
  console.log("Generating PR description...");
  const prompt = `
    You are an expert developer and technical writer. Based on the following git diff, 
    please generate a concise and informative pull request description. A good pull request, documents the changes
    in the repository, with a reference to internal decisions in each file. Any new dependencies are referenced
    and explained in detail, especially at their implementation site.
    ${
      readmeContent
        ? `The repo your working on is has a readme file. The readme file is as follows:\n${readmeContent}`
        : ""
    }
    Include a brief summary of the changes, their purpose, and any potential impact. Note additional libraries, concepts, or patterns implemented.
    If the diff is truncated, mention that in your description.
    When talking about changes to, or additions of a file - reference the file name and relative path from the root directory in backticks (Very important).
    Don't speak in generalities or use "like". Be concise, specific and comprehensive.

    Go into detail about implementation of new dependencies, new features, or new components.

    If a file structure is changed, include the new file structure in the description. Using backticks and "sh" code block to draw a tree.

    Output a list of directories or files that could be ignored.
    
    At the end of the description, include a list of files with large changes (more than 100 lines):

    it is extremely important that there is a specific or general reference to every file in the diff.

    Finally output a tree with + and - and relative file paths to show how the structure has changed.
    ---
    You can use the list here to structure your thoughts:
    <FilesChangedUnderMaxFileLength>
    ${filesUnderMaxLength.join("\n")}
    </FilesChangedUnderMaxFileLength>

    <GitDiff>
    ${diff}
    </GitDiff>

    Generate a PR description:
  `;

  console.log(`Length of string sent to LLM: ${prompt.length}`);

  try {
    console.log(
      `Sending request to LLM API using model provider: ${modelProvider}...`
    );
    const model =
      modelProvider === "openai"
        ? openai("gpt-4o")
        : anthropic("claude-3-5-sonnet-20240620");
    const { text: prDescription } = await generateText({
      model,
      system: "You are a helpful assistant.",
      prompt,
    });

    console.log("PR description generated successfully");
    return prDescription;
  } catch (error) {
    console.error("Error generating PR description:", error);
    return null;
  }
}

async function main() {
  const maxLineCount = 400;
  console.log("Starting main process...");
  try {
    console.log("Getting diff from main...");
    const diff = await getDiffFromMain(maxLineCount);
    if (!diff) {
      console.log("No changes detected.");
      return;
    }

    const largeFiles = [];
    const filesUnderMaxLength = [];
    const diffLines = diff.split("\n");
    let currentFile = "";
    let lineCount = 0;

    for (const line of diffLines) {
      if (line.startsWith("File: ")) {
        if (lineCount > maxLineCount) {
          largeFiles.push(currentFile);
        } else {
          filesUnderMaxLength.push(currentFile);
        }
        currentFile = line.substring(6);
        lineCount = 0;
      } else {
        lineCount++;
      }
    }
    if (lineCount > maxLineCount) {
      largeFiles.push(currentFile);
    } else {
      filesUnderMaxLength.push(currentFile);
    }

    let readmeContent = "";
    try {
      readmeContent = await readFile("README.md", "utf-8");
      console.log("README.md content loaded successfully");
    } catch (error) {
      console.log("README.md not found or could not be read");
    }

    console.log("Generating PR description...");
    const prDescription = await generatePRDescription(
      diff,
      filesUnderMaxLength,
      readmeContent
    );
    if (!prDescription) {
      console.log("Failed to generate PR description.");
      return;
    }

    console.log("Generated PR Description:");
    console.log(prDescription);

    // Optionally, you can save the PR description to a file
    console.log("Saving PR description to file...");
    await writeFile("pr_description.md", prDescription);
    console.log("PR description saved to pr_description.md");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

console.log("Starting the application...");
main().catch(console.error);
