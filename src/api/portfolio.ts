import client from './client';

export interface PortfolioItem {
  id: number;
  ticker: string;
  shares: number;
  avg_cost: number;
  added_at: string;
  // These are computed client-side from price data:
  current_price?: number;
  market_value?: number;
  gain_loss?: number;
  gain_loss_pct?: number;
}

export const getPortfolio = () =>
  client.get<PortfolioItem[]>('/api/portfolio').then((r) => r.data);

export const addPosition = (data: { ticker: string; shares: number; avg_cost: number }) =>
  client.post<PortfolioItem>('/api/portfolio', data).then((r) => r.data);

export const updatePosition = (id: number, data: { shares?: number; avg_cost?: number }) =>
  client.put<PortfolioItem>(`/api/portfolio/${id}`, data).then((r) => r.data);

export const removePosition = (id: number) =>
  client.delete(`/api/portfolio/${id}`).then((r) => r.data);
