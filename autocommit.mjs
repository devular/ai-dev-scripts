import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import readline from "readline";
import shellEscape from "shell-escape";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { generateTextWithModel } from "./utils.mjs";

const argv = yargs(hideBin(process.argv))
  .option("skip-context", {
    alias: "s",
    type: "boolean",
    description: "Skip inputting extra context for the prompt",
  })
  .option("no-verify", {
    alias: "n",
    type: "boolean",
    description: "Skip the confirmation step",
  }).argv;

// Get the diff of the files to the last commit
try {
  execSync("git add .", { cwd: process.cwd() });
} catch (error) {
  console.error(error);
  process.exit(1);
}
const diff = execSync(
  "git diff --staged ':(exclude)package-lock.json' ':(exclude)yarn.lock' ':(exclude)pnpm-lock.yaml' ':(exclude)dist/**' ':(exclude).yarn/plugins/**'",
  {
    cwd: process.cwd(),
  }
).toString();
const diffFiles = diff.split("\n").filter((f) => f.length > 0);

// Read the README file if it exists
let readmeContent = "";
const readmePath = resolve(process.cwd(), "README.md");
if (existsSync(readmePath)) {
  readmeContent = readFileSync(readmePath, "utf-8");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

if (argv.skipContext) {
  processCommit("");
} else {
  rl.question(
    "Please write a short description of the changes you have made: ",
    (answer) => {
      rl.close();
      processCommit(answer);
    }
  );
}

async function processCommit(answer) {
  const inputPrompt = `To write conventional commits, follow the structure provided below:
  <type>[optional scope]: <description>
  [optional body]
  [optional footer(s)]
  
  Any responses that do not follow the above structure will be rejected. It is extremely important to follow the structure consistently and choose appropriate types to accurately describe the changes in your codebase.
  
  Key points to keep in mind:
  1. Use a specific \`type\` at the beginning of your commit message to categorize the change. Recommended types:
     - \`fix\`: for bug fixes
     - \`feat\`: for introducing new features
     Other types: \`build\`, \`chore\`, \`docs\`, \`style\`, \`refactor\`, \`perf\`, \`test\`, etc.
  2. Optionally, include a \`scope\` in parentheses after the type to provide additional context.
  3. Write a short and concise \`description\` of the code changes.
  4. Optionally, include a more detailed \`body\` section to provide additional context about the changes.
  5. Optionally, include one or more \`footer\` sections below the body, containing relevant information like references, issues addressed, or breaking changes.
  
  Rules:
  - Use a colon and space after the type/scope prefix, as well as after the description.
  - Separate the body from the description and each footer with a blank line.
  - Use hyphens (\`-\`) in the footers' tokens (except for \`BREAKING CHANGE\`), and separate them from values with a colon (\`:\`) or a hash (\`#\`) character.
  
  Pure Example - never use this in the output:
  <Example>
  feat: Update terminology in auto-commit script
  - Changes made: Replaced the term "retreats" with "stays" in the user instructions for commit messages
  Implementation reason: The terminology change reflects the application's updated focus on facilitating business booking for remote work stays rather than retreats. This change provides more clarity for users interacting with the application's commit system.
  - File changed: scripts/auto-commit.ts 
  </Example>
  
  Benefits of conventional commits:
  - Automated changelog generation
  - Semantic versioning support
  - Clear communication of changes
  - Easier collaboration with others
  
  Instructions:
  Using the conventional commits system, please write a git commit message based on the following git diff output:
  The user has added some context about the changes they have made: ${answer}.
  Here's some context about this project from its README:
  ${readmeContent}
  In the conventional commit body, include a bullet list of files changed after a simple description of what has changed, deleted, or been added. Do not include the code.
  
  Diff begins:
  :\n\n${diffFiles}. '\nDiff ends.\n
  
  Remember:
  - Do not include "Commit Message:" in your commit message. 
  - Take a guess as to why this code is being implemented (considering the user-provided context), and label it: Implementation reason:
  - Incredibly important: Do not use "likely" or "probably" in your commit message or implimentation reason. Write authoritavely. If it is inaccurate the user will amend it of their own accord.
  
  Important:
  - The output will be piped directly into the commit message, so skip prose, introductions, and postscripts.
  - Do not wrap the output in code tags or prefix the output with "Commit message:".
  `;

  try {
    const { text: message } = await generateTextWithModel({
      prompt: inputPrompt,
    });

    console.log(`\n\nCommit message output:\n\n${message}`);

    if (argv.noVerify) {
      executeCommit(message);
    } else {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("Do you want to commit these changes? (y/n) ", (answer) => {
        if (answer === "y") {
          executeCommit(message);
        }
        rl.close();
      });
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function executeCommit(message) {
  const escapedMessage = shellEscape([message]);
  try {
    execSync(`git commit -am ${escapedMessage}`, { cwd: process.cwd() });
    console.log("Changes committed successfully.");
  } catch (error) {
    console.error("Error committing changes:", error);
    process.exit(1);
  }
}
