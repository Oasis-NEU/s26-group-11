import { Link } from 'react-router-dom';

/**
 * Parses a plain-text string and wraps any $TICKER patterns
 * (1–5 uppercase letters after a "$") in a Link to /app/stock/TICKER.
 *
 * Usage:
 *   <p>{renderWithTickerLinks(body)}</p>
 */
export function renderWithTickerLinks(text: string): React.ReactNode {
  if (!text) return text;

  // Split on $TICKER tokens (1–5 upper-case letters)
  const parts = text.split(/(\$[A-Z]{1,5}(?![A-Z]))/g);

  return parts.map((part, i) => {
    if (/^\$[A-Z]{1,5}$/.test(part)) {
      const symbol = part.slice(1); // strip the "$"
      return (
        <Link
          key={i}
          to={`/app/stock/${symbol}`}
          className="font-bold hover:underline underline-offset-2 transition-colors"
          style={{ color: 'var(--accent)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}
