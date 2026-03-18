import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://madar-api-app.azurewebsites.net';

// ─── Cookie Helper ────────────────────────────────────────────────────────────

function getCookieValue(name: string): string {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : '';
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from madar_token cookie to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getCookieValue('madar_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// On 401: try refresh token, else redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Try refresh before giving up
      try {
        const storedRefresh = localStorage.getItem('refreshToken') ?? '';
        const currentToken = getCookieValue('madar_token');
        if (storedRefresh && currentToken) {
          const { data } = await axios.post(`${BASE_URL}/api/auth/refresh-token`, {
            accessToken: currentToken,
            refreshToken: storedRefresh,
          });
          if (data.succeeded && data.data?.accessToken) {
            const newToken = data.data.accessToken;
            document.cookie = `madar_token=${newToken}; path=/; SameSite=Lax; max-age=86400`;
            if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
            // Retry original request
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          }
        }
      } catch {}
      document.cookie = 'madar_token=; path=/; max-age=0';
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  succeeded: boolean;
  accessToken?: string;
  refreshToken?: string;
  errors?: string[];
}

export interface SmartTask {
  id: string;
  title: string;
  description?: string;
  status: 'Inbox' | 'Todo' | 'Scheduled' | 'InProgress' | 'Completed' | 'Deferred' | 'Cancelled';
  userPriority: number;
  aiPriorityScore: number;
  cognitiveLoad: 'Low' | 'Medium' | 'High' | 'Deep';
  dueDate?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  contextNote?: string;
  estimatedDurationMinutes?: number;
  actualDurationMinutes?: number;
  completedAt?: string;
  createdAt?: string;
  wasCompletedOnTime?: boolean;
  lifeCircle?: { id: string; name: string; color: string; icon: string };
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: 'Active' | 'Paused' | 'Completed' | 'Archived';
  targetDate?: string;
  priorityWeight: number;
  progressPercent: number;
  lifeCircle?: { id: string; name: string; color: string };
}

export interface SalahTimesResponse {
  date: string;
  fajr:    string;
  shuruq:  string;
  dhuhr:   string;
  asr:     string;
  maghrib: string;
  isha:    string;
}

export interface CircleGoal {
  id: string;
  title: string;
  description?: string;
  status: 'Active' | 'Paused' | 'Completed' | 'Archived';
  targetDate?: string;
  progressPercent: number;
}

export interface LifeCircle {
  id: string;
  name: string;
  description?: string;
  iconKey?: string;
  colorHex?: string;
  tier: 'Base' | 'First' | 'Second' | 'Business';
  displayOrder: number;
  isShariaPriority: boolean;
  isActive: boolean;
  parentCircleId?: string;
  goalCount: number;
  taskCount: number;
  completedTaskCount: number;
  progressPercent: number;
  goals: CircleGoal[];
}

export interface CreateCirclePayload {
  name: string;
  description?: string;
  iconKey?: string;
  colorHex?: string;
  tier?: string;
  displayOrder?: number;
  isShariaPriority?: boolean;
  parentCircleId?: string;
}

// ─── Data Functions ───────────────────────────────────────────────────────────

export async function getTasks(): Promise<SmartTask[]> {
  const { data } = await api.get<SmartTask[]>('/api/tasks');
  return data;
}

export async function getGoals(): Promise<Goal[]> {
  const { data } = await api.get<Goal[]>('/api/goals');
  return data;
}

export async function getCircles(): Promise<LifeCircle[]> {
  const { data } = await api.get<LifeCircle[]>('/api/circles');
  return data;
}

export async function createCircle(payload: CreateCirclePayload): Promise<LifeCircle> {
  const { data } = await api.post<LifeCircle>('/api/circles', payload);
  return data;
}

/** lat/lng default to Riyadh; replace with user's stored coords when available */
export async function getSalahToday(
  lat = '24.6877',
  lng = '46.7219',
): Promise<SalahTimesResponse> {
  const { data } = await api.get<SalahTimesResponse>(
    `/api/salah/today?lat=${lat}&lng=${lng}`,
  );
  return data;
}

// ─── Auth Functions ───────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/api/auth/login', { email, password });

  if (data.succeeded && data.accessToken) {
    document.cookie = `madar_token=${data.accessToken}; path=/; SameSite=Lax; max-age=86400`;
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
  }

  return data;
}

export async function register(
  fullName: string,
  email: string,
  password: string,
  role = 'User'
): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/api/auth/register', {
    fullName,
    email,
    password,
    role,
  });

  return data;
}

