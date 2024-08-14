# Git Automation Tools

This repository contains two powerful Git automation tools: `diff-tool.mjs` and `autocommit.mjs`. These tools help streamline your Git workflow by generating pull request descriptions and automating commit messages.

## Installation

1. Clone the repository to your local machine:

   ```sh
   git clone git@github.com:devular/ai-dev-scripts.git
   cd ai-dev-scripts
   ```

2. Set up the environment:

   - Create a `.env` file in the root directory of the project.
   - Add your API keys and choose your model provider:
     ```
     ANTHROPIC_API_KEY=your_anthropic_api_key_here
     OPENAI_API_KEY=your_openai_api_key_here
     MODEL_PROVIDER=anthropic  # or 'openai'
     ```
   - Set `MODEL_PROVIDER` to either `anthropic` or `openai` to choose which AI model to use.

3. Install dependencies:

   ```sh
   pnpm install
   ```

4. Set up aliases for easy access:

   For Bash or Zsh, add the following to your `~/.bashrc` or `~/.zshrc`:

   ```sh
   alias autocommit='node /path/to/git-automation-tools/autocommit.mjs'
   alias difftool='node /path/to/git-automation-tools/diff-tool.mjs'
   ```

   For Fish, add the following to your `~/.config/fish/config.fish`:

   ```sh
   alias autocommit='node /path/to/git-automation-tools/autocommit.mjs'
   alias difftool='node /path/to/git-automation-tools/diff-tool.mjs'
   ```

   Replace `/path/to/git-automation-tools/` with the actual path where you cloned the repository.

5. Reload your shell configuration or restart your terminal.

## Usage

### Choosing the AI Model

The tools support both Anthropic's Claude and OpenAI's GPT models using the Vercel AI SDK. To choose which model to use:

1. Open the `.env` file in the root directory of the project.
2. Set the `MODEL_PROVIDER` variable to either `anthropic` or `openai`.
3. Ensure you have the corresponding API key set (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`).

The tools will automatically use the selected model for generating commit messages and pull request descriptions.

### Autocommit

To use the autocommit tool:

1. Make changes to your Git repository.
2. Run the following command:
   ```sh
   autocommit
   ```
3. Follow the prompts to provide a short description of your changes.
4. The tool will generate a commit message following the Conventional Commits format.

Options:

- `--skip-context` or `-s`: Skip inputting extra context for the prompt.
- `--no-verify` or `-n`: Skip the confirmation step.

### Diff Tool

To use the diff tool for generating pull request descriptions:

1. Make sure you have changes in your repository compared to the main branch.
2. Run the following command:
   ```sh
   difftool
   ```
3. The tool will generate a pull request description based on the differences between your current branch and the main branch.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
