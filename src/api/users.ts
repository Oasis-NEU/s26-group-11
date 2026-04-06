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
