import React from "react";
import { Box, Text, useApp, useInput } from "ink";

import type { QuickxApi } from "../api.js";
import type {
  ListProfilesResult,
  StatusInfo,
  Template,
  TemplatePlaceholder,
} from "../types.js";
import { getTemplateSetup } from "../lib/templates.js";
import {
  addFieldDefs,
  defaultAddDraft,
  defaultLoginDraft,
  defaultEditDraft,
  editFieldDefs,
  isPrintableInput,
  nextFieldIndex,
  prevFieldIndex,
  profileToEditDraft,
} from "../lib/tui.js";
import { messageOf, openBrowser } from "../lib/utils.js";
import { StatusScreen } from "./screens/StatusScreen.js";
import { ProfilesScreen } from "./screens/ProfilesScreen.js";
import { TemplatesScreen } from "./screens/TemplatesScreen.js";
import { AddProfileForm } from "./forms/AddProfileForm.js";
import { EditProfileForm } from "./forms/EditProfileForm.js";
import { LoginForm } from "./forms/LoginForm.js";
import { ConfirmDeleteForm } from "./forms/ConfirmDeleteForm.js";
import { TemplateAddForm } from "./forms/TemplateAddForm.js";

type Tab = "status" | "profiles" | "templates";
type Mode = "browse" | "add" | "edit" | "login" | "confirm-delete" | "template-add";

