import readline from "node:readline";

export interface AskOptions {
  defaultValue?: string;
  secret?: boolean;
}

export interface TemplateQuestion {
  question: string;
  defaultValue: string;
  secret?: boolean;
}

export interface PromptProfileOptions {
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  wireApi?: string;
  authMethod?: string;
  reasoningEffort?: string;
  modelVerbosity?: string;
}

interface MutableReadline extends readline.Interface {
  output: NodeJS.WriteStream;
  stdoutMuted?: boolean;
  _writeToOutput?: (text: string) => void;
}

export async function ask(
  question: string,
  options: AskOptions = {},
): Promise<string> {
  const { defaultValue = "", secret = false } = options;

  return new Promise((resolve) => {
    const suffix = defaultValue ? ` [default: ${defaultValue}]` : "";
    const prompt = `${question}${suffix}: `;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    }) as MutableReadline;

    if (secret) {
      rl.stdoutMuted = false;
      rl._writeToOutput = (text: string) => {
        if (rl.stdoutMuted && text !== "\n" && text !== "\r\n") {
          rl.output.write("*");
          return;
        }

        rl.output.write(text);
      };
    }

    rl.question(prompt, (answer) => {
      rl.close();
      if (secret) {
        process.stdout.write("\n");
      }

      resolve(answer || defaultValue);
    });

    if (secret) {
      rl.stdoutMuted = true;
    }
  });
}

export async function askProfileInputs(
  name: string | undefined,
  options: PromptProfileOptions = {},
): Promise<{
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: string;
  authMethod: string;
  reasoningEffort: string;
  modelVerbosity: string;
}> {
  const authMethod =
    options.authMethod ||
    (await ask("Auth method", { defaultValue: "api_key" })).trim() ||
    "api_key";

  const resolvedName =
    (name || "").trim() || (await ask("Profile name", { defaultValue: "my-codex" }));
  const displayName =
    options.displayName ||
    (await ask("Display name", { defaultValue: resolvedName })).trim() ||
    resolvedName;
  const baseUrl =
    options.baseUrl ??
    (await ask("Base URL", { defaultValue: "https://api.openai.com/v1" }));
  const apiKey =
    authMethod === "chatgpt"
      ? options.apiKey || ""
      : options.apiKey ?? (await ask("API key (leave blank to skip)", { secret: true }));
  const model =
    options.model ?? (await ask("Default model", { defaultValue: "gpt-5" }));
  const wireApi =
    options.wireApi ??
    ((await ask("Wire API", { defaultValue: "responses" })).trim() ||
      "responses");

  return {
    name: resolvedName,
    displayName,
    baseUrl,
    apiKey,
    model,
    wireApi,
    authMethod,
    reasoningEffort: options.reasoningEffort || "",
    modelVerbosity: options.modelVerbosity || "",
  };
}

export async function askTemplateAnswers(
  placeholders: TemplateQuestion[],
): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};

  for (const placeholder of placeholders) {
    answers[placeholder.question] = await ask(placeholder.question, {
      defaultValue: placeholder.defaultValue || "",
      secret: placeholder.secret,
    });
  }

  return answers;
}
