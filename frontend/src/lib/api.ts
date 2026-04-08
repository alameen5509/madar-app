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
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
});

// Attach JWT token from cookie or localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    let token = getCookieValue('madar_token');
    if (!token) {
      token = localStorage.getItem('accessToken') ?? '';
    }
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
  goal?: { id: string; title: string };
  cost?: number;
  costCurrency?: string;
  assignedTo?: { id: string; fullName: string };
  projectId?: string;
  project?: { id: string; title: string };
  root?: {
    kind: 'job' | 'role';
    entityId: string;
    entityName: string;
    entitySlug?: string | null;
    dimensionId: string;
    dimensionName: string;
    goalId: string;
    goalTitle: string;
  } | null;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: 'Active' | 'Paused' | 'Completed' | 'Archived' | 'Draft' | 'Critical' | 'Suspended';
  targetDate?: string;
  priorityWeight: number;
  focusType?: 'Tech' | 'NonTech' | null;
  suspendedUntil?: string;
  suspendReason?: string;
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
  status: 'Active' | 'Paused' | 'Completed' | 'Archived' | 'Draft' | 'Critical';
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

const CITY_COORDS: Record<string, { lat: string; lng: string }> = {
  riyadh: { lat: "24.7136", lng: "46.6753" }, madinah: { lat: "24.4672", lng: "39.6024" },
  makkah: { lat: "21.4225", lng: "39.8262" }, jeddah: { lat: "21.5433", lng: "39.1728" },
  dammam: { lat: "26.4207", lng: "50.0888" }, tabuk: { lat: "28.3838", lng: "36.5550" },
  abha: { lat: "18.2164", lng: "42.5053" },
};

/** Uses saved city from localStorage, or defaults to Riyadh */
export async function getSalahToday(
  lat?: string,
  lng?: string,
): Promise<SalahTimesResponse> {
  if (!lat || !lng) {
    const savedCity = typeof window !== "undefined" ? localStorage.getItem("madar_prayer_city") : null;
    const coords = savedCity && savedCity !== "auto" ? CITY_COORDS[savedCity] : null;
    lat = coords?.lat ?? "24.7136";
    lng = coords?.lng ?? "46.7219";
  }
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
  role: 'User' | 'BusinessOwner' = 'User'
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
  suitablePeriod?: string;
  cost?: number;
  costCurrency?: string;
  assignedToEmail?: string;
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

export async function getGoalTasks(goalId: string): Promise<SmartTask[]> {
  const { data } = await api.get<SmartTask[]>(`/api/goals/${goalId}/tasks`);
  return data;
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

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  taskCount: number;
}

export async function getContacts(): Promise<Contact[]> {
  const { data } = await api.get<Contact[]>('/api/contacts');
  return data;
}

export async function createContact(payload: { name: string; phone: string; notes?: string }): Promise<Contact> {
  const { data } = await api.post<Contact>('/api/contacts', payload);
  return data;
}

export async function updateContact(id: string, payload: { name?: string; phone?: string; notes?: string }): Promise<void> {
  await api.put(`/api/contacts/${id}`, payload);
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/api/contacts/${id}`);
}

export async function importContacts(contacts: { name: string; phone: string }[]): Promise<{ added: number }> {
  const { data } = await api.post('/api/contacts/import', { contacts });
  return data;
}

export function formatPhoneForCall(phone: string): string {
  return `tel:+${phone}`;
}

export function formatPhoneForWhatsApp(phone: string): string {
  return `https://wa.me/${phone}`;
}

// ─── Task Status Update ──────────────────────────────────────────────────────

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  await api.patch(`/api/tasks/${id}/status`, { status });
}

export async function transferTask(taskId: string, targetEmail: string): Promise<{ message: string }> {
  const { data } = await api.post(`/api/tasks/${taskId}/transfer`, { targetEmail });
  return data;
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export interface MeetingAttendee {
  id: string;
  name: string;
  role: string;
  status: string;
  notes?: string;
  contactId?: string;
}

export interface MeetingAgendaItem {
  id: string;
  title: string;
  description?: string;
  duration: number;
  displayOrder: number;
  isCompleted: boolean;
}

export interface MeetingMinute {
  id: string;
  content: string;
  createdAt: string;
}

export interface MeetingActionItem {
  id: string;
  title: string;
  assignedTo?: string;
  dueDate?: string;
  isCompleted: boolean;
  taskId?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  meetingType: string;
  platform?: string;
  location?: string;
  meetingLink?: string;
  startTime: string;
  endTime?: string;
  status: string;
  recurrence?: string;
  notes?: string;
  isPrivate?: boolean;
  createdAt?: string;
  updatedAt?: string;
  projectId?: string;
  workId?: string;
  circleId?: string;
  project?: { id: string; title: string };
  work?: { id: string; name: string };
  circle?: { id: string; name: string };
  attendees?: MeetingAttendee[];
  agenda?: MeetingAgendaItem[];
  minutes?: MeetingMinute[];
  actionItems?: MeetingActionItem[];
  attendeeCount?: number;
}

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  meetingType?: string;
  platform?: string;
  location?: string;
  meetingLink?: string;
  startTime: string;
  endTime?: string;
  recurrence?: string;
  notes?: string;
  isPrivate?: boolean;
  projectId?: string;
  workId?: string;
  circleId?: string;
  attendees?: { name: string; role?: string; notes?: string }[];
  agenda?: { title: string; description?: string; duration?: number }[];
}