export function App({ api }: { api: QuickxApi }): React.JSX.Element {
  const { exit } = useApp();
  const [tab, setTab] = React.useState<Tab>("status");
  const [mode, setMode] = React.useState<Mode>("browse");
  const [status, setStatus] = React.useState<StatusInfo>(api.status());
  const [profileResult, setProfileResult] = React.useState<ListProfilesResult>(
    api.listProfiles(),
  );
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [selectedProfile, setSelectedProfile] = React.useState(0);
  const [selectedTemplate, setSelectedTemplate] = React.useState(0);
  const [previewCache, setPreviewCache] = React.useState<Record<string, Template>>({});
  const [message, setMessage] = React.useState("Ready");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ draft: defaultAddDraft(), fieldIndex: 0 });
  const [editForm, setEditForm] = React.useState({ profileName: "", draft: defaultEditDraft(), fieldIndex: 0 });
  const [loginForm, setLoginForm] = React.useState({ draft: defaultLoginDraft(), fieldIndex: 0 });
  const [templateForm, setTemplateForm] = React.useState<{
    id: string; name: string; placeholders: TemplatePlaceholder[];
    answers: Record<string, string>; fieldIndex: number;
  }>({ id: "", name: "", placeholders: [], answers: {}, fieldIndex: 0 });
  const [confirmDeleteName, setConfirmDeleteName] = React.useState("");

  const stateRef = React.useRef({
    tab,
    mode,
    profiles: profileResult.profiles,
    activeProfile: profileResult.activeProfile,
    selectedProfile,
    selectedProfileRow: profileResult.profiles[selectedProfile] ?? null,
    templates,
    selectedTemplate,
    selectedTemplateRow: templates[selectedTemplate] ?? null,
    addForm,
    editForm,
    loginForm,
    templateForm,
    confirmDeleteName,
  });

  stateRef.current = {
    tab,
    mode,
    profiles: profileResult.profiles,
    activeProfile: profileResult.activeProfile,
    selectedProfile,
    selectedProfileRow: profileResult.profiles[selectedProfile] ?? null,
    templates,
    selectedTemplate,
    selectedTemplateRow: templates[selectedTemplate] ?? null,
    addForm,
    editForm,
    loginForm,
    templateForm,
    confirmDeleteName,
  };

  const refreshAbortRef = React.useRef<AbortController | null>(null);
  const previewPendingRef = React.useRef(new Set<string>());

  const refresh = React.useCallback(async () => {
    refreshAbortRef.current?.abort();
    const abort = new AbortController();
    refreshAbortRef.current = abort;

    try {
      setStatus(api.status());
      const next = api.listProfiles();
      setProfileResult(next);
      setSelectedProfile((i) => Math.min(i, Math.max(0, next.profiles.length - 1)));

      if (stateRef.current.tab === "templates") {
        const rows = await api.listTemplates();
        if (abort.signal.aborted) return;
        setTemplates(rows);
        setSelectedTemplate((i) => Math.min(i, Math.max(0, rows.length - 1)));
      }
      if (!abort.signal.aborted) setError("");
    } catch (err) {
      if (!abort.signal.aborted) setError(messageOf(err));
    }
  }, [api]);

  React.useEffect(() => {
    void refresh();
  }, []);

  React.useEffect(() => {
    if (tab !== "templates") return;
    void api
      .listTemplates()
      .then((rows) => {
        setTemplates(rows);
        setSelectedTemplate((i) => Math.min(i, Math.max(0, rows.length - 1)));
      })
      .catch((err) => setError(messageOf(err)));
  }, [api, tab]);

  React.useEffect(() => {
    const row = templates[selectedTemplate];
    if (tab !== "templates" || !row || previewCache[row.id] || previewPendingRef.current.has(row.id)) return;
    previewPendingRef.current.add(row.id);
    void api
      .previewTemplate(row.id)
      .then((preview) => {
        previewPendingRef.current.delete(row.id);
        setPreviewCache((c) => ({ ...c, [row.id]: preview }));
        setError("");
      })
      .catch((err) => {
        previewPendingRef.current.delete(row.id);
        setError(messageOf(err));
      });
  }, [api, tab, selectedTemplate, templates]);

  const openAddForm = () => {
    setMode("add");
    setAddForm({ draft: defaultAddDraft(), fieldIndex: 0 });
    setMessage("Add profile form");
    setError("");
  };

  const openEditForm = () => {
    const row = stateRef.current.selectedProfileRow;
    if (!row) { setError("No profile selected"); return; }
    setMode("edit");
    setEditForm({ profileName: row.name, draft: profileToEditDraft(row), fieldIndex: 0 });
    setMessage(`Edit profile: ${row.name}`);
    setError("");
  };

  const openLoginForm = () => {
    setMode("login");
    setLoginForm({ draft: defaultLoginDraft(), fieldIndex: 0 });
    setMessage("Codex login form");
    setError("");
  };

  const openTemplateAdd = (template: Template) => {
    const setup = getTemplateSetup(template);
    const initialAnswers: Record<string, string> = {};
    for (const p of setup.placeholders) initialAnswers[p.question] = p.defaultValue;
    setTemplateForm({ id: template.id, name: template.id, placeholders: setup.placeholders, answers: initialAnswers, fieldIndex: 0 });
    setMode("template-add");
    setMessage(`Create profile from template: ${template.displayName || template.id}`);
    setError("");
  };

  const submitAddForm = () => {
    try {
      const d = addForm.draft;
      const created = api.addProfile({
        name: d.name.trim() || "my-codex",
        displayName: d.displayName.trim() || d.name.trim() || "my-codex",
        baseUrl: d.baseUrl.trim(),
        apiKey: d.apiKey,
        model: d.model.trim(),
        wireApi: d.wireApi.trim() || "responses",
        authMethod: d.authMethod.trim() || "api_key",
      });
      setMode("browse");
      setTab("profiles");
      setMessage(`Profile "${created.name}" added`);
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const submitEditForm = () => {
    try {
      const d = editForm.draft;
      const updated = api.updateProfile({
        name: editForm.profileName,
        displayName: d.displayName.trim() || editForm.profileName,
        baseUrl: d.baseUrl.trim(),
        apiKey: d.apiKey,
        model: d.model.trim(),
        wireApi: d.wireApi.trim() || "responses",
        authMethod: d.authMethod.trim() || "api_key",
      });
      if (profileResult.activeProfile === updated.name) api.useProfile(updated.name);
      setMode("browse");
      setTab("profiles");
      setMessage(`Profile "${updated.name}" updated`);
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const submitLoginForm = async () => {
    setLoading(true);
    try {
      const { name: desiredName, method } = stateRef.current.loginForm.draft;
      if (method === "device") {
        const pending = await api.loginCodexRequestDevice();
        setMessage(`Device code: ${pending.userCode} | URL: ${pending.verificationUrl}`);
        const created = await api.loginCodexCompleteDevice(pending.handleId, desiredName);
        setMessage(`Login complete, created "${created.name}"`);
      } else {
        const pending = await api.loginCodexBrowserStart();
        setMessage(
          openBrowser(pending.authUrl)
            ? `Browser opened: ${pending.authUrl}`
            : `Open this URL: ${pending.authUrl}`,
        );
        const created = await api.loginCodexBrowserWait(pending.handleId, desiredName);
        setMessage(`Login complete, created "${created.name}"`);
      }
      setMode("browse");
      setTab("profiles");
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  const submitTemplateAdd = async () => {
    setLoading(true);
    try {
      const { id, name, answers } = stateRef.current.templateForm;
      const created = await api.createProfileFromTemplate(
        name.trim() || id,
        id,
        answers,
      );
      setMode("browse");
      setTab("profiles");
      setMessage(`Profile "${created.name}" created from template`);
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    const c = stateRef.current;
    const ctrl = Boolean(key.ctrl);

    if (c.mode === "add") {
      if (key.escape) { setMode("browse"); setMessage("Canceled add profile"); return; }
      if (key.upArrow) { setAddForm((f) => ({ ...f, fieldIndex: prevFieldIndex(f.fieldIndex, addFieldDefs.length) })); return; }
      if (key.downArrow || key.return) { setAddForm((f) => ({ ...f, fieldIndex: nextFieldIndex(f.fieldIndex, addFieldDefs.length) })); return; }
      if (ctrl && input === "s") { submitAddForm(); return; }
      if (key.backspace || key.delete) {
        const fk = addFieldDefs[c.addForm.fieldIndex]?.key;
        if (fk) setAddForm((f) => ({ ...f, draft: { ...f.draft, [fk]: f.draft[fk].slice(0, Math.max(0, f.draft[fk].length - 1)) } }));
        return;
      }
      if (isPrintableInput(input, key)) {
        const fk = addFieldDefs[c.addForm.fieldIndex]?.key;
        if (fk) setAddForm((f) => ({ ...f, draft: { ...f.draft, [fk]: `${f.draft[fk]}${input}` } }));
      }
      return;
    }

    if (c.mode === "edit") {
      if (key.escape) { setMode("browse"); setMessage("Canceled edit profile"); return; }
      if (key.upArrow) { setEditForm((f) => ({ ...f, fieldIndex: prevFieldIndex(f.fieldIndex, editFieldDefs.length) })); return; }
      if (key.downArrow || key.return) { setEditForm((f) => ({ ...f, fieldIndex: nextFieldIndex(f.fieldIndex, editFieldDefs.length) })); return; }
      if (ctrl && input === "s") { submitEditForm(); return; }
      if (key.backspace || key.delete) {
        const fk = editFieldDefs[c.editForm.fieldIndex]?.key;
        if (fk) setEditForm((f) => ({ ...f, draft: { ...f.draft, [fk]: f.draft[fk].slice(0, Math.max(0, f.draft[fk].length - 1)) } }));
        return;
      }
      if (isPrintableInput(input, key)) {
        const fk = editFieldDefs[c.editForm.fieldIndex]?.key;
        if (fk) setEditForm((f) => ({ ...f, draft: { ...f.draft, [fk]: `${f.draft[fk]}${input}` } }));
      }
      return;
    }

    if (c.mode === "login") {
      if (key.escape) { setMode("browse"); setMessage("Canceled login"); return; }
      if (key.upArrow) { setLoginForm((f) => ({ ...f, fieldIndex: prevFieldIndex(f.fieldIndex, 2) })); return; }
      if (key.downArrow || key.return) { setLoginForm((f) => ({ ...f, fieldIndex: nextFieldIndex(f.fieldIndex, 2) })); return; }
      if (ctrl && input === "s") { void submitLoginForm(); return; }
      if (c.loginForm.fieldIndex === 1 && (key.leftArrow || key.rightArrow || input === "m")) {
        setLoginForm((f) => ({ ...f, draft: { ...f.draft, method: f.draft.method === "browser" ? "device" : "browser" } }));
        return;
      }
      if (c.loginForm.fieldIndex === 0) {
        if (key.backspace || key.delete) { setLoginForm((f) => ({ ...f, draft: { ...f.draft, name: f.draft.name.slice(0, Math.max(0, f.draft.name.length - 1)) } })); return; }
        if (isPrintableInput(input, key)) setLoginForm((f) => ({ ...f, draft: { ...f.draft, name: `${f.draft.name}${input}` } }));
      }
      return;
    }

    if (c.mode === "template-add") {
      const totalFields = 1 + c.templateForm.placeholders.length;
      if (key.escape) { setMode("browse"); setMessage("Canceled template add"); return; }
      if (key.upArrow) { setTemplateForm((f) => ({ ...f, fieldIndex: prevFieldIndex(f.fieldIndex, totalFields) })); return; }
      if (key.downArrow || key.return) { setTemplateForm((f) => ({ ...f, fieldIndex: nextFieldIndex(f.fieldIndex, totalFields) })); return; }
      if (ctrl && input === "s") { void submitTemplateAdd(); return; }
      if (key.backspace || key.delete) {
        if (c.templateForm.fieldIndex === 0) {
          setTemplateForm((f) => ({ ...f, name: f.name.slice(0, Math.max(0, f.name.length - 1)) }));
        } else {
          const ph = c.templateForm.placeholders[c.templateForm.fieldIndex - 1];
          if (ph) setTemplateForm((f) => ({ ...f, answers: { ...f.answers, [ph.question]: (f.answers[ph.question] ?? "").slice(0, Math.max(0, (f.answers[ph.question] ?? "").length - 1)) } }));
        }
        return;
      }
      if (isPrintableInput(input, key)) {
        if (c.templateForm.fieldIndex === 0) {
          setTemplateForm((f) => ({ ...f, name: `${f.name}${input}` }));
        } else {
          const ph = c.templateForm.placeholders[c.templateForm.fieldIndex - 1];
          if (ph) setTemplateForm((f) => ({ ...f, answers: { ...f.answers, [ph.question]: `${f.answers[ph.question] ?? ""}${input}` } }));
        }
      }
      return;
    }

    if (c.mode === "confirm-delete") {
      if (key.escape) { setMode("browse"); setMessage("Delete canceled"); return; }
      if (input === "d" || input === "D") {
        try {
          api.removeProfile(c.confirmDeleteName);
          setMessage(`Removed "${c.confirmDeleteName}"`);
          void refresh();
        } catch (err) {
          setError(messageOf(err));
        }
        setMode("browse");
      }
      return;
    }

    if (key.escape || (ctrl && input === "q")) { exit(); return; }
    if (input === "1") { setTab("status"); return; }
    if (input === "2") { setTab("profiles"); return; }
    if (input === "3") { setTab("templates"); return; }
    if (ctrl && input === "r") { void refresh(); setMessage("Refreshed"); return; }

    if (c.tab === "profiles") {
      if (key.upArrow) { setSelectedProfile((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) {
        setSelectedProfile((i) => Math.min(Math.max(0, c.profiles.length - 1), i + 1));
        return;
      }
      if ((key.return || (ctrl && input === "u")) && c.selectedProfileRow) {
        try {
          api.useProfile(c.selectedProfileRow.name);
          setMessage(`Activated ${c.selectedProfileRow.name}`);
          void refresh();
        } catch (err) {
          setError(messageOf(err));
        }
        return;
      }
      if (ctrl && input === "d" && c.selectedProfileRow) {
        setConfirmDeleteName(c.selectedProfileRow.name);
        setMode("confirm-delete");
        setMessage(`Delete "${c.selectedProfileRow.name}"?`);
        setError("");
        return;
      }
      if (ctrl && input === "a") { openAddForm(); return; }
      if (ctrl && input === "e") { openEditForm(); return; }
      if (ctrl && input === "l") { openLoginForm(); return; }
    }

    if (c.tab === "templates") {
      if (key.upArrow) { setSelectedTemplate((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) {
        setSelectedTemplate((i) => Math.min(Math.max(0, c.templates.length - 1), i + 1));
        return;
      }
      if (key.return && c.selectedTemplateRow) {
        const preview = previewCache[c.selectedTemplateRow.id];
        if (!preview) { setError("Template details not loaded yet, wait a moment"); return; }
        openTemplateAdd(preview);
      }
    }
  });

  const tabLine = (["status", "profiles", "templates"] as Tab[])
    .map((id) => {
      const label = id === "profiles" ? "Profiles" : id.charAt(0).toUpperCase() + id.slice(1);
      return id === tab ? `[${label}]` : ` ${label} `;
    })
    .join(" ");

  const hints =
    mode === "add"
      ? "Add form: Up/Down move field | Enter next | type | Ctrl+s submit | Esc cancel"
      : mode === "edit"
        ? "Edit form: Up/Down move field | Enter next | type | Ctrl+s submit | Esc cancel"
        : mode === "login"
          ? "Login form: Up/Down move field | Enter next | Left/Right or m toggle | Ctrl+s submit | Esc cancel"
          : mode === "confirm-delete"
            ? "Press D to confirm delete | Esc to cancel"
            : mode === "template-add"
              ? "Template form: Up/Down move field | type | Ctrl+s submit | Esc cancel"
              : tab === "templates"
                ? "Keys: 1/2/3 switch | Up/Down move | Enter create profile | Ctrl+r refresh | Ctrl+q quit"
                : tab === "profiles"
                  ? "Keys: Up/Down move | Enter or Ctrl+u use | Ctrl+a add | Ctrl+e edit | Ctrl+d delete | Ctrl+l login | Ctrl+r refresh | Ctrl+q quit"
                  : "Keys: 1/2/3 switch | Ctrl+r refresh | Ctrl+q quit";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text color="cyanBright" bold>
        QuickX
      </Text>
      <Text color="gray">{tabLine}</Text>
      {loading ? <Text>Working...</Text> : null}

      {mode === "add" ? <AddProfileForm draft={addForm.draft} fieldIndex={addForm.fieldIndex} /> : null}
      {mode === "edit" ? (
        <EditProfileForm profileName={editForm.profileName} draft={editForm.draft} fieldIndex={editForm.fieldIndex} />
      ) : null}
      {mode === "login" ? <LoginForm draft={loginForm.draft} fieldIndex={loginForm.fieldIndex} /> : null}
      {mode === "template-add" ? (
        <TemplateAddForm
          templateId={templateForm.id}
          profileName={templateForm.name}
          placeholders={templateForm.placeholders}
          answers={templateForm.answers}
          fieldIndex={templateForm.fieldIndex}
        />
      ) : null}
      {mode === "confirm-delete" ? <ConfirmDeleteForm name={confirmDeleteName} /> : null}

      {mode === "browse" && tab === "status" ? (
        <StatusScreen status={status} />
      ) : null}
      {mode === "browse" && tab === "profiles" ? (
        <ProfilesScreen
          profiles={profileResult.profiles}
          activeProfile={profileResult.activeProfile}
          selectedIndex={selectedProfile}
        />
      ) : null}
      {mode === "browse" && tab === "templates" ? (
        <TemplatesScreen
          templates={templates}
          selectedIndex={selectedTemplate}
          previewCache={previewCache}
        />
      ) : null}

      <Text>{""}</Text>
      <Text color="gray">{hints}</Text>
      <Text color="greenBright">{message}</Text>
      {error ? <Text color="redBright">{error}</Text> : null}
    </Box>
  );
}
