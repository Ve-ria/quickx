import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProfileInput, Template, TemplatePlaceholder, TemplateSetup } from "../types.js";
import { configHome } from "./paths.js";

const REGISTRY_OWNER = "AmethystDev-Labs";
const REGISTRY_REPO = "QuickCLI";
const REGISTRY_BRANCH = "main";
const REGISTRY_PATH = "templates";
const REGISTRY_API_URL = `https://api.github.com/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/contents/${REGISTRY_PATH}?ref=${REGISTRY_BRANCH}`;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAGIC_RE = /\$\{--:"([^"]+)"(?::"([^"]*)")?\}/g;

interface RegistryEntry {
  name: string;
  type: string;
}

const builtinTemplates: Template[] = [
  {
    id: "openai",
    displayName: "OpenAI (official)",
    scope: ["codex"],
    baseUrl: "https://api.openai.com/v1",
    apiKey: '${--:"OpenAI API Key":""}',
    model: '${--:"Default model":"gpt-4o"}',
    wireApi: "responses",
    authMethod: "api_key",
    docsUrl: "https://platform.openai.com/docs",
    requiredEnvs: [],
    reasoningEffort: '${--:"Reasoning effort (minimal/low/medium/high/xhigh)":"high"}',
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "amethyst",
    displayName: "Amethyst API",
    scope: ["codex"],
    baseUrl: "https://api.amethyst.ltd/v1",
    apiKey: '${--:"Amethyst API Key":""}',
    model: '${--:"Default model":"gpt-5.4"}',
    wireApi: "responses",
    authMethod: "api_key",
    docsUrl: "https://amethyst.ltd",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "privnode",
    displayName: "Privnode",
    scope: ["codex"],
    baseUrl: '${--:"Privnode base URL":"https://privnode.com/v1"}',
    apiKey: '${--:"Privnode API Key":""}',
    model: '${--:"Default model":"gpt-5-codex"}',
    wireApi: "responses",
    authMethod: "api_key",
    docsUrl: "https://privnode.com/docs",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "azure-openai",
    displayName: "Azure OpenAI",
    scope: ["codex"],
    baseUrl:
      '${--:"Azure endpoint (e.g. https://<name>.openai.azure.com/openai/deployments/<deploy>)":""}',
    apiKey: '${--:"Azure API Key":""}',
    model: '${--:"Deployment / model name":"gpt-4o"}',
    wireApi: "chat",
    authMethod: "api_key",
    docsUrl: "https://learn.microsoft.com/azure/ai-services/openai/",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "ollama",
    displayName: "Ollama (local)",
    scope: ["codex"],
    baseUrl: '${--:"Ollama base URL":"http://localhost:11434/v1"}',
    apiKey: "ollama",
    model: '${--:"Model name":"llama3"}',
    wireApi: "chat",
    authMethod: "api_key",
    docsUrl: "https://ollama.com",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "lmstudio",
    displayName: "LM Studio (local)",
    scope: ["codex"],
    baseUrl: '${--:"LM Studio base URL":"http://localhost:1234/v1"}',
    apiKey: "lm-studio",
    model: '${--:"Model identifier":""}',
    wireApi: "chat",
    authMethod: "api_key",
    docsUrl: "https://lmstudio.ai",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "imsnake",
    displayName: "ImSnake",
    scope: ["codex"],
    baseUrl: "https://imsnake.dart.us.ci/v1",
    apiKey: '${--:"ImSnake API Key":""}',
    model: '${--:"Default model":"gpt-5.4"}',
    wireApi: "responses",
    authMethod: "api_key",
    docsUrl: "https://imsnake.dart.us.ci",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
  {
    id: "ame_event",
    displayName: "AmeEvent",
    scope: ["codex"],
    baseUrl: "https://cx-nya.zeabur.app/v1",
    apiKey: "AmethystLabs",
    model: '${--:"Default model":"gpt-5.4"}',
    wireApi: "responses",
    authMethod: "api_key",
    docsUrl: "",
    requiredEnvs: [],
    reasoningEffort: "",
    modelVerbosity: "",
    codexTomlFile: "",
    codexTomlContent: "",
  },
];

function cacheDir(): string {
  return path.join(configHome(), "template-cache");
}

function cacheIndexPath(): string {
  return path.join(cacheDir(), "index.json");
}

function withDefaults(input: Partial<Template>): Template {
  return {
    id: String(input.id || ""),
    displayName: String(input.displayName || input.id || ""),
    scope: Array.isArray(input.scope) ? input.scope.map(String) : [],
    baseUrl: String(input.baseUrl || ""),
    apiKey: String(input.apiKey || ""),
    model: String(input.model || ""),
    wireApi: String(input.wireApi || ""),
    authMethod: String(input.authMethod || ""),
    docsUrl: String(input.docsUrl || ""),
    requiredEnvs: Array.isArray(input.requiredEnvs)
      ? input.requiredEnvs.map(String)
      : [],
    reasoningEffort: String(input.reasoningEffort || ""),
    modelVerbosity: String(input.modelVerbosity || ""),
    codexTomlFile: String(input.codexTomlFile || ""),
    codexTomlContent: String(input.codexTomlContent || ""),
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseTemplateYaml(content: string): Template {
  const lines = content.split(/\r?\n/u);
  const raw: Record<string, unknown> = {};
  let currentListKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/u);
    if (listMatch && currentListKey) {
      const list = (raw[currentListKey] as string[] | undefined) || [];
      list.push(unquote(listMatch[1] || ""));
      raw[currentListKey] = list;
      continue;
    }

    currentListKey = "";
    const keyMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/u);
    if (!keyMatch) {
      continue;
    }

    const [, key, value] = keyMatch;
    if (value === "") {
      raw[key] = [];
      currentListKey = key;
      continue;
    }

    raw[key] = unquote(value);
  }

  return withDefaults({
    id: raw.id as string,
    displayName: raw.display_name as string,
    scope: raw.scope as string[],
    baseUrl: raw.base_url as string,
    apiKey: raw.api_key as string,
    model: raw.model as string,
    wireApi: raw.wire_api as string,
    authMethod: raw.auth_method as string,
    docsUrl: raw.docs_url as string,
    requiredEnvs: raw.required_envs as string[],
    reasoningEffort: raw.reasoning_effort as string,
    modelVerbosity: raw.model_verbosity as string,
    codexTomlFile: raw.codex_toml_file as string,
  });
}

