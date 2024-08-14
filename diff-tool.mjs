import escape from "shell-escape";
import { execSync } from "child_process";
import { readFile } from "fs/promises";
import readline from "readline";
import { generateTextWithModel } from "./utils.mjs";

function getDiffFromMain(maxDiffSize = 1000) {
  console.log("Getting diff from main branch...");
  const diffCommand = `
    git diff main --name-only | grep -vE 'package-lock.json|yarn.lock|pnpm-lock.yaml|public/.*\\.(css|js)|\\.min\\.|^\\.yarn/' | while read file; do
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
    const { text: prDescription } = await generateTextWithModel({
      prompt,
    });

    console.log("PR description generated successfully");

    const titlePrompt = `
      Based on the following PR description, generate a concise and informative title for the pull request:
      ---
      ${prDescription}
      ---
      Generate a PR title:
    `;

    const { text: prTitle } = await generateTextWithModel({
      prompt: titlePrompt,
    });

    console.log("PR title generated successfully");
    return { prDescription, prTitle };
  } catch (error) {
    console.error("Error generating PR description or title:", error);
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
    const prData = await generatePRDescription(
      diff,
      filesUnderMaxLength,
      readmeContent
    );
    if (!prData) {
      console.log("Failed to generate PR description and title.");
      return;
    }

    const { prDescription, prTitle } = prData;

    console.log("Generated PR Description:");
    console.log(prDescription);

    console.log("Generated PR Title:");
    console.log(prTitle);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

console.log("Starting the application...");
main().catch(console.error);