export async function refreshToken(): Promise<AuthResult> {
  const accessToken = getCookieValue('madar_token');
  const storedRefresh = localStorage.getItem('refreshToken') ?? '';

  const { data } = await api.post<AuthResult>('/api/auth/refresh-token', {
    accessToken,
    refreshToken: storedRefresh,
  });

  if (data.succeeded && data.accessToken) {
    document.cookie = `madar_token=${data.accessToken}; path=/; SameSite=Lax; max-age=86400`;
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
  }

  return data;
}

export function logout(): void {
  localStorage.removeItem('refreshToken');
  document.cookie = 'madar_token=; path=/; max-age=0';
  window.location.href = '/login';
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  tag?: string;
  isRead: boolean;
}

export async function getInbox(): Promise<InboxMessage[]> {
  const { data } = await api.get<InboxMessage[]>('/api/inbox');
  return data;
}

export async function markMessageRead(id: string): Promise<void> {
  await api.patch(`/api/inbox/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.post('/api/inbox/read-all');
}

// ─── Create Task / Goal ───────────────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string;
  description?: string;
  userPriority?: number;
  cognitiveLoad?: 'Low' | 'Medium' | 'High' | 'Deep';
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
}

export interface SubTask {
  id: string;
  title: string;
  status: string;
  userPriority: number;
}

export interface CreateGoalPayload {
  title: string;
  description?: string;
  targetDate?: string;
  priorityWeight?: number;
  lifeCircleId?: string;
}

export async function createTask(payload: CreateTaskPayload): Promise<SmartTask> {
  const { data } = await api.post<SmartTask>('/api/tasks', payload);
  return data;
}

export async function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  const { data } = await api.post<Goal>('/api/goals', payload);
  return data;
}

export async function updateGoal(
  id: string,
  payload: { title?: string; description?: string; targetDate?: string; priorityWeight?: number; status?: string; lifeCircleId?: string },
): Promise<Goal> {
  const { data } = await api.patch<Goal>(`/api/goals/${id}`, payload);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/api/goals/${id}`);
}

// ─── Circle Updates ──────────────────────────────────────────────────────────

export async function updateCircle(
  id: string,
  payload: { name?: string; description?: string; iconKey?: string; colorHex?: string },
): Promise<{ id: string; name: string; description?: string; iconKey?: string; colorHex: string }> {
  const { data } = await api.patch(`/api/circles/${id}`, payload);
  return data;
}

export interface CircleTask {
  id: string;
  title: string;
  status: string;
  userPriority: number;
  dueDate?: string;
}

export async function getCircleTasks(circleId: string): Promise<CircleTask[]> {
  const { data } = await api.get<CircleTask[]>(`/api/circles/${circleId}/tasks`);
  return data;
}

export async function deleteCircle(id: string): Promise<void> {
  await api.delete(`/api/circles/${id}`);
}

export async function acceptRejectTask(id: string, accept: boolean): Promise<void> {
  await api.patch(`/api/tasks/${id}/accept`, { accept });
}

export async function getSubTasks(taskId: string): Promise<SubTask[]> {
  const { data } = await api.get<SubTask[]>(`/api/tasks/${taskId}/subtasks`);
  return data;
}

export async function assignTask(
  targetEmail: string, title: string, description?: string, userPriority?: number,
): Promise<{ message: string }> {
  const { data } = await api.post('/api/tasks/assign', { targetEmail, title, description, userPriority });
  return data;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<{ id: string; fullName: string; email: string; isActive: boolean; lastLoginAt?: string; createdAt: string }[]> {
  const { data } = await api.get('/api/users');
  return data;
}

export async function getUserTasks(userId: string): Promise<{ id: string; title: string; status: string; userPriority: number; dueDate?: string; actualDuration?: number; wasOnTime?: boolean }[]> {
  const { data } = await api.get(`/api/users/${userId}/tasks`);
  return data;
}

export async function getUserGoals(userId: string): Promise<{ id: string; title: string; status: string; progressPercent: number }[]> {
  const { data } = await api.get(`/api/users/${userId}/goals`);
  return data;
}

export async function updateUser(userId: string, payload: { fullName?: string; isActive?: boolean }): Promise<void> {
  await api.patch(`/api/users/${userId}`, payload);
}

// ─── Task Status Update ──────────────────────────────────────────────────────

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  await api.patch(`/api/tasks/${id}/status`, { status });
}

export async function transferTask(taskId: string, targetEmail: string): Promise<{ message: string }> {
  const { data } = await api.post(`/api/tasks/${taskId}/transfer`, { targetEmail });
  return data;
}