function mergeTemplates(base: Template[], remote: Template[]): Template[] {
  const byId = new Map<string, Template>();
  const order: string[] = [];

  for (const template of base) {
    byId.set(template.id, template);
    order.push(template.id);
  }

  for (const template of remote) {
    if (!byId.has(template.id)) {
      order.push(template.id);
    }
    byId.set(template.id, template);
  }

  return order
    .map((id) => byId.get(id))
    .filter((template): template is Template => Boolean(template))
    .filter((template) => template.scope.includes("codex"));
}

function loadCache(): Template[] | null {
  try {
    const info = statSync(cacheIndexPath());
    if (Date.now() - info.mtimeMs > CACHE_TTL_MS) {
      return null;
    }

    const data = JSON.parse(readFileSync(cacheIndexPath(), "utf8")) as Template[];
    return Array.isArray(data) ? data.map(withDefaults) : null;
  } catch {
    return null;
  }
}

function saveCache(templates: Template[]): void {
  try {
    mkdirSync(cacheDir(), { recursive: true, mode: 0o700 });
    writeFileSync(cacheIndexPath(), JSON.stringify(templates, null, 2), {
      mode: 0o600,
    });
  } catch {
    // ignore cache failures
  }
}

async function httpGetJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "quickx/quickx",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText})`);
  }

  return (await response.json()) as T;
}

async function httpGetText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "quickx/quickx",
      accept: "text/plain, text/yaml, application/x-yaml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText})`);
  }

  return await response.text();
}

