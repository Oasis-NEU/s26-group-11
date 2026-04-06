import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, MessageSquare, ChevronUp, Globe } from 'lucide-react';
import { getPublicProfile, getFollowStatus, getFollowers, getFollowing, followUser, unfollowUser, type MiniThread, type PublicWatchlist } from '../api/users';
import { staggerContainer, staggerItem } from '../components/PageEnter';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../store/useAuth';
import { getMe } from '../api/auth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  return `${Math.floor(diff / 60_000)}m ago`;
}

function MiniThreadCard({ thread }: { thread: MiniThread }) {
  return (
    <motion.div variants={staggerItem}>
      {/* Outer div (not anchor) avoids invalid nested <a> when ticker chip Link is present */}
      <div
        className="flex items-start gap-3 border-b py-3 group"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5 w-8">
          <ChevronUp className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <span className="text-[10px] font-black tabular-nums" style={{ color: 'var(--text-primary)', ...MONO }}>
            {thread.upvotes}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {thread.ticker && (
              <Link
                to={`/app/stock/${thread.ticker}`}
                className="text-[9px] font-black px-1.5 py-px border transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}
              >
                {thread.ticker}
              </Link>
            )}
            <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
              {timeAgo(thread.created_at)}
            </span>
          </div>
          <Link to={`/app/discuss/${thread.id}`} className="block">
            <p className="text-sm font-semibold group-hover:underline underline-offset-2 leading-snug"
               style={{ color: 'var(--text-primary)' }}>
              {thread.title}
            </p>
          </Link>
          <div className="flex items-center gap-1 mt-1">
            <MessageSquare className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
              {thread.comment_count} {thread.comment_count === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function WatchlistPreviewCard({ wl }: { wl: PublicWatchlist }) {
  return (
    <motion.div
      variants={staggerItem}
      className="border p-4 space-y-3"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black" style={{ color: 'var(--text-primary)', ...MONO }}>
          {wl.name}
        </span>
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3" style={{ color: 'var(--accent)' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {wl.items.length} stocks
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {wl.items.slice(0, 8).map(ticker => (
          <Link
            key={ticker}
            to={`/app/stock/${ticker}`}
            className="text-[9px] font-black px-1.5 py-0.5 border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
          >
            {ticker}
          </Link>
        ))}
        {wl.items.length > 8 && (
          <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            +{wl.items.length - 8} more
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const qc = useQueryClient();
  const { isLoggedIn } = useAuth();
  const loggedIn = isLoggedIn();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['user-profile', username],
    queryFn: () => getPublicProfile(username!),
    enabled: !!username,
    retry: false,
  });

  // Get current user's numeric ID via /api/auth/me
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: loggedIn,
  });

  const currentUserId = me?.id ?? null;
  const profileUserId = profile?.id ?? null;

  const { data: followStatusData } = useQuery({
    queryKey: ['follow-status', profileUserId],
    queryFn: () => getFollowStatus(profileUserId!),
    enabled: !!profileUserId && !!currentUserId && profileUserId !== currentUserId,
  });
  const isFollowing = followStatusData?.following ?? false;

  const { data: followers } = useQuery({
    queryKey: ['followers', profileUserId],
    queryFn: () => getFollowers(profileUserId!),
    enabled: !!profileUserId,
  });

  const { data: following } = useQuery({
    queryKey: ['following', profileUserId],
    queryFn: () => getFollowing(profileUserId!),
    enabled: !!profileUserId,
  });

  const followMutation = useMutation({
    mutationFn: () => isFollowing ? unfollowUser(profileUserId!) : followUser(profileUserId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow-status', profileUserId] });
      qc.invalidateQueries({ queryKey: ['followers', profileUserId] });
    },
  });

  const displayName = profile?.display_name ?? profile?.username ?? username;
  const memberSince = profile
    ? new Date(profile.member_since).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="max-w-2xl mx-auto space-y-8 py-4"
    >
      <motion.div variants={staggerItem}>
        <Link
          to="/app/discuss"
          className="group inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={1.5} />
          Discussion
        </Link>
      </motion.div>

      {isLoading && (
        <div className="animate-pulse">
          {/* Avatar + name area */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full" style={{ background: 'var(--border)' }} />
            <div className="space-y-2">
              <div className="h-5 w-32 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-48 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-24 rounded" style={{ background: 'var(--border)' }} />
            </div>
          </div>
          {/* Thread skeletons */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-t py-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
              <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-1/3 rounded" style={{ background: 'var(--border)' }} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <motion.div variants={staggerItem} className="py-20 text-center space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            User not found
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            @{username} doesn't exist or has no public profile.
          </p>
        </motion.div>
      )}

      {profile && (
        <>
          {/* Avatar + identity */}
          <motion.div variants={staggerItem} className="flex items-start gap-5">
            <Avatar
              name={displayName ?? profile.username ?? '?'}
              avatarUrl={profile.avatar_url}
              size={64}
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="text-xl font-black" style={{ color: 'var(--text-primary)', ...MONO }}>
                  {displayName}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)', ...MONO }}>
                  @{profile.username}
                </p>
                {currentUserId && currentUserId !== profileUserId && (
                  <button
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                    className="px-3 py-1.5 text-[11px] border transition-all disabled:opacity-40"
                    style={{
                      borderColor:     isFollowing ? 'var(--border)' : 'var(--accent)',
                      color:           isFollowing ? 'var(--text-muted)' : 'var(--accent)',
                      backgroundColor: isFollowing ? 'transparent' : 'var(--accent-dim)',
                    }}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
              <div className="mt-1">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                  {followers?.length ?? 0} followers · {following?.length ?? 0} following
                </span>
              </div>
              {profile.bio && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {profile.bio}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                    Joined {memberSince}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                    {profile.thread_count} {profile.thread_count === 1 ? 'thread' : 'threads'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Public watchlists */}
          {profile.public_watchlists.length > 0 && (
            <motion.div variants={staggerItem} className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                <Globe className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)', ...MONO }}>
                  Public Watchlists
                </h2>
              </div>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {profile.public_watchlists.map(wl => (
                  <WatchlistPreviewCard key={wl.id} wl={wl} />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Threads */}
          <motion.div variants={staggerItem} className="space-y-0">
            <div className="flex items-center justify-between border-b pb-2 mb-1"
                 style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)', ...MONO }}>
                Threads
              </h2>
              <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                {profile.thread_count} total
              </span>
            </div>

            {!isLoading && profile.threads.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No threads yet.
              </p>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" animate="show">
                {profile.threads.map(t => (
                  <MiniThreadCard key={t.id} thread={t} />
                ))}
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
