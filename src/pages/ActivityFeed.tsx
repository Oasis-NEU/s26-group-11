import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '../store/useAuth';
import { getActivityFeed, ActivityItem } from '../api/users';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#22c55e', '#3b82f6', '#a855f7', '#f97316',
    '#f43f5e', '#06b6d4', '#eab308', '#ec4899',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function UserAvatar({ username }: { username: string }) {
  const color = hashColor(username);
  const initial = username.charAt(0).toUpperCase();
  return (
    <div
      className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44`, ...MONO }}
    >
      {initial}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-4 border-b animate-pulse" style={{ borderColor: 'var(--border)' }}>
      <div className="shrink-0 h-8 w-8 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded w-48" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-3 rounded w-72" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      </div>
      <div className="h-3 rounded w-12" style={{ backgroundColor: 'var(--bg-elevated)' }} />
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const isBullish = item.action === 'bullish';
  const isBearish = item.action === 'bearish';

  const actionColor = isBullish
    ? 'var(--accent)'
    : isBearish
    ? 'var(--red)'
    : 'var(--text-secondary)';

  const actionLabel = item.type === 'thread'
    ? (item.ticker ? `posted in $${item.ticker}` : 'posted a thread')
    : item.ticker
    ? `voted ${item.action} on $${item.ticker}`
    : `voted ${item.action}`;

  return (
    <motion.div
      variants={staggerItem}
      className="flex items-start gap-3 py-4 border-b group"
      style={{ borderColor: 'var(--border)' }}
    >
      <Link to={`/app/users/${item.username}`} className="shrink-0">
        <UserAvatar username={item.username} />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <Link
            to={`/app/users/${item.username}`}
            className="text-[11px] font-black uppercase tracking-widest hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-primary)', ...MONO }}
          >
            @{item.username}
          </Link>
          <span
            className="text-[11px] font-bold"
            style={{ color: actionColor, ...MONO }}
          >
            {actionLabel}
          </span>
        </div>

        <Link
          to={`/app/discuss/${item.thread_id}`}
          className="block mt-1 text-xs leading-snug hover:text-[var(--accent)] transition-colors truncate"
          style={{ color: 'var(--text-secondary)' }}
          title={item.thread_title}
        >
          {item.thread_title.length > 80
            ? item.thread_title.slice(0, 80) + '…'
            : item.thread_title}
        </Link>
      </div>

      <span
        className="shrink-0 text-[10px] uppercase tracking-widest"
        style={{ color: 'var(--text-muted)', ...MONO }}
      >
        {relativeTime(item.created_at)}
      </span>
    </motion.div>
  );
}

export function ActivityFeed() {
  const { isLoggedIn } = useAuth();
  const loggedIn = isLoggedIn();

  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: getActivityFeed,
    enabled: loggedIn,
    staleTime: 60_000,
  });

  if (!loggedIn) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p
          className="text-[11px] uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', ...MONO }}
        >
          Sign in to see activity from people you follow.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-2xl mx-auto py-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="border-b-2 pb-3 mb-6"
        style={{ borderColor: 'var(--text-primary)' }}
      >
        <h1
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: 'var(--text-primary)', ...MONO }}
        >
          Activity
        </h1>
        <p
          className="text-[10px] mt-0.5 uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', ...MONO }}
        >
          From people you follow
        </p>
      </motion.div>

      {/* Loading skeletons */}
      {isLoading && (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Empty: not following anyone */}
      {!isLoading && data && data.length === 0 && (
        <motion.div variants={staggerItem} className="py-16 text-center">
          <p
            className="text-[11px] uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', ...MONO }}
          >
            No recent activity from people you follow.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Find people to follow on their profiles.
          </p>
        </motion.div>
      )}

      {/* Feed */}
      {!isLoading && data && data.length > 0 && (
        <div>
          {data.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