async function fetchTemplate(id: string, loadFiles: boolean): Promise<Template> {
  const rawUrl = `https://raw.githubusercontent.com/${REGISTRY_OWNER}/${REGISTRY_REPO}/${REGISTRY_BRANCH}/${REGISTRY_PATH}/${id}/template.yaml`;
  const template = parseTemplateYaml(await httpGetText(rawUrl));
  if (!template.id) {
    template.id = id;
  }

  if (loadFiles && template.codexTomlFile) {
    const tomlUrl = `https://raw.githubusercontent.com/${REGISTRY_OWNER}/${REGISTRY_REPO}/${REGISTRY_BRANCH}/${REGISTRY_PATH}/${id}/${template.codexTomlFile}`;
    try {
      template.codexTomlContent = await httpGetText(tomlUrl);
    } catch {
      template.codexTomlContent = "";
    }
  }

  return template;
}

async function fetchFromGitHub(): Promise<Template[]> {
  const entries = await httpGetJson<RegistryEntry[]>(REGISTRY_API_URL);
  const templates: Template[] = [];

  for (const entry of entries) {
    if (entry.type !== "dir") {
      continue;
    }

    try {
      const template = await fetchTemplate(entry.name, false);
      templates.push(template);
    } catch {
      // skip broken templates
    }
  }

  saveCache(templates);
  return templates;
}

export async function listTemplates(): Promise<Template[]> {
  try {
    const remote = await fetchFromGitHub();
    if (remote.length > 0) {
      return mergeTemplates(builtinTemplates, remote);
    }
  } catch {
    // fall through
  }

  const cached = loadCache();
  if (cached && cached.length > 0) {
    return mergeTemplates(builtinTemplates, cached);
  }

  return builtinTemplates.filter((template) => template.scope.includes("codex"));
}

export async function fetchTemplateById(idOrUrl: string): Promise<Template> {
  if (/^https?:\/\//u.test(idOrUrl)) {
    return parseTemplateYaml(await httpGetText(idOrUrl));
  }

  const builtin = builtinTemplates.find((template) => template.id === idOrUrl);
  if (builtin) {
    return withDefaults(builtin);
  }

  return fetchTemplate(idOrUrl, true);
}

export function findPlaceholders(value: string): TemplatePlaceholder[] {
  const placeholders: TemplatePlaceholder[] = [];
  const seen = new Set<string>();
  for (const match of value.matchAll(MAGIC_RE)) {
    const full = match[0] || "";
    if (seen.has(full)) {
      continue;
    }
    seen.add(full);
    placeholders.push({
      full,
      question: match[1] || "",
      defaultValue: match[2] || "",
      secret: /api key|token|secret|password/i.test(match[1] || ""),
    });
  }
  return placeholders;
}

export function getTemplateSetup(template: Template): TemplateSetup {
  const fields = [
    template.baseUrl,
    template.apiKey,
    template.model,
    template.reasoningEffort,
    template.modelVerbosity,
  ];

  const placeholders: TemplatePlaceholder[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    for (const placeholder of findPlaceholders(field)) {
      if (seen.has(placeholder.full)) {
        continue;
      }
      seen.add(placeholder.full);
      placeholders.push(placeholder);
    }
  }

  return { placeholders };
}

export function substituteTemplateValue(
  value: string,
  answers: Record<string, string>,
): string {
  return value.replaceAll(MAGIC_RE, (_, question: string, fallback: string) => {
    if (Object.hasOwn(answers, question)) {
      return answers[question] || "";
    }
    return fallback || "";
  });
}

export function createProfileFromTemplate(
  name: string,
  template: Template,
  answers: Record<string, string>,
): ProfileInput {
  return {
    name,
    displayName: template.displayName || name,
    baseUrl: substituteTemplateValue(template.baseUrl, answers),
    apiKey: substituteTemplateValue(template.apiKey, answers),
    model: substituteTemplateValue(template.model, answers),
    wireApi: template.wireApi,
    authMethod: template.authMethod,
    reasoningEffort: substituteTemplateValue(template.reasoningEffort, answers),
    modelVerbosity: substituteTemplateValue(template.modelVerbosity, answers),
  };
}
