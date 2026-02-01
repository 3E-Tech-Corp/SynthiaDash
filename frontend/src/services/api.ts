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
  ticketAccess: string // legacy
  bugAccess: string // none, submit, execute
  featureAccess: string // none, submit, execute
  chatAccess: string // none, guide, bug, developer
  isActive: boolean
  createdAt: string
  lastLoginAt?: string
}

export interface ChatMessageDto {
  id: number
  userId: number
  sessionKey: string
  role: string // user, assistant
  content: string
  createdAt: string
}

export interface ChatHistoryResponse {
  messages: ChatMessageDto[]
  chatAccess: string
  projectName?: string
  repoFullName?: string
}

export interface ChatAccessResponse {
  chatAccess: string
  projectName?: string
  repoFullName?: string
}

export interface Project {
  id: number
  name: string
  slug: string
  domain: string
  repoFullName: string
  databaseName: string
  iisSiteName: string
  status: string // pending, provisioning, ready, failed
  statusDetail?: string
  error?: string
  createdByUserId: number
  createdByEmail?: string
  createdAt: string
  readyAt?: string
}

export interface Ticket {
  id: number
  userId: number
  type: string // bug, feature
  title: string
  description: string
  imagePath?: string
  repoFullName?: string
  status: string // submitted, in_progress, completed, closed
  agentTaskId?: string
  result?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  userEmail?: string
  userDisplayName?: string
}

export interface TicketComment {
  id: number
  ticketId: number
  userId: number | null
  userDisplayName: string
  comment: string
  isSystemMessage: boolean
  createdAt: string
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

  updateUser: (id: number, patch: { role?: string; repos?: string; isActive?: boolean; bugAccess?: string; featureAccess?: string; chatAccess?: string }) =>
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

  // Tickets
  getTickets: (limit = 50) => fetchApi<Ticket[]>(`/tickets?limit=${limit}`),

  getTicket: (id: number) => fetchApi<Ticket>(`/tickets/${id}`),

  createTicket: async (formData: FormData): Promise<Ticket> => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData, // multipart/form-data — no Content-Type header (browser sets boundary)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed' }));
      throw new Error(err.error || `API error: ${response.status}`);
    }
    return response.json();
  },

  updateTicket: (id: number, patch: { status?: string; result?: string }) =>
    fetchApi<Ticket>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteTicket: (id: number) =>
    fetchApi<{ message: string }>(`/tickets/${id}`, { method: 'DELETE' }),

  executeTicket: (id: number) =>
    fetchApi<{ message: string }>(`/tickets/${id}/execute`, { method: 'POST' }),

  getTicketAccess: () => fetchApi<{ bugAccess: string; featureAccess: string }>('/tickets/access'),

  getProjectBrief: () => fetchApi<{ hasBrief: boolean; brief: string | null; setAt: string | null }>('/tickets/project-brief'),

  getTicketComments: (id: number) => fetchApi<TicketComment[]>(`/tickets/${id}/comments`),

  addTicketComment: (id: number, comment: string) =>
    fetchApi<TicketComment>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),

  getTicketImageUrl: (imagePath: string) =>
    `${API_BASE}/tickets/image/${imagePath.replace('tickets/', '')}`,

  // Projects
  getProjects: () => fetchApi<Project[]>('/projects'),

  getProject: (id: number) => fetchApi<Project>(`/projects/${id}`),

  createProject: (data: { name: string; slug: string; domain: string }) =>
    fetchApi<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Chat
  getChatHistory: (limit = 50) =>
    fetchApi<ChatHistoryResponse>(`/chat/history?limit=${limit}`),

  getChatAccess: () =>
    fetchApi<ChatAccessResponse>('/chat/access'),

  clearChatHistory: () =>
    fetchApi<{ message: string }>('/chat/history', { method: 'DELETE' }),

  chatStream: async (
    message: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError?: (error: string) => void
  ) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        onError?.(`Error: ${response.status}`);
        onDone();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError?.('No response stream');
        onDone();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              onError?.(parsed.error);
              onDone();
              return;
            }
            const choices = parsed.choices;
            if (choices) {
              for (const choice of choices) {
                const content = choice.delta?.content;
                if (content) {
                  onChunk(content);
                }
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      onDone();
    } catch (err: any) {
      onError?.(err.message || 'Stream failed');
      onDone();
    }
  },
};
