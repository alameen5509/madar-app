import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';
import type {
  SmartTask, LifeCircle, Goal, SalahTimes, User,
  Habit, TokenResponse, Project, InboxItem,
  NotificationPreference, Contact,
} from './types';

export const API_BASE_URL = 'https://madar-api-app.azurewebsites.net';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const accessToken = await getAccessToken();
        const refreshToken = await getRefreshToken();
        if (!accessToken || !refreshToken) throw new Error('No tokens');
        const { data } = await axios.post<TokenResponse>(`${API_BASE_URL}/api/auth/refresh-token`, {
          accessToken,
          refreshToken,
        });
        await setTokens(data.accessToken, data.refreshToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        await clearTokens();
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>('/api/auth/login', { email, password }),
  register: (fullName: string, email: string, password: string, role = 'User') =>
    api.post('/api/auth/register', { fullName, email, password, role }),
  refreshToken: (accessToken: string, refreshToken: string) =>
    api.post<TokenResponse>('/api/auth/refresh-token', { accessToken, refreshToken }),
};

// ─── Tasks ───────────────────────────────────────────────────
export const tasksApi = {
  list: () => api.get<SmartTask[]>('/api/tasks'),
  create: (data: {
    title: string;
    description?: string;
    userPriority?: number;
    cognitiveLoad?: string;
    dueDate?: string;
    lifeCircleId?: string;
    goalId?: string;
    parentTaskId?: string;
    isRecurring?: boolean;
    recurrenceRule?: string;
    isWorkTask?: boolean;
    isUrgent?: boolean;
    waitingFor?: string;
    taskContext?: string;
  }) => api.post<SmartTask>('/api/tasks', data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/tasks/${id}/status`, { status }),
  update: (id: string, data: { title?: string; description?: string; userPriority?: number; taskContext?: string }) =>
    api.post(`/api/tasks/${id}/update`, data),
  subtasks: (id: string) => api.get<SmartTask[]>(`/api/tasks/${id}/subtasks`),
  accept: (id: string, accept: boolean) =>
    api.patch(`/api/tasks/${id}/accept`, { accept }),
  assign: (data: { targetEmail: string; title: string; description?: string; userPriority?: number }) =>
    api.post('/api/tasks/assign', data),
  transfer: (taskId: string, targetEmail: string) =>
    api.post(`/api/tasks/${taskId}/transfer`, { targetEmail }),
};

// ─── Circles ─────────────────────────────────────────────────
export const circlesApi = {
  list: () => api.get<LifeCircle[]>('/api/circles'),
  create: (data: { name: string; description?: string; iconKey?: string; colorHex?: string; tier?: string; displayOrder?: number; isShariaPriority?: boolean; parentCircleId?: string }) =>
    api.post('/api/circles', data),
  update: (id: string, data: { name?: string; description?: string; iconKey?: string; colorHex?: string }) =>
    api.patch(`/api/circles/${id}`, data),
  delete: (id: string) => api.delete(`/api/circles/${id}`),
  tasks: (id: string) => api.get<SmartTask[]>(`/api/circles/${id}/tasks`),
};

// ─── Goals — see extended goalsApi below ─────────────────────

// ─── Users ───────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get<User[]>('/api/users'),
  tasks: (userId: string) => api.get<SmartTask[]>(`/api/users/${userId}/tasks`),
  goals: (userId: string) => api.get<Goal[]>(`/api/users/${userId}/goals`),
  update: (userId: string, data: { fullName?: string; isActive?: boolean }) =>
    api.patch(`/api/users/${userId}`, data),
};

// ─── Habits ──────────────────────────────────────────────────
export const habitsApi = {
  list: () => api.get<Habit[]>('/api/habits'),
  create: (data: { title: string; icon?: string; category?: string; isIdea?: boolean }) =>
    api.post('/api/habits', data),
  toggle: (id: string) => api.patch(`/api/habits/${id}/toggle`),
  toggleIdea: (id: string) => api.patch(`/api/habits/${id}/idea`),
  delete: (id: string) => api.delete(`/api/habits/${id}`),
};

// ─── Salah ───────────────────────────────────────────────────
export const salahApi = {
  today: () => api.get<SalahTimes>('/api/salah/today'),
};

// ─── Inbox ───────────────────────────────────────────────────
export const inboxApi = {
  list: () => api.get<InboxItem[]>('/api/inbox'),
  markRead: (id: string) => api.patch(`/api/inbox/${id}/read`),
  markAllRead: () => api.patch('/api/inbox/read-all'),
};

// ─── Admin ───────────────────────────────────────────────────
export const adminApi = {
  allTasks: () => api.get<SmartTask[]>('/api/admin/tasks'),
  updateTask: (id: string, data: Partial<SmartTask>) =>
    api.put(`/api/admin/tasks/${id}`, data),
  projectBudget: (projectId: string) =>
    api.get(`/api/admin/projects/${projectId}/budget`),
  impersonate: (userId: string) =>
    api.post<TokenResponse>(`/api/admin/impersonate/${userId}`),
  stopImpersonation: () =>
    api.post<TokenResponse>('/api/admin/stop-impersonation'),
};

// ─── Projects ────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get<Project[]>('/api/projects'),
  create: (data: { title: string; description?: string; budget?: number; currency?: string }) =>
    api.post('/api/projects', data),
  get: (id: string) => api.get<Project>(`/api/projects/${id}`),
  update: (id: string, data: Partial<Project>) =>
    api.patch(`/api/projects/${id}`, data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
};

// ─── Notifications ───────────────────────────────────────────
export const notificationsApi = {
  registerDevice: (token: string, platform: string) =>
    api.post('/api/notifications/register-device', { token, platform }),
  unregisterDevice: (token: string) =>
    api.delete('/api/notifications/unregister-device', { data: { token } }),
  getPreferences: () => api.get<NotificationPreference>('/api/notifications/preferences'),
  updatePreferences: (data: Partial<NotificationPreference>) =>
    api.put('/api/notifications/preferences', data),
};

// ─── Watch ───────────────────────────────────────────────────
export const watchApi = {
  link: (code: string) => api.post('/api/watch-auth/link', { code }),
  requestLink: (deviceId: string, deviceName: string) =>
    api.post('/api/watch-auth/request-link', { deviceId, deviceName }),
  approveLink: (requestId: string) =>
    api.post('/api/watch-auth/approve-link', { requestId }),
  rejectLink: (requestId: string) =>
    api.post('/api/watch-auth/reject-link', { requestId }),
};

// ─── Contacts ────────────────────────────────────────────────
export const contactsApi = {
  list: () => api.get<Contact[]>('/api/contacts'),
  create: (data: { name: string; phone: string; notes?: string }) =>
    api.post<Contact>('/api/contacts', data),
  update: (id: string, data: { name?: string; phone?: string; notes?: string }) =>
    api.put(`/api/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/api/contacts/${id}`),
  import: (contacts: { name: string; phone: string }[]) =>
    api.post<{ added: number }>('/api/contacts/import', { contacts }),
  tasks: (id: string) => api.get(`/api/contacts/${id}/tasks`),
};

// ─── Goals (projects) ────────────────────────────────────────
export const goalsApi = {
  list: () => api.get<Goal[]>('/api/goals'),
  create: (data: { title: string; description?: string; targetDate?: string; priorityWeight?: number; lifeCircleId?: string }) =>
    api.post('/api/goals', data),
  update: (id: string, data: { title?: string; description?: string; status?: string; lifeCircleId?: string }) =>
    api.patch(`/api/goals/${id}`, data),
  delete: (id: string) => api.delete(`/api/goals/${id}`),
  tasks: (id: string) => api.get(`/api/goals/${id}/tasks`),
};

export { api };
export default api;
