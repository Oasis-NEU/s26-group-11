import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquare, Trash2, Pencil, X, Check } from 'lucide-react';
import {
  getThread, addComment, voteThread, voteComment, deleteComment, updateThread,
  type ThreadDetail as TThreadDetail, type Comment,
} from '../api/discuss';
import { useAuth } from '../store/useAuth';
import { Avatar } from '../components/Avatar';
import { VoteButtons } from './Discuss';
import { useToast } from '../store/useToast';
import { renderWithTickerLinks } from '../utils/tickerLinks';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
const cardStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' };

const EDIT_WINDOW_MS = 600_000; // 10 minutes

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

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Comment Row ───────────────────────────────────────────────────────────────

function CommentRow({ comment, currentUsername, currentEmail, isAdmin, isLoggedIn }: {
  comment: Comment;
  currentUsername: string | null;
  currentEmail: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
}) {
  const qc = useQueryClient();
  const { id: threadId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { mutate: castVote } = useMutation({
    mutationFn: (direction: 'up' | 'down') => voteComment(comment.id, direction),
    onSuccess: (data) => {
      qc.setQueryData(['thread', Number(threadId)], (old: TThreadDetail | undefined) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments.map((c) =>
            c.id === comment.id
              ? { ...c, score: data.score, user_vote: data.user_vote }
              : c
          ),
        };
      });
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: () => deleteComment(comment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thread', Number(threadId)] });
      toast('Comment deleted', 'success');
    },
    onError: () => toast('Failed to delete comment', 'error'),
  });

  // Match by username first; fall back to email-prefix for users without a username
  const isOwn = currentUsername
    ? comment.username === currentUsername
    : currentEmail
      ? comment.author === currentEmail.split('@')[0]
      : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 py-4 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        <Avatar
          name={comment.username ?? comment.author}
          avatarUrl={comment.avatar_url}
          linkTo={comment.username ? `/app/users/${comment.username}` : undefined}
          size={28}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {comment.username ? (
            <Link
              to={`/app/users/${comment.username}`}
              className="text-[10px] font-bold hover:underline hover:text-[var(--accent)] transition-colors"
              style={{ color: 'var(--text-secondary)', ...MONO }}
            >
              @{comment.username}
            </Link>
          ) : (
            <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)', ...MONO }}>
              {comment.author}
            </span>
          )}
          <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {timeAgo(comment.created_at)}
          </span>
          {/* Vote buttons inline */}
          <div className="ml-auto flex items-center gap-2">
            <VoteButtons
              score={comment.score}
              userVote={comment.user_vote}
              onVote={(dir) => castVote(dir)}
              disabled={!isLoggedIn}
            />
            {(isOwn || isAdmin) && (
              <button
                onClick={() => remove()}
                className="p-1 transition-colors hover:text-[var(--red)]"
                style={{ color: isAdmin && !isOwn ? 'var(--red)' : 'var(--text-muted)' }}
                title={isAdmin && !isOwn ? 'Admin delete' : 'Delete comment'}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
          {renderWithTickerLinks(comment.body)}
        </p>
      </div>
    </motion.div>
  );
}

// ── Reply Box ─────────────────────────────────────────────────────────────────

function ReplyBox({ threadId }: { threadId: number }) {
  const [body, setBody] = useState('');
  const qc = useQueryClient();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();

  const { mutate, isPending } = useMutation({
    mutationFn: () => addComment(threadId, body.trim()),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['thread', threadId] });
      toast('Reply posted!', 'success');
    },
    onError: () => toast('Failed to post reply', 'error'),
  });

  if (!isLoggedIn()) {
    return (
      <div className="border p-4 text-center space-y-2" style={cardStyle}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sign in to join the discussion
        </p>
        <Link
          to="/auth"
          className="inline-block px-4 py-1.5 text-xs font-black uppercase tracking-widest"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
        Your Reply
      </label>
      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your thoughts…"
        className="w-full border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none rounded-none"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
      />
      <div className="flex justify-end">
        <button
          onClick={() => mutate()}
          disabled={isPending || !body.trim()}
          className="px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
        >
          {isPending ? 'Posting…' : 'Post Reply'}
        </button>
      </div>
    </div>
  );
}

// ── Thread Detail Page ────────────────────────────────────────────────────────

