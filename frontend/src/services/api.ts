const API_BASE = '/api';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return false;
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return false;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    // Try to refresh the token
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? tryRefreshToken());
    if (refreshed) {
      // Retry the original request with new token
      const newToken = localStorage.getItem('token');
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      };
      const retryResponse = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
      if (!retryResponse.ok) {
        throw new Error(`API error: ${retryResponse.status}`);
      }
      return retryResponse.json();
    } else {
      // Refresh failed — redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

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
  fullChatAccess: boolean // direct Synthia access
  maxProjects: number
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
  projectId?: number
}

export interface ChatProject {
  id: number
  name: string
  slug: string
  repoFullName: string
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
  description?: string
  createdByUserId: number
  createdByEmail?: string
  createdAt: string
  readyAt?: string
}

export interface ProjectMember {
  id: number
  projectId: number
  userId: number
  role: string // owner, developer, viewer
  bugAccess?: string | null     // null = inherit, or: none, submit, execute
  featureAccess?: string | null // null = inherit, or: none, submit, execute
  chatAccess?: string | null    // null = inherit, or: none, guide, bug, developer
  globalBugAccess?: string      // user's global value (for display)
  globalFeatureAccess?: string
  globalChatAccess?: string
  addedAt: string
  addedBy?: number
  userEmail?: string
  userDisplayName?: string
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

export interface FeaturedProject {
  id: number
  title: string
  description?: string
  projectId?: number
  url: string
  thumbnailPath?: string       // Legacy field
  thumbnailAssetId?: number    // New: FK to Assets table
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface ReorderItem {
  id: number
  sortOrder: number
}

export interface DemoRequestItem {
  id: number
  email: string
  name: string
  reason: string
  ipAddress?: string
  location?: string
  status: string
  createdAt: string
  reviewedAt?: string
  reviewedBy?: number
}

// ── Proposal types ──

export interface ProposalListItem {
  id: number
  title: string
  polishedDescription?: string
  shareToken: string
  status: string
  likeCount: number
  featureCount: number
  createdAt: string
}

export interface ProposalFeature {
  id: number
  proposalId: number
  description: string
  authorId?: number
  authorName?: string
  createdAt: string
}

export interface ProposalPublicView {
  id: number
  title: string
  polishedDescription?: string
  problem?: string
  shareToken: string
  status: string
  likeCount: number
  features: ProposalFeature[]
  createdAt: string
}

export interface ProjectProposal {
  id: number
  title: string
  rawDescription: string
  polishedDescription?: string
  problem?: string
  proposerRole?: string
  expectedUsers?: number
  expectedMonthlyValue?: number
  shareToken: string
  status: string
  declineReason?: string
  proposerId?: number
  likeCount: number
  createdAt: string
  updatedAt: string
}

export interface ProposalAdminView {
  id: number
  title: string
  rawDescription: string
  polishedDescription?: string
  problem?: string
  proposerRole?: string
  expectedUsers?: number
  expectedMonthlyValue?: number
  shareToken: string
  status: string
  declineReason?: string
  proposerId?: number
  proposerEmail?: string
  likeCount: number
  featureCount: number
  supporterCount: number
  weightedValueScore: number
  createdAt: string
  updatedAt: string
  features?: ProposalFeature[]
  valueEstimates?: { id: number; proposalId: number; userId?: number; isAnonymous: boolean; wouldPay: boolean; monthlyAmount?: number; weight: number; createdAt: string }[]
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchApi<{ token: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refreshToken: (refreshToken: string) =>
    fetchApi<{ token: string; refreshToken: string; user: User }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    fetchApi<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  getMe: () => fetchApi<User>('/auth/me'),

  getUsers: () => fetchApi<User[]>('/auth/users'),

  registerUser: (email: string, displayName: string, password: string, role: string) =>
    fetchApi<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, password, role }),
    }),

  updateUser: (id: number, patch: { role?: string; repos?: string; isActive?: boolean; bugAccess?: string; featureAccess?: string; chatAccess?: string; fullChatAccess?: boolean; maxProjects?: number; displayName?: string }) =>
    fetchApi<{ message: string }>(`/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  updateProfile: (data: { displayName?: string }) =>
    fetchApi<{ message: string }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  resetPassword: (userId: number, newPassword: string) =>
    fetchApi<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
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

  createProject: (data: { name: string; slug: string; domain: string; description?: string; repoFullName?: string; linkExisting?: boolean }) =>
    fetchApi<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProject: (id: number, data: { name?: string; description?: string; repoFullName?: string; domain?: string }) =>
    fetchApi<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProject: (id: number) =>
    fetchApi<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }),

  deployPlaceholder: (id: number) =>
    fetchApi<{ message: string; domain: string }>(`/projects/${id}/deploy-placeholder`, {
      method: 'POST',
    }),

  getProjectSlots: () =>
    fetchApi<{ used: number; max: number; remaining: number }>('/projects/slots'),

  // Project Members
  getProjectMembers: (projectId: number) =>
    fetchApi<ProjectMember[]>(`/projects/${projectId}/members`),

  addProjectMember: (projectId: number, userId: number, role: string) =>
    fetchApi<ProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),

  updateProjectMemberRole: (projectId: number, userId: number, role: string) =>
    fetchApi<{ message: string }>(`/projects/${projectId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeProjectMember: (projectId: number, userId: number) =>
    fetchApi<{ message: string }>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

  updateProjectMemberPermissions: (projectId: number, userId: number, permissions: { bugAccess?: string | null; featureAccess?: string | null; chatAccess?: string | null }) =>
    fetchApi<{ message: string }>(`/projects/${projectId}/members/${userId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(permissions),
    }),

  // Chat
  getChatProjects: () =>
    fetchApi<ChatProject[]>('/chat/projects'),

  getChatHistory: (limit = 50, projectId?: number) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (projectId) params.set('projectId', String(projectId));
    return fetchApi<ChatHistoryResponse>(`/chat/history?${params}`);
  },

  getChatAccess: () =>
    fetchApi<ChatAccessResponse>('/chat/access'),

  getDeepgramToken: () =>
    fetchApi<{ token: string }>('/chat/deepgram-token'),

  clearChatHistory: (projectId?: number) => {
    const params = projectId ? `?projectId=${projectId}` : '';
    return fetchApi<{ message: string }>(`/chat/history${params}`, { method: 'DELETE' });
  },

  chatStream: async (
    message: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError?: (error: string) => void,
    projectId?: number,
    imageDataUrl?: string
  ) => {
    const token = localStorage.getItem('token');
    try {
      const body: Record<string, unknown> = { message };
      if (projectId) body.projectId = projectId;
      if (imageDataUrl) body.imageDataUrl = imageDataUrl;

      const response = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
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

  // Full Chat (Direct Synthia Access)
  getFullChatAccess: () =>
    fetchApi<{ hasAccess: boolean }>('/chat/full/access'),

  streamFullChat: async (
    message: string,
    history: { role: string; content: string }[],
    onChunk: (text: string) => void,
    onDone: () => void,
    onError?: (error: string) => void
  ) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/chat/full/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, history }),
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

  // Featured Projects
  getFeaturedProjects: () =>
    fetchApi<FeaturedProject[]>('/featuredprojects'),

  getFeaturedProjectsAdmin: () =>
    fetchApi<FeaturedProject[]>('/featuredprojects/admin'),

  createFeaturedProject: (data: Omit<FeaturedProject, 'id' | 'createdAt' | 'updatedAt' | 'thumbnailPath'>) =>
    fetchApi<FeaturedProject>('/featuredprojects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFeaturedProject: (id: number, data: Partial<FeaturedProject>) =>
    fetchApi<FeaturedProject>(`/featuredprojects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteFeaturedProject: (id: number) =>
    fetchApi<{ message: string }>(`/featuredprojects/${id}`, { method: 'DELETE' }),

  uploadFeaturedThumbnail: (id: number, imageData: string) =>
    fetchApi<{ assetId: number; url: string }>(`/featuredprojects/${id}/thumbnail`, {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    }),

  reorderFeaturedProjects: (items: ReorderItem[]) =>
    fetchApi<{ message: string }>('/featuredprojects/reorder', {
      method: 'POST',
      body: JSON.stringify(items),
    }),

  // Demo Requests
  requestDemo: (data: { email: string; name: string; reason: string }) =>
    fetchApi<{ message: string }>('/demo/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDemoRequests: () =>
    fetchApi<DemoRequestItem[]>('/demo/requests'),

  updateDemoRequest: (id: number, status: string) =>
    fetchApi<{ message: string }>(`/demo/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Public Registration
  registerPublic: (data: { email: string; password: string; firstName: string; lastName: string; phoneNumber?: string }) =>
    fetchApi<{ token: string; refreshToken: string; user: User }>('/auth/register/public', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Proposals
  getProposals: (page = 1, pageSize = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set('search', search)
    return fetchApi<ProposalListItem[]>(`/proposals?${params}`)
  },

  getProposalByToken: (shareToken: string) =>
    fetchApi<{ proposal: ProposalPublicView; hasLiked: boolean }>(`/proposals/${shareToken}`),

  createProposal: (data: { title: string; description: string; problem?: string; proposerRole?: string; expectedUsers?: number; expectedMonthlyValue?: number }) =>
    fetchApi<ProjectProposal>('/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  polishDescription: (description: string) =>
    fetchApi<{ polished: string }>('/proposals/polish', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),

  updateProposal: (id: number, data: { polishedDescription?: string; status?: string }) =>
    fetchApi<ProjectProposal>(`/proposals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getMyProposals: () =>
    fetchApi<ProposalListItem[]>('/proposals/mine'),

  likeProposal: (shareToken: string) =>
    fetchApi<{ liked: boolean; likeCount: number }>(`/proposals/${shareToken}/like`, {
      method: 'POST',
    }),

  addProposalFeature: (shareToken: string, description: string, authorName?: string) =>
    fetchApi<ProposalFeature>(`/proposals/${shareToken}/features`, {
      method: 'POST',
      body: JSON.stringify({ description, authorName }),
    }),

  addProposalValue: (shareToken: string, wouldPay: boolean, monthlyAmount?: number) =>
    fetchApi<{ message: string; weight: number }>(`/proposals/${shareToken}/value`, {
      method: 'POST',
      body: JSON.stringify({ wouldPay, monthlyAmount }),
    }),

  // Admin Proposals
  getAdminProposals: () =>
    fetchApi<ProposalAdminView[]>('/proposals/admin'),

  getAdminProposalDetail: (id: number) =>
    fetchApi<ProposalAdminView>(`/proposals/admin/${id}`),

  updateProposalStatus: (id: number, status: string, reason?: string) =>
    fetchApi<{ message: string }>(`/proposals/admin/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    }),

  getWeeklyProposals: () =>
    fetchApi<ProposalAdminView[]>('/proposals/admin/weekly'),
};