export async function getMeetings(params?: { status?: string; date?: string }): Promise<Meeting[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.date) q.set('date', params.date);
  const { data } = await api.get<Meeting[]>(`/api/meetings${q.toString() ? '?' + q : ''}`);
  return data;
}

export async function getMeetingsToday(): Promise<Meeting[]> {
  const { data } = await api.get<Meeting[]>('/api/meetings/today');
  return data;
}

export async function getMeetingsUpcoming(): Promise<Meeting[]> {
  const { data } = await api.get<Meeting[]>('/api/meetings/upcoming');
  return data;
}

export async function getMeeting(id: string): Promise<Meeting> {
  const { data } = await api.get<Meeting>(`/api/meetings/${id}`);
  return data;
}

export async function createMeeting(payload: CreateMeetingPayload): Promise<{ id: string; title: string }> {
  const { data } = await api.post('/api/meetings', payload);
  return data;
}

export async function updateMeeting(id: string, payload: Partial<CreateMeetingPayload> & { status?: string }): Promise<void> {
  await api.patch(`/api/meetings/${id}`, payload);
}

export async function deleteMeeting(id: string): Promise<void> {
  await api.delete(`/api/meetings/${id}`);
}

export async function completeMeeting(id: string): Promise<void> {
  await api.post(`/api/meetings/${id}/complete`);
}

export async function cancelMeeting(id: string): Promise<void> {
  await api.post(`/api/meetings/${id}/cancel`);
}

// Attendees
export async function addMeetingAttendee(meetingId: string, payload: { name: string; role?: string; notes?: string }): Promise<MeetingAttendee> {
  const { data } = await api.post(`/api/meetings/${meetingId}/attendees`, payload);
  return data;
}

export async function updateMeetingAttendee(id: string, payload: { name?: string; role?: string; status?: string; notes?: string }): Promise<void> {
  await api.patch(`/api/meetings/attendees/${id}`, payload);
}

export async function removeMeetingAttendee(id: string): Promise<void> {
  await api.delete(`/api/meetings/attendees/${id}`);
}

// Agenda
export async function addMeetingAgendaItem(meetingId: string, payload: { title: string; description?: string; duration?: number }): Promise<MeetingAgendaItem> {
  const { data } = await api.post(`/api/meetings/${meetingId}/agenda`, payload);
  return data;
}

export async function updateMeetingAgendaItem(id: string, payload: { title?: string; description?: string; duration?: number; isCompleted?: boolean }): Promise<void> {
  await api.patch(`/api/meetings/agenda/${id}`, payload);
}

export async function removeMeetingAgendaItem(id: string): Promise<void> {
  await api.delete(`/api/meetings/agenda/${id}`);
}

// Minutes
export async function addMeetingMinute(meetingId: string, content: string): Promise<MeetingMinute> {
  const { data } = await api.post(`/api/meetings/${meetingId}/minutes`, { content });
  return data;
}

export async function removeMeetingMinute(id: string): Promise<void> {
  await api.delete(`/api/meetings/minutes/${id}`);
}

// Action Items
export async function addMeetingActionItem(meetingId: string, payload: { title: string; assignedTo?: string; dueDate?: string }): Promise<MeetingActionItem> {
  const { data } = await api.post(`/api/meetings/${meetingId}/actions`, payload);
  return data;
}

export async function updateMeetingActionItem(id: string, payload: { title?: string; assignedTo?: string; dueDate?: string; isCompleted?: boolean }): Promise<void> {
  await api.patch(`/api/meetings/actions/${id}`, payload);
}

export async function removeMeetingActionItem(id: string): Promise<void> {
  await api.delete(`/api/meetings/actions/${id}`);
}
