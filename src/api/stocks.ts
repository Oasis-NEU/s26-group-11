import client from './client';

export interface TrendingStock {
  symbol: string;
  name: string | null;
  tier?: number;
  mention_count: number;
  sentiment_score: number | null;
  sentiment_count: number;
  sentiment_label: string | null;
  price: number | null;
  change_pct: number | null;
}

export interface ShifterStock {
  symbol: string;
  name: string | null;
  sentiment_score: number | null;
  sentiment_count: number;
  sentiment_label: string | null;
  sentiment_delta_24h: number;
  price: number | null;
  change_pct: number | null;
}

export interface SearchResult {
  symbol: string;
  name: string | null;
  type: string | null;
  exchange: string | null;
}

export interface SentimentHistory {
  timestamp: string;
  overall: number | null;
  reddit: number | null;
  twitter: number | null;
  news: number | null;
}

export interface Fundamentals {
  open: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  avg_volume: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  eps: number | null;
  beta: number | null;
  dividend_yield: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
}

export interface StockDetail {
  symbol: string;
  name: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  volume: number | null;
  exchange: string | null;
  mention_count: number;
  reddit_mentions_7d: number;
  fundamentals: Fundamentals;
  sentiment: {
    overall: number | null;
    reddit: number | null;
    twitter: number | null;
    news: number | null;
    sentiment_label: string | null;
    reddit_count: number;
    twitter_count: number;
    news_count: number;
  };
  history: SentimentHistory[];
}

export interface Mention {
  id: number;
  ticker: string | null;
  source: 'reddit' | 'twitter' | 'news';
  text: string;
  summary: string | null;
  url: string | null;
  author: string | null;
  author_verified: boolean;
  upvotes: number;
  credibility_score: number;
  sentiment_score: number | null;
  sentiment_label: string | null;
  news_source: string | null;
  subreddit: string | null;
  event_type: string | null;
  event_confidence: number | null;
  published_at: string;
}

export interface SentimentSnapshotPoint {
  date: string;
  score: number | null;
  mention_count: number;
  avg_credibility: number | null;
}

export interface SentimentPoint {
  date: string;   // YYYY-MM-DD
  score: number;  // -1 to 1
  count: number;
}

export const getTrending = () =>
  client.get<TrendingStock[]>('/api/stocks/trending').then((r) => r.data);

export const getShifters = () =>
  client.get<ShifterStock[]>('/api/stocks/shifters').then((r) => r.data);

export const searchStocks = (q: string) =>
  client.get<SearchResult[]>('/api/stocks/search', { params: { q } }).then((r) => r.data);

export const getStockDetail = (symbol: string) =>
  client.get<StockDetail>(`/api/stocks/${symbol}`).then((r) => r.data);

export type FeedSince = '1h' | '6h' | '24h' | '7d';

export const getFeed = (since: FeedSince = '7d') =>
  client.get<Mention[]>('/api/stocks/feed', { params: { since } }).then((r) => r.data);

export interface EarningsEntry {
  ticker: string;
  date:   string; // ISO date string YYYY-MM-DD
}

export const getEarnings = (tickers: string[] = []) =>
  client
    .get<EarningsEntry[]>('/api/stocks/earnings', {
      params: tickers.length ? { tickers: tickers.join(',') } : {},
    })
    .then((r) => r.data);

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

export const getSentimentHistory = (symbol: string, days = 7) =>
  client
    .get<SentimentSnapshotPoint[]>(`/api/stocks/${symbol}/sentiment-history`, { params: { days } })
    .then((r) => r.data);

export const getSentimentTrend = (ticker: string, days = 30) =>
  client.get<SentimentPoint[]>(`/api/stocks/${ticker}/sentiment-history`, { params: { days } })
    .then((r) => r.data);

export interface SentimentSummary {
  ticker: string;
  overall_score: number | null;
  label: string;
  summary: string;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  mention_count: number;
  scored_count: number;
  top_events: { type: string; count: number }[];
  key_headlines: string[];
  sources: { news: number; reddit: number; twitter: number };
}

export const getSentimentSummary = (symbol: string, days = 7) =>
  client
    .get<SentimentSummary>(`/api/stocks/${symbol}/sentiment-summary`, { params: { days } })
    .then((r) => r.data);

export interface RedditPulse {
  ticker: string;
  post_count: number;
  overall_score: number | null;
  label: string;
  summary: string;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  top_posts: {
    title: string;
    subreddit: string;
    url: string;
    upvotes: number;
    sentiment_score: number | null;
    sentiment_label: string | null;
  }[];
  subreddit_breakdown: Record<string, number>;
}

export const getRedditPulse = (symbol: string) =>
  client.get<RedditPulse>(`/api/stocks/${symbol}/reddit-pulse`).then((r) => r.data);

export interface CompareResult {
  ticker: string;
  mention_count: number;
  avg_sentiment: number;
  reddit_mentions: number;
}

export const compareStocks = (tickers: string[]) =>
  client.get<CompareResult[]>('/api/stocks/compare', { params: { tickers: tickers.join(',') } })
    .then((r) => r.data);
