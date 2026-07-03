const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'teacher' | 'student';
};

export type ClassItem = {
  id: string;
  name: string;
  code: string;
  description: string;
  teacher_name?: string;
  student_count?: number;
};

export type Activity = {
  id: string;
  class_id: string;
  type: 'wall' | 'quiz' | 'survey';
  title: string;
  config: Record<string, unknown>;
  created_at: string;
};

function getToken() {
  return localStorage.getItem('lms_token') || '';
}

export function setAuth(token: string, user: User) {
  localStorage.setItem('lms_token', token);
  localStorage.setItem('lms_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem('lms_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>('/auth/me'),
  stats: () => request<{ classes: number; activities: number; users: number }>('/stats'),
  classes: () => request<{ data: ClassItem[] }>('/classes'),
  createClass: (body: { name: string; description?: string }) =>
    request<{ data: ClassItem }>('/classes', { method: 'POST', body: JSON.stringify(body) }),
  joinClass: (code: string) =>
    request<{ data: ClassItem }>('/classes/join', { method: 'POST', body: JSON.stringify({ code }) }),
  classDetail: (id: string) => request<{ data: ClassItem }>(`/classes/${id}`),
  activities: (classId: string) => request<{ data: Activity[] }>(`/classes/${classId}/activities`),
  createActivity: (classId: string, body: { type: string; title: string }) =>
    request<{ data: Activity }>(`/classes/${classId}/activities`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  wall: (id: string) =>
    request<{ activity: Activity; posts: Array<{ id: string; content: string; author_name: string; created_at: string }> }>(
      `/activities/${id}/wall`,
    ),
  addWallPost: (id: string, content: string) =>
    request<{ data: { id: string; content: string; author_name: string; created_at: string } }>(
      `/activities/${id}/wall/posts`,
      { method: 'POST', body: JSON.stringify({ content }) },
    ),
  quiz: (id: string) =>
    request<{ activity: Activity; questions: Array<{ id: string; question: string; options: string[]; time_limit: number }> }>(
      `/activities/${id}/quiz`,
    ),
  addQuizQuestion: (id: string, body: { question: string; options: string[]; correct_index: number }) =>
    request(`/activities/${id}/quiz/questions`, { method: 'POST', body: JSON.stringify(body) }),
  createQuizSession: (id: string) =>
    request<{ data: { id: string; pin: string } }>(`/activities/${id}/quiz/sessions`, { method: 'POST' }),
  joinQuiz: (pin: string) => request<{ session: { id: string; pin: string; quiz_title: string } }>('/quiz/join', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  }),
  quizSession: (id: string) =>
    request<{
      session: { id: string; status: string; pin: string };
      questions: Array<{ id: string; question: string; options: string[] }>;
      leaderboard: Array<{ name: string; total_score: number }>;
    }>(`/quiz/sessions/${id}`),
  startQuizSession: (id: string) =>
    request(`/quiz/sessions/${id}/start`, { method: 'POST' }),
  submitAnswer: (sessionId: string, body: { question_id: string; answer_index: number }) =>
    request<{ correct: boolean }>(`/quiz/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
