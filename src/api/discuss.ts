import client from './client';

export interface Thread {
  id:            number;
  title:         string;
  body:          string | null;
  ticker:        string | null;
  score:         number;
  user_vote:     1 | -1 | 0;
  author:        string;
  username:      string | null;
  avatar_url:    string | null;
  user_id:       number;
  comment_count: number;
  created_at:    string;
  edited_at:     string | null;
}

export interface Comment {
  id:         number;
  thread_id:  number;
  body:       string;
  score:      number;
  user_vote:  1 | -1 | 0;
  author:     string;
  username:   string | null;
  avatar_url: string | null;
  user_id:    number;
  created_at: string;
}

export interface ThreadDetail extends Thread {
  comments: Comment[];
}

export const getThreads = (
  ticker?: string,
  sort: 'new' | 'top' = 'new',
  limit = 20,
  offset = 0,
  q = '',
) =>
  client
    .get<Thread[]>('/api/discuss/threads', { params: { ticker, sort, limit, offset, q: q || undefined } })
    .then((r) => r.data);

export const getThread = (id: number) =>
  client.get<ThreadDetail>(`/api/discuss/threads/${id}`).then((r) => r.data);

export const createThread = (data: { title: string; body?: string; ticker?: string }) =>
  client.post<Thread>('/api/discuss/threads', data).then((r) => r.data);

export const updateThread = (id: number, data: { title: string; body?: string }) =>
  client.put<Thread>(`/api/discuss/threads/${id}`, data).then((r) => r.data);

export const addComment = (threadId: number, body: string) =>
  client.post<Comment>(`/api/discuss/threads/${threadId}/comments`, { body }).then((r) => r.data);

export const voteThread = (id: number, direction: 'up' | 'down') =>
  client
    .post<{ score: number; user_vote: 1 | -1 | 0 }>(`/api/discuss/threads/${id}/vote`, { direction })
    .then((r) => r.data);

export const voteComment = (id: number, direction: 'up' | 'down') =>
  client
    .post<{ score: number; user_vote: 1 | -1 | 0 }>(`/api/discuss/comments/${id}/vote`, { direction })
    .then((r) => r.data);

export const deleteThread = (id: number) =>
  client.delete(`/api/discuss/threads/${id}`).then((r) => r.data);

export const deleteComment = (id: number) =>
  client.delete(`/api/discuss/comments/${id}`).then((r) => r.data);
