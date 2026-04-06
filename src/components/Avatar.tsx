/**
 * Shared avatar component. Shows profile picture if set, otherwise
 * a square with the user's initial letter.
 */
import { Link } from 'react-router-dom';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

interface AvatarProps {
  /** Display name or author string — used for the initial letter fallback */
  name: string;
  /** Base64 data-URL or external URL for the avatar image */
  avatarUrl?: string | null;
  /** If set, wraps the avatar in a Link to this path */
  linkTo?: string;
  /** Pixel size — applied as width and height */
  size?: number;
  className?: string;
}

export function Avatar({ name, avatarUrl, linkTo, size = 32, className = '' }: AvatarProps) {
  const initial = (name?.[0] ?? '?').toUpperCase();
  const fontSize = Math.max(8, Math.round(size * 0.38));

  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      className={`object-cover ${className}`}
      style={{ width: size, height: size, borderRadius: 0 }}
    />
  ) : (
    <div
      className={`flex items-center justify-center shrink-0 font-black select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'var(--accent)',
        color: 'var(--bg-page)',
        fontSize,
        ...MONO,
      }}
    >
      {initial}
    </div>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="shrink-0 transition-opacity hover:opacity-80"
        title={`@${name}`}
        onClick={e => e.stopPropagation()}
      >
        {inner}
      </Link>
    );
  }

  return <>{inner}</>;
}
