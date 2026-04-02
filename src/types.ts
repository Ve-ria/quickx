export type AuthMethod = "api_key" | "chatgpt";
export type WireApi = "responses" | "chat";
export type LoginMethod = "browser" | "device";

export interface CodexProfile {
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: WireApi;
  authMethod: AuthMethod;
  reasoningEffort: string;
  modelVerbosity: string;
  templateId?: string;
  codexTomlContent?: string;
}

export interface ProfileInput {
  name: string;
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  wireApi?: string;
  authMethod?: string;
  reasoningEffort?: string;
  modelVerbosity?: string;
}

export interface StoreData {
  activeProfile: string;
  profiles: CodexProfile[];
}

export interface ListProfilesResult {
  activeProfile: string;
  profiles: CodexProfile[];
}

export interface StatusInfo {
  activeProfile: string;
  configFile: string;
  codexConfigFile: string;
  authFile: string;
  loggedInEmail: string;
  profiles: CodexProfile[];
}

export interface DeviceCode {
  deviceAuthId: string;
  userCode: string;
  verificationUrl: string;
  interval: number;
}

export interface DeviceCodeInfo {
  handleId: string;
  userCode: string;
  verificationUrl: string;
}

export interface BrowserLoginInfo {
  handleId: string;
  authUrl: string;
}

export interface LoginResult {
  name: string;
  displayName: string;
}

export interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token: string;
}

export interface BrowserLoginSession {
  authUrl: string;
  wait: () => Promise<void>;
}

export interface Template {
  id: string;
  displayName: string;
  scope: string[];
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: string;
  authMethod: string;
  docsUrl: string;
  requiredEnvs: string[];
  reasoningEffort: string;
  modelVerbosity: string;
  codexTomlFile: string;
  codexTomlContent: string;
}

export interface TemplatePlaceholder {
  full: string;
  question: string;
  defaultValue: string;
  secret: boolean;
}

export interface TemplateSetup {
  placeholders: TemplatePlaceholder[];
}

export interface AuthFileData {
  auth_mode?: string;
  OPENAI_API_KEY?: string;
  tokens?: {
    id_token: string;
    access_token: string;
    refresh_token: string;
    account_id?: string;
  };
  last_refresh?: string;
}

export type AddFieldKey =
  | "name"
  | "displayName"
  | "baseUrl"
  | "apiKey"
  | "model"
  | "wireApi"
  | "authMethod";

export type EditFieldKey =
  | "displayName"
  | "baseUrl"
  | "apiKey"
  | "model"
  | "wireApi"
  | "authMethod";

export interface AddDraft {
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: string;
  authMethod: string;
}

export interface EditDraft {
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: string;
  authMethod: string;
}

export interface LoginDraft {
  name: string;
  method: LoginMethod;
}

export interface FormFieldDefinition<Key extends string> {
  key: Key;
  label: string;
  placeholder: string;
  secret: boolean;
}
