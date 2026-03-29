import client from './client';

export interface TrendingStock {
  symbol: string;
  name: string | null;
  tier: number;
  mention_count: number;
  sentiment_score: number;
  price: number | null;
  change_pct: number | null;
}

export interface ShifterStock {
  symbol: string;
  name: string | null;
  sentiment_score: number;
  sentiment_delta_24h: number;
  price: number | null;
  change_pct: number | null;
}

export interface SearchResult {
  symbol: string;
  name: string | null;
}

export interface SentimentHistory {
  timestamp: string;
  overall: number | null;
  reddit: number | null;
  twitter: number | null;
  news: number | null;
}

export interface StockDetail {
  symbol: string;
  name: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  volume: number | null;
  exchange: string | null;
  sentiment: {
    overall: number | null;
    reddit: number | null;
    twitter: number | null;
    news: number | null;
    reddit_count: number;
    twitter_count: number;
    news_count: number;
  };
  history: SentimentHistory[];
}

export interface Mention {
  id: number;
  source: 'reddit' | 'twitter' | 'news';
  text: string;
  url: string | null;
  author: string | null;
  author_verified: boolean;
  upvotes: number;
  credibility_score: number;
  sentiment_score: number | null;
  sentiment_label: string | null;
  news_source: string | null;
  subreddit: string | null;
  published_at: string;
}

export const getTrending = () =>
  client.get<TrendingStock[]>('/api/stocks/trending').then((r) => r.data);

export const getShifters = () =>
  client.get<ShifterStock[]>('/api/stocks/shifters').then((r) => r.data);

export const searchStocks = (q: string) =>
  client.get<SearchResult[]>('/api/stocks/search', { params: { q } }).then((r) => r.data);

export const getStockDetail = (symbol: string) =>
  client.get<StockDetail>(`/api/stocks/${symbol}`).then((r) => r.data);

export const getStockMentions = (symbol: string, source?: string) =>
  client
    .get<Mention[]>(`/api/stocks/${symbol}/mentions`, { params: source ? { source } : {} })
    .then((r) => r.data);

export interface ChartPoint {
  time: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export const getStockChart = (symbol: string, period: string) =>
  client.get<ChartPoint[]>(`/api/stocks/${symbol}/chart`, { params: { period } }).then((r) => r.data);
