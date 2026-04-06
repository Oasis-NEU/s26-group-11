import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, TrendingUp, TrendingDown, Plus, X } from 'lucide-react';
import {
  getThreads, createThread, voteThread, deleteThread,
  type Thread,
} from '../api/discuss';
import { useAuth } from '../store/useAuth';
import { staggerContainer, staggerItem } from '../components/PageEnter';
import { Avatar } from '../components/Avatar';
import { useToast } from '../store/useToast';
import { renderWithTickerLinks } from '../utils/tickerLinks';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
const cardStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

// ── Finance Signal Vote Buttons ───────────────────────────────────────────────

export function VoteButtons({
  score,
  userVote,
  onVote,
  disabled = false,
}: {
  score: number;
  userVote: 1 | -1 | 0;
  onVote: (dir: 'up' | 'down') => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-px">
      <button
        onClick={() => onVote('up')}
        disabled={disabled}
        title="Bullish"
        className="flex items-center gap-0.5 px-1.5 py-0.5 border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          borderColor:     userVote === 1 ? 'var(--accent)' : 'var(--border)',
          backgroundColor: userVote === 1 ? 'var(--accent-dim)' : 'transparent',
          color:           userVote === 1 ? 'var(--accent)' : 'var(--text-muted)',
        }}
      >
        <TrendingUp className="h-3 w-3" />
      </button>
      <span
        className="text-[10px] font-black tabular-nums px-1.5 select-none"
        style={{
          color: score > 0 ? 'var(--accent)' : score < 0 ? 'var(--red)' : 'var(--text-primary)',
          ...MONO,
        }}
      >
        {score > 0 ? `+${score}` : score}
      </span>
      <button
        onClick={() => onVote('down')}
        disabled={disabled}
        title="Bearish"
        className="flex items-center gap-0.5 px-1.5 py-0.5 border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          borderColor:     userVote === -1 ? 'var(--red)' : 'var(--border)',
          backgroundColor: userVote === -1 ? 'rgba(239,68,68,0.08)' : 'transparent',
          color:           userVote === -1 ? 'var(--red)' : 'var(--text-muted)',
        }}
      >
        <TrendingDown className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── New Thread Form ───────────────────────────────────────────────────────────

