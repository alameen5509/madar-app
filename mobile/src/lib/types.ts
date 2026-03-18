// Enums matching backend
export type TaskStatus = 'Inbox' | 'Todo' | 'Scheduled' | 'InProgress' | 'Completed' | 'Deferred' | 'Cancelled';
export type TaskType = 'Action' | 'Project' | 'Event' | 'Habit' | 'Reference';
export type TaskContext = 'Anywhere' | 'Home' | 'Office' | 'Car' | 'Online' | 'Phone';
export type CognitiveLoad = 'Low' | 'Medium' | 'High' | 'Deep';
export type GoalStatus = 'Active' | 'Paused' | 'Completed' | 'Archived';
export type CircleTier = 'Base' | 'First' | 'Second' | 'Business' | 'Third' | 'Fourth' | 'Fifth';
export type ContractStatus = 'Draft' | 'Active' | 'PendingRenewal' | 'Expired' | 'Cancelled';

export interface SmartTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  userPriority: number;
  aiPriorityScore?: number;
  cognitiveLoad?: CognitiveLoad;
  dueDate?: string;
  scheduledStartAt?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  contextNote?: string;
  estimatedDurationMinutes?: number;
  actualDurationMinutes?: number;
  completedAt?: string;
  wasCompletedOnTime?: boolean;
  createdAt: string;
  updatedAt?: string;
  lifeCircle?: { id: string; name: string; colorHex?: string; iconKey?: string };
  goal?: { id: string; title: string };
  taskContext?: string;
  isWorkTask?: boolean;
  isUrgent?: boolean;
  waitingFor?: string;
  cost?: number;
  costCurrency?: string;
  assignedToId?: string;
  assignedTo?: { id: string; fullName: string };
  projectId?: string;
  project?: { id: string; title: string };
}

export interface LifeCircle {
  id: string;
  name: string;
  description?: string;
  iconKey?: string;
  colorHex?: string;
  tier: CircleTier;
  displayOrder: number;
  isShariaPriority: boolean;
  isActive: boolean;
  parentCircleId?: string;
  goalCount: number;
  taskCount: number;
  completedTaskCount: number;
  progressPercent: number;
  goals: Goal[];
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  targetDate?: string;
  priorityWeight: number;
  progressPercent: number;
  lifeCircle?: { id: string; name: string };
}

export interface SalahTimes {
  date: string;
  fajr: string;
  shuruq: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface InboxItem {
  id: string;
  content: string;
  isProcessed: boolean;
  convertedToTaskId?: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  title: string;
  icon: string;
  category: string;
  isIdea: boolean;
  streak: number;
  lastCompletedDate?: string;
  todayDone: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  budget: number;
  currency: string;
  createdAt: string;
  tasks?: SmartTask[];
  totalCost?: number;
}

export interface Contract {
  id: string;
  title: string;
  clientName: string;
  description?: string;
  status: ContractStatus;
  value: number;
  currency: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface NotificationPreference {
  overdueTasks: boolean;
  prayerReminders: boolean;
  habitReminders: boolean;
  inboxMessages: boolean;
  prayerReminderMinutesBefore: number;
}
