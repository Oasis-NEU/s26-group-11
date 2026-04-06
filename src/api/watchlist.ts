import client from './client';

export interface WatchlistItem {
  ticker:   string;
  added_at: string;
}

export interface WatchlistList {
  id:         number;
  name:       string;
  is_public:  boolean;
  created_at: string;
  items:      WatchlistItem[];
}

// ── Legacy flat watchlist (used by StockDetail "Watch" button) ────────────────
export const getWatchlist = () =>
  client.get<WatchlistItem[]>('/api/watchlist').then((r) => r.data);

export const addToWatchlist = (ticker: string) =>
  client.post<WatchlistItem>('/api/watchlist', { ticker }).then((r) => r.data);

export const removeFromWatchlist = (ticker: string) =>
  client.delete(`/api/watchlist/${ticker}`);

// ── Named watchlists ──────────────────────────────────────────────────────────
export const getWatchlistLists = () =>
  client.get<WatchlistList[]>('/api/watchlist/lists').then((r) => r.data);

export const createWatchlistList = (name: string, is_public = false) =>
  client.post<WatchlistList>('/api/watchlist/lists', { name, is_public }).then((r) => r.data);

export const updateWatchlistList = (id: number, patch: { name?: string; is_public?: boolean }) =>
  client.put<WatchlistList>(`/api/watchlist/lists/${id}`, patch).then((r) => r.data);

export const deleteWatchlistList = (id: number) =>
  client.delete(`/api/watchlist/lists/${id}`);

export const addToList = (listId: number, ticker: string) =>
  client.post<WatchlistItem>(`/api/watchlist/lists/${listId}/items`, { ticker }).then((r) => r.data);

export const removeFromList = (listId: number, ticker: string) =>
  client.delete(`/api/watchlist/lists/${listId}/items/${ticker}`);
