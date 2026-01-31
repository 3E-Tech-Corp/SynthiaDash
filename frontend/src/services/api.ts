const API_BASE = '/api';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export interface GatewayStatus {
  online: boolean;
  model?: string;
  host?: string;
}

export interface RepoStatus {
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch?: string;
  lastPush?: string;
  lastDeploy?: DeployInfo;
}

export interface DeployInfo {
  runId: number;
  status: string;
  commit?: string;
  commitMessage?: string;
  startedAt?: string;
  durationSeconds?: number;
}

export interface SessionInfo {
  key: string;
  kind?: string;
  channel?: string;
  lastActivity?: string;
  messageCount: number;
}

export interface AgentTask {
  id: string;
  repoFullName: string;
  status: string; // pending, running, completed, failed
  errorContent?: string;
  prompt?: string;
  result?: string;
  prUrl?: string;
  createdAt: string;
  completedAt?: string;
  sessionKey: string;
}

export interface User {
  id: number
  email: string
  displayName: string
  role: string
  repos?: string
  isActive: boolean
  createdAt: string
  lastLoginAt?: string
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchApi<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => fetchApi<User>('/auth/me'),

  getUsers: () => fetchApi<User[]>('/auth/users'),

  registerUser: (email: string, displayName: string, password: string, role: string) =>
    fetchApi<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, password, role }),
    }),

  updateUser: (id: number, patch: { role?: string; repos?: string; isActive?: boolean }) =>
    fetchApi<{ message: string }>(`/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // Status
  getStatus: () => fetchApi<GatewayStatus>('/status'),

  getFullStatus: () => fetchApi<{
    gateway: GatewayStatus;
    sessions: SessionInfo[];
    activeSessions: number;
  }>('/status/full'),

  getRepos: () => fetchApi<RepoStatus[]>('/repos'),

  getDeploys: (owner: string, repo: string, limit = 10) =>
    fetchApi<DeployInfo[]>(`/repos/${owner}/${repo}/deploys?limit=${limit}`),

  triggerDeploy: (owner: string, repo: string) =>
    fetchApi<{ message: string }>(`/repos/${owner}/${repo}/deploy`, { method: 'POST' }),

  sendMessage: (message: string, sessionKey?: string) =>
    fetchApi<{ response: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionKey }),
    }),

  // Tasks
  getTasks: (limit = 20) => fetchApi<AgentTask[]>(`/tasks?limit=${limit}`),

  getTask: (id: string) => fetchApi<AgentTask>(`/tasks/${id}`),

  createTask: (repoFullName: string, customPrompt?: string) =>
    fetchApi<AgentTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ repoFullName, customPrompt }),
    }),
};
