import client from './client';

export interface MiniThread {
  id:            number;
  title:         string;
  ticker:        string | null;
  upvotes:       number;
  comment_count: number;
  created_at:    string;
}

export interface PublicWatchlist {
  id:    number;
  name:  string;
  items: string[];
}

export interface PublicProfile {
  id:                number;
  username:          string;
  display_name:      string | null;
  first_name:        string | null;
  last_name:         string | null;
  bio:               string | null;
  avatar_url:        string | null;
  member_since:      string;
  thread_count:      number;
  threads:           MiniThread[];
  public_watchlists: PublicWatchlist[];
}

export const getPublicProfile = (username: string) =>
  client.get<PublicProfile>(`/api/users/${username}`).then((r) => r.data);

export interface FollowUser {
  id:       number;
  username: string;
}

export const followUser = (uid: number) =>
  client.post<{ following: boolean }>(`/api/users/${uid}/follow`).then((r) => r.data);

export const unfollowUser = (uid: number) =>
  client.delete<{ following: boolean }>(`/api/users/${uid}/follow`).then((r) => r.data);

export const getFollowStatus = (uid: number) =>
  client.get<{ following: boolean }>(`/api/users/${uid}/follow/status`).then((r) => r.data);

export const getFollowers = (uid: number) =>
  client.get<FollowUser[]>(`/api/users/${uid}/followers`).then((r) => r.data);

export const getFollowing = (uid: number) =>
  client.get<FollowUser[]>(`/api/users/${uid}/following`).then((r) => r.data);

export interface ActivityItem {
  type: 'thread' | 'vote';
  id: string;
  user_id: number;
  username: string;
  action: string; // 'posted' | 'bullish' | 'bearish'
  ticker: string | null;
  thread_id: number;
  thread_title: string;
  score?: number;
  created_at: string;
}

export const getActivityFeed = () =>
  client.get<ActivityItem[]>('/api/users/activity-feed').then((r) => r.data);
