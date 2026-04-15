const BASE = "";

// 检测是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && !!(window as any).hermes;

// Ephemeral session token for protected endpoints (reveal).
let _sessionToken: string | null = null;

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

async function getSessionToken(): Promise<string> {
  if (_sessionToken) return _sessionToken;
  const resp = await fetchJSON<{ token: string }>("/api/auth/session-token");
  _sessionToken = resp.token;
  return _sessionToken;
}

// Electron 环境下的 API 实现
const electronAPI = {
  checkInstall: async () => {
    return (window as any).hermes.checkInstall();
  },

  getStatus: async (): Promise<StatusResponse> => {
    const status = await (window as any).hermes.getStatus();
    if (status.error) {
      throw new Error(status.error);
    }
    return {
      active_sessions: status.activeSessions || 0,
      config_path: status.configPath || "",
      config_version: 1,
      env_path: "",
      gateway_exit_reason: null,
      gateway_pid: status.gatewayPid || null,
      gateway_platforms: {},
      gateway_running: status.gatewayRunning || false,
      gateway_state: status.gatewayRunning ? "running" : "stopped",
      gateway_updated_at: null,
      hermes_home: status.hermesHome || "",
      latest_config_version: 1,
      release_date: "",
      version: status.version || "unknown",
    };
  },

  getSessions: async (): Promise<SessionInfo[]> => {
    return [];
  },

  getSessionMessages: async (id: string): Promise<SessionMessagesResponse> => {
    return fetchJSON<SessionMessagesResponse>(`/api/sessions/${encodeURIComponent(id)}/messages`);
  },

  deleteSession: async (id: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getLogs: async (params: { file?: string; lines?: number; level?: string; component?: string }): Promise<LogsResponse> => {
    const qs = new URLSearchParams();
    if (params.file) qs.set("file", params.file);
    if (params.lines) qs.set("lines", String(params.lines));
    if (params.level && params.level !== "ALL") qs.set("level", params.level);
    if (params.component && params.component !== "all") qs.set("component", params.component);
    return fetchJSON<LogsResponse>(`/api/logs?${qs.toString()}`);
  },

  getAnalytics: async (days: number): Promise<AnalyticsResponse> => {
    return fetchJSON<AnalyticsResponse>(`/api/analytics/usage?days=${days}`);
  },

  getConfig: async (): Promise<Record<string, unknown>> => {
    return (window as any).hermes.getConfig();
  },

  getDefaults: async (): Promise<Record<string, unknown>> => {
    return fetchJSON<Record<string, unknown>>("/api/config/defaults");
  },

  getSchema: async (): Promise<{ fields: Record<string, unknown>; category_order: string[] }> => {
    return fetchJSON<{ fields: Record<string, unknown>; category_order: string[] }>("/api/config/schema");
  },

  saveConfig: async (config: Record<string, unknown>): Promise<{ ok: boolean }> => {
    // 逐个保存配置项
    for (const [key, value] of Object.entries(config)) {
      const result = await (window as any).hermes.setConfig(key, value);
      if (!result.success) return { ok: false };
    }
    return { ok: true };
  },

  getConfigRaw: async (): Promise<{ yaml: string }> => {
    return fetchJSON<{ yaml: string }>("/api/config/raw");
  },

  saveConfigRaw: async (yaml_text: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>("/api/config/raw", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml_text }),
    });
  },

  getEnvVars: async (): Promise<Record<string, EnvVarInfo>> => {
    return fetchJSON<Record<string, EnvVarInfo>>("/api/env");
  },

  setEnvVar: async (key: string, value: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>("/api/env", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  },

  deleteEnvVar: async (key: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>("/api/env", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  },

  revealEnvVar: async (key: string): Promise<{ key: string; value: string }> => {
    const token = await getSessionToken();
    return fetchJSON<{ key: string; value: string }>("/api/env/reveal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key }),
    });
  },

  // Cron jobs
  getCronJobs: async (): Promise<CronJob[]> => {
    return fetchJSON<CronJob[]>("/api/cron/jobs");
  },

  createCronJob: async (job: { prompt: string; schedule: string; name?: string; deliver?: string }): Promise<CronJob> => {
    return fetchJSON<CronJob>("/api/cron/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job),
    });
  },

  pauseCronJob: async (id: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}/pause`, { method: "POST" });
  },

  resumeCronJob: async (id: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}/resume`, { method: "POST" });
  },

  triggerCronJob: async (id: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}/trigger`, { method: "POST" });
  },

  deleteCronJob: async (id: string): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}`, { method: "DELETE" });
  },

  // Skills & Toolsets
  getSkills: async (): Promise<SkillInfo[]> => {
    return fetchJSON<SkillInfo[]>("/api/skills");
  },

  toggleSkill: async (name: string, enabled: boolean): Promise<{ ok: boolean }> => {
    return fetchJSON<{ ok: boolean }>("/api/skills/toggle", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, enabled }),
    });
  },

  getToolsets: async (): Promise<ToolsetInfo[]> => {
    return fetchJSON<ToolsetInfo[]>("/api/tools/toolsets");
  },

  // Session search (FTS5)
  searchSessions: async (q: string): Promise<SessionSearchResponse> => {
    return fetchJSON<SessionSearchResponse>(`/api/sessions/search?q=${encodeURIComponent(q)}`);
  },

  // 平台管理（Electron 特有）
  getPlatforms: async (): Promise<Array<{ id: string; name: string; enabled: boolean; state: string; errorMessage?: string }>> => {
    return (window as any).hermes.getPlatforms();
  },

  setupPlatform: async (platform: string, config: Record<string, string>): Promise<{ success: boolean; error?: string }> => {
    return (window as any).hermes.setupPlatform(platform, config);
  },

  startGateway: async (): Promise<{ success: boolean; error?: string }> => {
    return (window as any).hermes.startGateway();
  },

  stopGateway: async (): Promise<{ success: boolean; error?: string }> => {
    return (window as any).hermes.stopGateway();
  },
};

