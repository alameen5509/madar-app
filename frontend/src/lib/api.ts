import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to /login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      document.cookie = 'accessToken=; path=/; max-age=0';
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
  userPriority: number;        // 1–5
  aiPriorityScore: number;     // 0–100
  cognitiveLoad: 'Low' | 'Medium' | 'High' | 'Deep';
  dueDate?: string;
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
  const { data } = await api.post<AuthResult>('/auth/login', { email, password });

  if (data.succeeded && data.accessToken) {
    localStorage.setItem('accessToken', data.accessToken);
    document.cookie = `accessToken=${data.accessToken}; path=/; SameSite=Lax; max-age=86400`;
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
  const { data } = await api.post<AuthResult>('/auth/register', {
    fullName,
    email,
    password,
    role,
  });

  return data;
}

export async function refreshToken(): Promise<AuthResult> {
  const accessToken = localStorage.getItem('accessToken') ?? '';
  const storedRefresh = localStorage.getItem('refreshToken') ?? '';

  const { data } = await api.post<AuthResult>('/auth/refresh-token', {
    accessToken,
    refreshToken: storedRefresh,
  });

  if (data.succeeded && data.accessToken) {
    localStorage.setItem('accessToken', data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
  }

  return data;
}

export function logout(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  document.cookie = 'accessToken=; path=/; max-age=0';
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
