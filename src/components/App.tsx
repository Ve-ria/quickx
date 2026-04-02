import React from "react";
import { Box, Text, useApp, useInput } from "ink";

import { QuickxApi } from "../api.js";
import type {
  AddDraft,
  EditDraft,
  ListProfilesResult,
  StatusInfo,
  Template,
} from "../types.js";
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
  statusLines,
} from "../lib/tui.js";
import {
  maskKey,
  messageOf,
  openBrowser,
  pickWindow,
  truncate,
} from "../lib/utils.js";

interface AppProps {
  api: QuickxApi;
}

type Tab = "status" | "configs" | "templates";
type Mode = "browse" | "add" | "edit" | "login";

export function App({ api }: AppProps): React.JSX.Element {
  const { exit } = useApp();
  const [tab, setTab] = React.useState<Tab>("status");
  const [mode, setMode] = React.useState<Mode>("browse");
  const [status, setStatus] = React.useState<StatusInfo>(api.status());
  const [configResult, setConfigResult] = React.useState<ListProfilesResult>(
    api.listProfiles(),
  );
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [selectedConfig, setSelectedConfig] = React.useState(0);
  const [selectedTemplate, setSelectedTemplate] = React.useState(0);
  const [previewCache, setPreviewCache] = React.useState<Record<string, Template>>(
    {},
  );
  const [message, setMessage] = React.useState("Ready");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [addDraft, setAddDraft] = React.useState<AddDraft>(defaultAddDraft());
  const [addFieldIndex, setAddFieldIndex] = React.useState(0);
  const [editConfigName, setEditConfigName] = React.useState("");
  const [editDraft, setEditDraft] =
    React.useState<EditDraft>(defaultEditDraft());
  const [editFieldIndex, setEditFieldIndex] = React.useState(0);
  const [loginDraft, setLoginDraft] = React.useState(defaultLoginDraft());
  const [loginFieldIndex, setLoginFieldIndex] = React.useState(0);
  const stateRef = React.useRef({
    tab,
    mode,
    configs: configResult.profiles,
    activeProfile: configResult.activeProfile,
    selectedConfig,
    selectedConfigRow: configResult.profiles[selectedConfig] || null,
    templates,
    selectedTemplate,
    selectedTemplateRow: templates[selectedTemplate] || null,
    addFieldIndex,
    editFieldIndex,
    loginFieldIndex,
  });

  stateRef.current = {
    tab,
    mode,
    configs: configResult.profiles,
    activeProfile: configResult.activeProfile,
    selectedConfig,
    selectedConfigRow: configResult.profiles[selectedConfig] || null,
    templates,
    selectedTemplate,
    selectedTemplateRow: templates[selectedTemplate] || null,
    addFieldIndex,
    editFieldIndex,
    loginFieldIndex,
  };

  const refresh = async () => {
    try {
      const nextStatus = api.status();
      const nextConfigResult = api.listProfiles();

      setStatus(nextStatus);
      setConfigResult(nextConfigResult);
      setSelectedConfig((index) => {
        if (nextConfigResult.profiles.length === 0) {
          return 0;
        }

        return Math.min(index, nextConfigResult.profiles.length - 1);
      });

      if (stateRef.current.tab === "templates") {
        const nextTemplates = await api.listTemplates();
        setTemplates(nextTemplates);
        setSelectedTemplate((index) => {
          if (nextTemplates.length === 0) {
            return 0;
          }

          return Math.min(index, nextTemplates.length - 1);
        });
      }
      setError("");
    } catch (refreshError) {
      setError(messageOf(refreshError));
    }
  };

  React.useEffect(() => {
    void refresh();
  }, []);

  const configs = configResult.profiles;
  const activeProfile = configResult.activeProfile;
  const selectedConfigRow = configs[selectedConfig] || null;
  const selectedTemplateRow = templates[selectedTemplate] || null;

  React.useEffect(() => {
    if (tab !== "templates") {
      return;
    }

    void api
      .listTemplates()
      .then((rows) => {
        setTemplates(rows);
        setSelectedTemplate((index) => {
          if (rows.length === 0) {
            return 0;
          }

          return Math.min(index, rows.length - 1);
        });
      })
      .catch((templateError) => {
        setError(messageOf(templateError));
      });
  }, [api, tab]);

  React.useEffect(() => {
    if (tab !== "templates" || !selectedTemplateRow) {
      return;
    }

    if (previewCache[selectedTemplateRow.id]) {
      return;
    }

    void api
      .previewTemplate(selectedTemplateRow.id)
      .then((preview) => {
        setPreviewCache((cache) => ({
          ...cache,
          [selectedTemplateRow.id]: preview,
        }));
        setError("");
      })
      .catch((templateError) => {
        setError(messageOf(templateError));
      });
  }, [api, previewCache, selectedTemplateRow, tab]);

  const openAddForm = () => {
    setMode("add");
    setAddDraft(defaultAddDraft());
    setAddFieldIndex(0);
    setMessage("Add profile form");
    setError("");
  };

  const openEditForm = () => {
    if (!selectedConfigRow) {
      setError("No profile selected");
      return;
    }

    setMode("edit");
    setEditConfigName(selectedConfigRow.name);
    setEditDraft(profileToEditDraft(selectedConfigRow));
    setEditFieldIndex(0);
    setMessage(`Edit profile: ${selectedConfigRow.name}`);
    setError("");
  };

  const openLoginForm = () => {
    setMode("login");
    setLoginDraft(defaultLoginDraft());
    setLoginFieldIndex(0);
    setMessage("Codex login form");
    setError("");
  };

  const submitAddForm = () => {
    try {
      const created = api.addProfile({
        name: addDraft.name.trim() || "my-codex",
        displayName:
          addDraft.displayName.trim() || addDraft.name.trim() || "my-codex",
        baseUrl: addDraft.baseUrl.trim(),
        apiKey: addDraft.apiKey,
        model: addDraft.model.trim(),
        wireApi: addDraft.wireApi.trim() || "responses",
        authMethod: addDraft.authMethod.trim() || "api_key",
      });

      setMode("browse");
      setTab("configs");
      setMessage(`Profile "${created.name}" added`);
      setError("");
      void refresh();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  };

  const submitEditForm = () => {
    try {
      const updated = api.updateProfile({
        name: editConfigName,
        displayName: editDraft.displayName.trim() || editConfigName,
        baseUrl: editDraft.baseUrl.trim(),
        apiKey: editDraft.apiKey,
        model: editDraft.model.trim(),
        wireApi: editDraft.wireApi.trim() || "responses",
        authMethod: editDraft.authMethod.trim() || "api_key",
      });

      if (activeProfile === updated.name) {
        api.useProfile(updated.name);
      }

      setMode("browse");
      setTab("configs");
      setMessage(`Profile "${updated.name}" updated`);
      setError("");
      void refresh();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  };

  const submitLoginForm = async () => {
    setLoading(true);

    try {
      const desiredName = loginDraft.name.trim();
      if (loginDraft.method === "device") {
        const pending = await api.loginCodexRequestDevice();
        setMessage(
          `Device code: ${pending.userCode} | URL: ${pending.verificationUrl}`,
        );
        const created = await api.loginCodexCompleteDevice(
          pending.handleId,
          desiredName,
        );
        setMessage(`Login complete, created "${created.name}"`);
      } else {
        const pending = await api.loginCodexBrowserStart();
        if (openBrowser(pending.authUrl)) {
          setMessage(`Browser opened: ${pending.authUrl}`);
        } else {
          setMessage(`Open this URL: ${pending.authUrl}`);
        }

        const created = await api.loginCodexBrowserWait(
          pending.handleId,
          desiredName,
        );
        setMessage(`Login complete, created "${created.name}"`);
      }

      setMode("browse");
      setTab("configs");
      setError("");
      void refresh();
    } catch (submitError) {
      setError(messageOf(submitError));
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    const current = stateRef.current;
    const ctrl = Boolean(key.ctrl);

    if (current.mode === "add") {
      if (key.escape) {
        setMode("browse");
        setMessage("Canceled add profile");
        return;
      }

      if (key.upArrow) {
        setAddFieldIndex((index) => prevFieldIndex(index, addFieldDefs.length));
        return;
      }

      if (key.downArrow || key.return) {
        setAddFieldIndex((index) => nextFieldIndex(index, addFieldDefs.length));
        return;
      }

      if (ctrl && input === "s") {
        submitAddForm();
        return;
      }

      if (key.backspace || key.delete) {
        const fieldKey = addFieldDefs[current.addFieldIndex]?.key;
        if (!fieldKey) {
          return;
        }

        setAddDraft((draft) => ({
          ...draft,
          [fieldKey]: draft[fieldKey].slice(
            0,
            Math.max(0, draft[fieldKey].length - 1),
          ),
        }));
        return;
      }

      if (isPrintableInput(input, key)) {
        const fieldKey = addFieldDefs[current.addFieldIndex]?.key;
        if (!fieldKey) {
          return;
        }

        setAddDraft((draft) => ({
          ...draft,
          [fieldKey]: `${draft[fieldKey]}${input}`,
        }));
      }

      return;
    }

    if (current.mode === "edit") {
      if (key.escape) {
        setMode("browse");
        setMessage("Canceled edit profile");
        return;
      }

      if (key.upArrow) {
        setEditFieldIndex((index) =>
          prevFieldIndex(index, editFieldDefs.length),
        );
        return;
      }

      if (key.downArrow || key.return) {
        setEditFieldIndex((index) =>
          nextFieldIndex(index, editFieldDefs.length),
        );
        return;
      }

      if (ctrl && input === "s") {
        submitEditForm();
        return;
      }

      if (key.backspace || key.delete) {
        const fieldKey = editFieldDefs[current.editFieldIndex]?.key;
        if (!fieldKey) {
          return;
        }

        setEditDraft((draft) => ({
          ...draft,
          [fieldKey]: draft[fieldKey].slice(
            0,
            Math.max(0, draft[fieldKey].length - 1),
          ),
        }));
        return;
      }

      if (isPrintableInput(input, key)) {
        const fieldKey = editFieldDefs[current.editFieldIndex]?.key;
        if (!fieldKey) {
          return;
        }

        setEditDraft((draft) => ({
          ...draft,
          [fieldKey]: `${draft[fieldKey]}${input}`,
        }));
      }

      return;
    }

    if (current.mode === "login") {
      if (key.escape) {
        setMode("browse");
        setMessage("Canceled login");
        return;
      }

      if (key.upArrow) {
        setLoginFieldIndex((index) => prevFieldIndex(index, 2));
        return;
      }

      if (key.downArrow || key.return) {
        setLoginFieldIndex((index) => nextFieldIndex(index, 2));
        return;
      }

      if (ctrl && input === "s") {
        void submitLoginForm();
        return;
      }

      if (
        current.loginFieldIndex === 1 &&
        (key.leftArrow || key.rightArrow || input === "m")
      ) {
        setLoginDraft((draft) => ({
          ...draft,
          method: draft.method === "browser" ? "device" : "browser",
        }));
        return;
      }

      if (current.loginFieldIndex === 0) {
        if (key.backspace || key.delete) {
          setLoginDraft((draft) => ({
            ...draft,
            name: draft.name.slice(0, Math.max(0, draft.name.length - 1)),
          }));
          return;
        }

        if (isPrintableInput(input, key)) {
          setLoginDraft((draft) => ({
            ...draft,
            name: `${draft.name}${input}`,
          }));
        }
      }

      return;
    }

    if (key.escape || (ctrl && input === "q")) {
      exit();
      return;
    }

    if (input === "1") {
      setTab("status");
      return;
    }

    if (input === "2") {
      setTab("configs");
      return;
    }

    if (input === "3") {
      setTab("templates");
      return;
    }

    if (ctrl && input === "r") {
      void refresh();
      setMessage("Refreshed");
      return;
    }

    if (current.tab === "configs") {
      if (key.upArrow) {
        setSelectedConfig((index) => Math.max(0, index - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedConfig((index) =>
          Math.min(Math.max(0, configs.length - 1), index + 1),
        );
        return;
      }

      if (
        (key.return || (ctrl && input === "u")) &&
        current.selectedConfigRow
      ) {
        try {
          api.useProfile(current.selectedConfigRow.name);
          setMessage(`Activated ${current.selectedConfigRow.name}`);
          void refresh();
        } catch (activateError) {
          setError(messageOf(activateError));
        }
        return;
      }

      if (ctrl && input === "d" && current.selectedConfigRow) {
        try {
          api.removeProfile(current.selectedConfigRow.name);
          setMessage(`Removed ${current.selectedConfigRow.name}`);
          void refresh();
        } catch (removeError) {
          setError(messageOf(removeError));
        }
        return;
      }

      if (ctrl && input === "a") {
        openAddForm();
        return;
      }

      if (ctrl && input === "e") {
        openEditForm();
        return;
      }

      if (ctrl && input === "l") {
        openLoginForm();
        return;
      }
    }

    if (current.tab === "templates") {
      if (key.upArrow) {
        setSelectedTemplate((index) => Math.max(0, index - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedTemplate((index) =>
          Math.min(Math.max(0, current.templates.length - 1), index + 1),
        );
      }
    }
  });

  const tabLine = [
    { id: "status", label: "Status" },
    { id: "configs", label: "Configs" },
    { id: "templates", label: "Templates" },
  ]
    .map((item) => (item.id === tab ? `[${item.label}]` : ` ${item.label} `))
    .join(" ");

  const configWindow = pickWindow(configs, selectedConfig, 14);
  const templateWindow = pickWindow(templates, selectedTemplate, 14);
  const currentPreview = selectedTemplateRow
    ? previewCache[selectedTemplateRow.id] || null
    : null;
  const templateDetailLines = currentPreview
    ? [
        `ID: ${currentPreview.id || "-"}`,
        `Name: ${currentPreview.displayName || "-"}`,
        `Scope: ${currentPreview.scope.join(", ") || "-"}`,
        `Base URL: ${currentPreview.baseUrl || "-"}`,
        `Model: ${currentPreview.model || "-"}`,
        `Wire API: ${currentPreview.wireApi || "-"}`,
        `Auth Method: ${currentPreview.authMethod || "-"}`,
        `Docs: ${currentPreview.docsUrl || "-"}`,
      ]
    : ["Select a template to preview details."];
  const hints =
    mode === "add"
      ? "Add form: Up/Down move field | Enter next | type | Ctrl+s submit | Esc cancel"
      : mode === "edit"
        ? "Edit form: Up/Down move field | Enter next | type | Ctrl+s submit | Esc cancel"
        : mode === "login"
          ? "Login form: Up/Down move field | Enter next | Left/Right or m toggle | Ctrl+s submit | Esc cancel"
          : tab === "templates"
            ? "Keys: 1/2/3 switch | Up/Down move | Ctrl+r refresh | Ctrl+q quit"
          : tab === "configs"
            ? "Keys: Up/Down move | Enter or Ctrl+u use | Ctrl+a add | Ctrl+e edit | Ctrl+d delete | Ctrl+l login | Ctrl+r refresh | Ctrl+q quit"
            : "Keys: 1/2/3 switch | Ctrl+r refresh | Ctrl+q quit";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text color="cyanBright" bold>
        QuickX
      </Text>
      <Text color="gray">{tabLine}</Text>
      <Text>{loading ? "Working..." : ""}</Text>

      {mode === "add" ? (
        <Box
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold>Add Profile</Text>
          {addFieldDefs.map((field, index) => {
            const focused = index === addFieldIndex;
            const rawValue = addDraft[field.key];
            const shown = field.secret ? maskKey(rawValue) : rawValue;
            const displayValue = shown || field.placeholder;

            return (
              <Text
                key={`add-${field.key}`}
                color={focused ? "greenBright" : undefined}
              >
                {`${focused ? ">" : " "} ${field.label.padEnd(12, " ")} : ${displayValue}`}
              </Text>
            );
          })}
        </Box>
      ) : null}

      {mode === "edit" ? (
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold>{`Edit Profile: ${editConfigName || "-"}`}</Text>
          {editFieldDefs.map((field, index) => {
            const focused = index === editFieldIndex;
            const rawValue = editDraft[field.key];
            const shown = field.secret ? maskKey(rawValue) : rawValue;
            const displayValue = shown || field.placeholder;

            return (
              <Text
                key={`edit-${field.key}`}
                color={focused ? "greenBright" : undefined}
              >
                {`${focused ? ">" : " "} ${field.label.padEnd(12, " ")} : ${displayValue}`}
              </Text>
            );
          })}
        </Box>
      ) : null}

      {mode === "login" ? (
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold>Codex Login</Text>
          <Text color={loginFieldIndex === 0 ? "greenBright" : undefined}>
            {`${loginFieldIndex === 0 ? ">" : " "} Name        : ${loginDraft.name || "(auto)"}`}
          </Text>
          <Text color={loginFieldIndex === 1 ? "greenBright" : undefined}>
            {`${loginFieldIndex === 1 ? ">" : " "} Method      : ${loginDraft.method}`}
          </Text>
        </Box>
      ) : null}

      {mode === "browse" && tab === "status" ? (
        <Box
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
          flexDirection="column"
        >
          {statusLines(status).map((line, index) => (
            <Text key={`status-${index}`}>{line}</Text>
          ))}
        </Box>
      ) : null}

      {mode === "browse" && tab === "configs" ? (
        <Box gap={1}>
          <Box
            borderStyle="round"
            borderColor="green"
            paddingX={1}
            flexDirection="column"
            width={72}
          >
            <Text bold>Configs</Text>
            {configs.length === 0 ? (
              <Text color="gray">No profiles found.</Text>
            ) : (
              configWindow.rows.map((profile, index) => {
                const absolute = configWindow.start + index;
                const marker = absolute === selectedConfig ? ">" : " ";
                const active = profile.name === activeProfile ? "*" : " ";
                const name = truncate(profile.name, 22).padEnd(22, " ");
                const auth = truncate(profile.authMethod, 10).padEnd(10, " ");
                const display = truncate(profile.displayName, 26);

                return (
                  <Text
                    key={`profile-${profile.name}-${absolute}`}
                    color={
                      absolute === selectedConfig ? "greenBright" : undefined
                    }
                  >
                    {`${marker}${active} ${name} ${auth} ${display}`}
                  </Text>
                );
              })
            )}
          </Box>

          <Box
            borderStyle="round"
            borderColor="yellow"
            paddingX={1}
            flexDirection="column"
            width={46}
          >
            <Text bold>Selected</Text>
            {!selectedConfigRow ? (
              <Text color="gray">No profile selected.</Text>
            ) : (
              <>
                <Text>{`Name: ${selectedConfigRow.name}`}</Text>
                <Text>{`Display: ${selectedConfigRow.displayName}`}</Text>
                <Text>{`Base: ${selectedConfigRow.baseUrl || "-"}`}</Text>
                <Text>{`Model: ${selectedConfigRow.model || "-"}`}</Text>
                <Text>{`Wire API: ${selectedConfigRow.wireApi || "-"}`}</Text>
                <Text>{`Auth: ${selectedConfigRow.authMethod || "-"}`}</Text>
                <Text>{`Key: ${maskKey(selectedConfigRow.apiKey)}`}</Text>
              </>
            )}
          </Box>
        </Box>
      ) : null}

      {mode === "browse" && tab === "templates" ? (
        <Box gap={1}>
          <Box
            borderStyle="round"
            borderColor="magenta"
            paddingX={1}
            flexDirection="column"
            width={72}
          >
            <Text bold>Templates</Text>
            {templates.length === 0 ? (
              <Text color="gray">No templates available.</Text>
            ) : (
              templateWindow.rows.map((template, index) => {
                const absolute = templateWindow.start + index;
                const marker = absolute === selectedTemplate ? ">" : " ";
                const id = truncate(template.id || "-", 22).padEnd(22, " ");
                const display = truncate(template.displayName || "-", 34).padEnd(
                  34,
                  " ",
                );
                const scope = truncate(template.scope.join(","), 12);

                return (
                  <Text
                    key={`template-${template.id}-${absolute}`}
                    color={
                      absolute === selectedTemplate ? "magentaBright" : undefined
                    }
                  >
                    {`${marker} ${id} ${display} ${scope}`}
                  </Text>
                );
              })
            )}
          </Box>

          <Box
            borderStyle="round"
            borderColor="yellow"
            paddingX={1}
            flexDirection="column"
            width={45}
          >
            <Text bold>Preview</Text>
            {templateDetailLines.map((line, index) => (
              <Text key={`preview-${index}`}>{line}</Text>
            ))}
          </Box>
        </Box>
      ) : null}

      <Text>{""}</Text>
      <Text color="gray">{hints}</Text>
      <Text color="greenBright">{message}</Text>
      {error ? <Text color="redBright">{error}</Text> : null}
    </Box>
  );
}
