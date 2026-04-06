import client from './client';

export interface PriceAlert {
  id: number;
  ticker: string;
  target_price: number;
  direction: 'above' | 'below';
  triggered: boolean;
  created_at: string;
  triggered_at: string | null;
}

export const getAlerts = () =>
  client.get<PriceAlert[]>('/api/alerts').then((r) => r.data);

export const createAlert = (data: { ticker: string; target_price: number; direction: 'above' | 'below' }) =>
  client.post<PriceAlert>('/api/alerts', data).then((r) => r.data);

export const deleteAlert = (id: number) =>
  client.delete(`/api/alerts/${id}`).then((r) => r.data);
