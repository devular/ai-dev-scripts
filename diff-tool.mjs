import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Load environment variables from .env in the current working directory
dotenv.config();
console.log("Loaded environment variables from current working directory");

// If ANTHROPIC_API_KEY is not found, try loading from the script's directory
if (!process.env.ANTHROPIC_API_KEY) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.join(__dirname, ".env") });
  console.log("Attempted to load ANTHROPIC_API_KEY from script directory");
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Please set the ANTHROPIC_API_KEY environment variable.");
  process.exit(1);
}

console.log("ANTHROPIC_API_KEY found, initializing Anthropic client");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getDiffFromMain(maxDiffSize = 1000) {
  console.log("Getting diff from main branch...");
  const diffCommand = `
    git diff main --name-only | while read file; do
      echo "File: $file";
      git diff main -- "$file" | awk -v max=${maxDiffSize} '
        NR <= max {print} 
        NR == max+1 {print "... (diff truncated due to size)"; exit}
      ';
      echo;
    done
  `;
  return new Promise((resolve, reject) => {
    exec(
      diffCommand,
      { maxBuffer: 100 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Error getting diff:", error);
          reject(error);
        } else {
          console.log("Diff successfully retrieved");
          resolve(stdout);
        }
      }
    );
  });
}

async function generatePRDescription(diff, filesUnderMaxLength, readmeContent) {
  console.log("Generating PR description...");
  const prompt = `
    You are an expert developer and technical writer. Based on the following git diff, 
    please generate a concise and informative pull request description. A good pull request, documents the changes
    in the repository, with a reference to internal decisions in each file. Any new dependencies are referenced
    and explained in detail, especially at their implimentatin site.
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
    Files changed under max file length:
    ${filesUnderMaxLength.join("\n")}

    Git Diff:
    ${diff}

    Generate a PR description:
  `;

  console.log(`Length of string sent to Anthropic: ${prompt.length}`);

  try {
    console.log("Sending request to Anthropic API...");
    const completion = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    console.log("PR description generated successfully");
    return completion.content[0].text;
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
      readmeContent = await fs.readFile("README.md", "utf-8");
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
    await fs.writeFile("pr_description.md", prDescription);
    console.log("PR description saved to pr_description.md");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

console.log("Starting the application...");
main().catch(console.error);