// 标准 HTTP API 实现（用于浏览器环境）
const httpAPI = {
  checkInstall: async () => ({ success: true }),
  getStatus: () => fetchJSON<StatusResponse>("/api/status"),
  getSessions: () => fetchJSON<SessionInfo[]>("/api/sessions"),
  getSessionMessages: (id: string) =>
    fetchJSON<SessionMessagesResponse>(`/api/sessions/${encodeURIComponent(id)}/messages`),
  deleteSession: (id: string) =>
    fetchJSON<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  getLogs: (params: { file?: string; lines?: number; level?: string; component?: string }) => {
    const qs = new URLSearchParams();
    if (params.file) qs.set("file", params.file);
    if (params.lines) qs.set("lines", String(params.lines));
    if (params.level && params.level !== "ALL") qs.set("level", params.level);
    if (params.component && params.component !== "all") qs.set("component", params.component);
    return fetchJSON<LogsResponse>(`/api/logs?${qs.toString()}`);
  },
  getAnalytics: (days: number) =>
    fetchJSON<AnalyticsResponse>(`/api/analytics/usage?days=${days}`),
  getConfig: () => fetchJSON<Record<string, unknown>>("/api/config"),
  getDefaults: () => fetchJSON<Record<string, unknown>>("/api/config/defaults"),
  getSchema: () => fetchJSON<{ fields: Record<string, unknown>; category_order: string[] }>("/api/config/schema"),
  saveConfig: (config: Record<string, unknown>) =>
    fetchJSON<{ ok: boolean }>("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    }),
  getConfigRaw: () => fetchJSON<{ yaml: string }>("/api/config/raw"),
  saveConfigRaw: (yaml_text: string) =>
    fetchJSON<{ ok: boolean }>("/api/config/raw", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml_text }),
    }),
  getEnvVars: () => fetchJSON<Record<string, EnvVarInfo>>("/api/env"),
  setEnvVar: (key: string, value: string) =>
    fetchJSON<{ ok: boolean }>("/api/env", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }),
  deleteEnvVar: (key: string) =>
    fetchJSON<{ ok: boolean }>("/api/env", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }),
  revealEnvVar: async (key: string) => {
    const token = await getSessionToken();
    return fetchJSON<{ key: string; value: string }>("/api/env/reveal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key }),
    });
  },
  getCronJobs: () => fetchJSON<CronJob[]>("/api/cron/jobs"),
  createCronJob: (job: { prompt: string; schedule: string; name?: string; deliver?: string }) =>
    fetchJSON<CronJob>("/api/cron/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job),
    }),
  pauseCronJob: (id: string) =>
    fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}/pause`, { method: "POST" }),
  resumeCronJob: (id: string) =>
    fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}/resume`, { method: "POST" }),
  triggerCronJob: (id: string) =>
    fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}/trigger`, { method: "POST" }),
  deleteCronJob: (id: string) =>
    fetchJSON<{ ok: boolean }>(`/api/cron/jobs/${id}`, { method: "DELETE" }),
  getSkills: () => fetchJSON<SkillInfo[]>("/api/skills"),
  toggleSkill: (name: string, enabled: boolean) =>
    fetchJSON<{ ok: boolean }>("/api/skills/toggle", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, enabled }),
    }),
  getToolsets: () => fetchJSON<ToolsetInfo[]>("/api/tools/toolsets"),
  searchSessions: (q: string) =>
    fetchJSON<SessionSearchResponse>(`/api/sessions/search?q=${encodeURIComponent(q)}`),
  getPlatforms: async () => {
    console.warn("getPlatforms is only available in Electron mode");
    return [];
  },
  setupPlatform: async () => {
    console.warn("setupPlatform is only available in Electron mode");
    return { success: false, error: "Not available in browser mode" };
  },
  startGateway: async () => {
    console.warn("startGateway is only available in Electron mode");
    return { success: false, error: "Not available in browser mode" };
  },
  stopGateway: async () => {
    console.warn("stopGateway is only available in Electron mode");
    return { success: false, error: "Not available in browser mode" };
  },
};

// 根据环境选择合适的 API 实现
export const api = isElectron ? electronAPI : httpAPI;

export interface PlatformStatus {
  error_code?: string;
  error_message?: string;
  state: string;
  updated_at: string;
}

export interface StatusResponse {
  active_sessions: number;
  config_path: string;
  config_version: number;
  env_path: string;
  gateway_exit_reason: string | null;
  gateway_pid: number | null;
  gateway_platforms: Record<string, PlatformStatus>;
  gateway_running: boolean;
  gateway_state: string | null;
  gateway_updated_at: string | null;
  hermes_home: string;
  latest_config_version: number;
  release_date: string;
  version: string;
}

export interface SessionInfo {
  id: string;
  source: string | null;
  model: string | null;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  last_active: number;
  is_active: boolean;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  preview: string | null;
}

export interface EnvVarInfo {
  is_set: boolean;
  redacted_value: string | null;
  description: string;
  url: string | null;
  category: string;
  is_password: boolean;
  tools: string[];
  advanced: boolean;
}

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  tool_name?: string;
  tool_call_id?: string;
  timestamp?: number;
}

export interface SessionMessagesResponse {
  session_id: string;
  messages: SessionMessage[];
}

export interface LogsResponse {
  file: string;
  lines: string[];
}

export interface AnalyticsDailyEntry {
  day: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
  estimated_cost: number;
  actual_cost: number;
  sessions: number;
}

export interface AnalyticsModelEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  sessions: number;
}

export interface AnalyticsResponse {
  daily: AnalyticsDailyEntry[];
  by_model: AnalyticsModelEntry[];
  totals: {
    total_input: number;
    total_output: number;
    total_cache_read: number;
    total_reasoning: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    total_sessions: number;
  };
}

export interface CronJob {
  id: string;
  name?: string;
  prompt: string;
  schedule: string;
  status: "enabled" | "paused" | "error";
  deliver?: string;
  last_run_at?: string | null;
  next_run_at?: string | null;
  error?: string | null;
}

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface ToolsetInfo {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  tools: string[];
}

export interface SessionSearchResult {
  session_id: string;
  snippet: string;
  role: string | null;
  source: string | null;
  model: string | null;
  session_started: number | null;
}

export interface SessionSearchResponse {
  results: SessionSearchResult[];
}