function NewThreadForm({ defaultTicker, onClose }: { defaultTicker?: string; onClose: () => void }) {
  const [title, setTitle]   = useState('');
  const [body, setBody]     = useState('');
  const [ticker, setTicker] = useState(defaultTicker ?? '');
  const qc = useQueryClient();

  const { toast } = useToast();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createThread({
      title: title.trim(),
      body: body.trim() || undefined,
      ticker: ticker.trim().toUpperCase() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] });
      toast('Thread posted!', 'success');
      onClose();
    },
    onError: () => toast('Failed to post thread', 'error'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="border rounded-none p-5 space-y-4"
      style={cardStyle}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', ...MONO }}>
          New Thread
        </h3>
        <button onClick={onClose}>
          <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', ...MONO }}>
            Title *
          </label>
          <input
            className="w-full rounded-none border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            placeholder="What's on your mind?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
          />
          <p className="text-[9px] mt-0.5 text-right" style={{ color: 'var(--text-muted)', ...MONO }}>
            {title.length}/300
          </p>
        </div>

        {/* Ticker tag */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', ...MONO }}>
            Stock Tag (optional)
          </label>
          <input
            className="w-full rounded-none border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors uppercase"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', ...MONO }}
            placeholder="AAPL, TSLA, NVDA…"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', ...MONO }}>
            Body (optional)
          </label>
          <textarea
            rows={4}
            className="w-full rounded-none border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            placeholder="Add more context, charts, thoughts…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--red)', ...MONO }}>
          {(error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest border transition-colors hover:bg-[var(--bg-elevated)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
        >
          Cancel
        </button>
        <motion.button
          onClick={() => mutate()}
          disabled={isPending || !title.trim()}
          whileTap={{ scale: 0.97 }}
          className="px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
        >
          {isPending ? 'Posting…' : 'Post Thread'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Thread Card ───────────────────────────────────────────────────────────────

function ThreadCard({ thread, currentUsername, isLoggedIn }: {
  thread: Thread;
  currentUsername: string | null;
  isLoggedIn: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { mutate: castVote } = useMutation({
    mutationFn: (direction: 'up' | 'down') => voteThread(thread.id, direction),
    onSuccess: (data, direction) => {
      // Optimistically update the cached thread list
      qc.setQueryData(
        ['threads', thread.ticker ?? undefined, undefined],
        (old: Thread[] | undefined) =>
          old?.map((t) =>
            t.id === thread.id ? { ...t, score: data.score, user_vote: data.user_vote } : t
          )
      );
      // Invalidate all thread-list variants (different sort/ticker combos)
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: () => deleteThread(thread.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] });
      toast('Thread deleted', 'success');
    },
    onError: () => toast('Failed to delete thread', 'error'),
  });

  return (
    <motion.div
      layout
      variants={staggerItem}
      whileHover={{ x: 3, transition: { duration: 0.12 } }}
      className="border-b py-3 sm:py-4 flex gap-3 sm:gap-4"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Avatar column */}
      <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0">
        <Avatar
          name={thread.username ?? thread.author}
          avatarUrl={thread.avatar_url}
          linkTo={thread.username ? `/app/users/${thread.username}` : undefined}
          size={28}
        />
        <VoteButtons
          score={thread.score}
          userVote={thread.user_vote}
          onVote={(dir) => castVote(dir)}
          disabled={!isLoggedIn}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {thread.ticker && (
            <Link
              to={`/app/stock/${thread.ticker}`}
              className="text-[10px] font-black px-1.5 py-px border transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}
            >
              {thread.ticker}
            </Link>
          )}
          {thread.username ? (
            <Link
              to={`/app/users/${thread.username}`}
              className="text-[10px] font-bold hover:underline underline-offset-2 transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', ...MONO }}
              onClick={e => e.stopPropagation()}
            >
              @{thread.username}
            </Link>
          ) : (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
              {thread.author}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            · {timeAgo(thread.created_at)}
          </span>
          {thread.edited_at && (
            <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
              (edited)
            </span>
          )}
          {currentUsername && currentUsername === thread.username && (
            <button
              onClick={() => remove()}
              className="ml-auto text-[9px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--red)]"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              Delete
            </button>
          )}
        </div>

        <Link to={`/app/discuss/${thread.id}`} className="group block">
          <h3
            className="text-sm font-bold leading-snug group-hover:underline underline-offset-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {thread.title}
          </h3>
          {thread.body && (
            <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {renderWithTickerLinks(thread.body)}
            </p>
          )}
        </Link>

        <div className="flex items-center gap-1.5 mt-2">
          <MessageSquare className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {thread.comment_count} {thread.comment_count === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Discuss Page ──────────────────────────────────────────────────────────────

export function Discuss() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort]           = useState<'new' | 'top'>('new');
  const [showForm, setShowForm]   = useState(false);
  const { isLoggedIn, username: currentUsername } = useAuth();

  const tickerFilter = searchParams.get('ticker')?.toUpperCase() || undefined;

  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', tickerFilter, sort],
    queryFn:  () => getThreads(tickerFilter, sort),
    staleTime: 60_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Discussion
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {tickerFilter ? `Threads about ${tickerFilter}` : 'Market talk, analysis, ideas'}
          </p>
        </div>
        {isLoggedIn() && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Thread
          </button>
        )}
      </div>

      {/* New thread form */}
      <AnimatePresence>
        {showForm && (
          <NewThreadForm
            defaultTicker={tickerFilter}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Filters bar */}
      <div className="flex items-center gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
        {/* Sort */}
        <div className="flex gap-1">
          {(['new', 'top'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors border"
              style={{
                borderColor: sort === s ? 'var(--accent)' : 'var(--border)',
                color: sort === s ? 'var(--accent)' : 'var(--text-muted)',
                backgroundColor: sort === s ? 'var(--accent-dim)' : 'transparent',
                ...MONO,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Active ticker filter */}
        {tickerFilter && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-bold px-2 py-0.5 border"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}>
              {tickerFilter}
            </span>
            <button
              onClick={() => setSearchParams({})}
              className="text-[9px] uppercase tracking-widest hover:text-[var(--red)] transition-colors"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              clear ×
            </button>
          </div>
        )}
      </div>

      {/* Thread list */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-4 border-b animate-pulse" style={{ borderColor: 'var(--border)' }}>
              <div className="w-8 space-y-1">
                <div className="h-4 w-4 rounded mx-auto" style={{ backgroundColor: 'var(--bg-elevated)' }} />
                <div className="h-3 w-6 rounded mx-auto" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
                <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
                <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && threads?.length === 0 && (
        <div className="py-20 text-center space-y-3">
          <p className="text-4xl">💬</p>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            No threads yet
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {isLoggedIn()
              ? 'Be the first to start a discussion.'
              : 'Sign in to start the conversation.'}
          </p>
          {!isLoggedIn() && (
            <Link
              to="/auth"
              className="inline-block mt-2 px-4 py-1.5 text-xs font-black uppercase tracking-widest"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
            >
              Sign In
            </Link>
          )}
        </div>
      )}

      {threads && threads.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {threads.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              currentUsername={currentUsername}
              isLoggedIn={isLoggedIn()}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