export function ThreadDetail() {
  const { id } = useParams<{ id: string }>();
  const threadId = Number(id);
  const qc = useQueryClient();
  const { email, username: currentUsername, is_admin: isAdmin, isLoggedIn } = useAuth();
  const { toast } = useToast();

  const { data: thread, isLoading, isError } = useQuery({
    queryKey: ['thread', threadId],
    queryFn:  () => getThread(threadId),
    enabled:  !!threadId,
  });

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editing, setEditing]         = useState(false);
  const [editTitle, setEditTitle]     = useState('');
  const [editBody, setEditBody]       = useState('');
  const [editError, setEditError]     = useState('');
  const [msLeft, setMsLeft]           = useState(0);
  const countdownRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync edit fields when thread loads
  useEffect(() => {
    if (thread) {
      setEditTitle(thread.title);
      setEditBody(thread.body ?? '');
    }
  }, [thread?.id]);

  // Countdown timer — runs whenever thread is loaded
  useEffect(() => {
    if (!thread) return;
    const update = () => {
      const elapsed = Date.now() - new Date(thread.created_at).getTime();
      setMsLeft(Math.max(0, EDIT_WINDOW_MS - elapsed));
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [thread?.created_at]);

  const canEdit = !!thread &&
    currentUsername !== null &&
    currentUsername === thread.username &&
    msLeft > 0;

  const { mutate: castVote } = useMutation({
    mutationFn: (direction: 'up' | 'down') => voteThread(threadId, direction),
    onSuccess: (data) => {
      qc.setQueryData(['thread', threadId], (old: TThreadDetail | undefined) =>
        old ? { ...old, score: data.score, user_vote: data.user_vote } : old
      );
    },
  });

  const { mutate: saveEdit, isPending: savingEdit } = useMutation({
    mutationFn: () => updateThread(threadId, {
      title: editTitle.trim(),
      body: editBody.trim() || undefined,
    }),
    onSuccess: (updated) => {
      qc.setQueryData(['thread', threadId], (old: TThreadDetail | undefined) =>
        old ? { ...old, ...updated, comments: old.comments } : old
      );
      setEditing(false);
      setEditError('');
      toast('Thread updated!', 'success');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to save edit.';
      setEditError(msg);
      toast(msg, 'error');
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-3xl"
    >
      <Link
        to="/app/discuss"
        className="group inline-flex items-center gap-2 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={1.5} />
        Discussion
      </Link>

      {isLoading && (
        <>
          {/* Skeleton for thread header */}
          <div className="animate-pulse space-y-3 mb-8">
            <div className="h-3 w-24 rounded" style={{ background: 'var(--border)' }} />
            <div className="h-6 w-3/4 rounded" style={{ background: 'var(--border)' }} />
            <div className="h-4 w-full rounded" style={{ background: 'var(--border)' }} />
            <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border)' }} />
            <div className="flex gap-4 mt-4">
              <div className="h-3 w-16 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-16 rounded" style={{ background: 'var(--border)' }} />
            </div>
          </div>
          {/* Skeleton for comments */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse border-t py-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
              <div className="h-3 w-20 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-4 w-full rounded" style={{ background: 'var(--border)' }} />
              <div className="h-4 w-3/4 rounded" style={{ background: 'var(--border)' }} />
            </div>
          ))}
        </>
      )}

      {isError && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Thread not found.
        </p>
      )}

      {thread && (
        <>
          {/* Thread header */}
          <div className="border-b pb-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-3">
              {/* Author avatar */}
              <div className="shrink-0 pt-0.5">
                <Avatar
                  name={thread.username ?? thread.author}
                  avatarUrl={thread.avatar_url}
                  linkTo={thread.username ? `/app/users/${thread.username}` : undefined}
                  size={36}
                />
              </div>

              <div className="flex-1 min-w-0">
                {/* Meta row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {thread.ticker && (
                    <Link
                      to={`/app/stock/${thread.ticker}`}
                      className="text-[10px] font-black px-2 py-px border transition-colors hover:bg-[var(--bg-elevated)]"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}
                    >
                      {thread.ticker}
                    </Link>
                  )}
                  {thread.username ? (
                    <Link
                      to={`/app/users/${thread.username}`}
                      className="text-[10px] font-bold hover:underline hover:text-[var(--accent)] transition-colors"
                      style={{ color: 'var(--text-secondary)', ...MONO }}
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

                  {/* Vote buttons */}
                  <div className="ml-auto flex items-center gap-2">
                    <VoteButtons
                      score={thread.score}
                      userVote={thread.user_vote}
                      onVote={(dir) => castVote(dir)}
                      disabled={!isLoggedIn()}
                    />

                    {/* Edit button — only visible to author within window */}
                    {canEdit && !editing && (
                      <button
                        onClick={() => { setEditing(true); setEditError(''); }}
                        className="flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold uppercase tracking-widest transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
                        title={`Edit window: ${formatCountdown(msLeft)}`}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Edit · {formatCountdown(msLeft)}
                      </button>
                    )}
                  </div>
                </div>

                {/* Title / body — or edit form */}
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <input
                        className="w-full rounded-none border px-3 py-2 text-sm font-bold outline-none focus:border-[var(--accent)] transition-colors"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        maxLength={300}
                      />
                      <p className="text-[9px] mt-0.5 text-right" style={{ color: 'var(--text-muted)', ...MONO }}>
                        {editTitle.length}/300
                      </p>
                    </div>
                    <textarea
                      rows={5}
                      className="w-full rounded-none border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="Body (optional)"
                    />
                    {editError && (
                      <p className="text-xs" style={{ color: 'var(--red)', ...MONO }}>{editError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveEdit()}
                        disabled={savingEdit || !editTitle.trim()}
                        className="flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
                      >
                        <Check className="h-3 w-3" />
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditTitle(thread.title);
                          setEditBody(thread.body ?? '');
                          setEditError('');
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors hover:bg-[var(--bg-elevated)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                      <span className="text-[9px] ml-auto" style={{ color: 'var(--text-muted)', ...MONO }}>
                        Window closes in {formatCountdown(msLeft)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {thread.title}
                    </h1>
                    {thread.body && (
                      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {renderWithTickerLinks(thread.body)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pl-11">
              <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                {thread.comments.length} {thread.comments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>
          </div>

          {/* Reply box */}
          <ReplyBox threadId={thread.id} />

          {/* Comments */}
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse border-t py-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="h-3 w-20 rounded" style={{ background: 'var(--border)' }} />
                <div className="h-4 w-full rounded" style={{ background: 'var(--border)' }} />
                <div className="h-4 w-3/4 rounded" style={{ background: 'var(--border)' }} />
              </div>
            ))
          ) : thread.comments.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No replies yet — be the first.
            </p>
          ) : (
            <div>
              {thread.comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  currentUsername={currentUsername}
                  currentEmail={email}
                  isAdmin={isAdmin}
                  isLoggedIn={isLoggedIn()}
                />
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
