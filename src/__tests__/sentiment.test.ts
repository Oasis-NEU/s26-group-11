/**
 * Tests for the sentiment helper functions used throughout the UI.
 *
 * sentimentLabel() and sentimentColor() mirror the backend label() logic —
 * if either drifts, prices/badges would show the wrong tier.
 */

import { describe, it, expect } from 'vitest';

// ── Helpers (copied from StockDetail.tsx — extract to utils if they grow) ──

function sentimentLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 0.35)  return 'Strongly Bullish';
  if (score >= 0.05)  return 'Bullish';
  if (score <= -0.35) return 'Strongly Bearish';
  if (score <= -0.05) return 'Bearish';
  return 'Neutral';
}

function sentimentColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 0.35)  return '#16a34a';   // dark green
  if (score >= 0.05)  return '#22c55e';   // green
  if (score <= -0.35) return '#b91c1c';   // dark red
  if (score <= -0.05) return '#ef4444';   // red
  return '#d97706';                        // amber / neutral
}

// ── sentimentLabel ────────────────────────────────────────────────────────────

describe('sentimentLabel', () => {
  it('returns em-dash for null', () => {
    expect(sentimentLabel(null)).toBe('—');
  });

  it('labels strongly bullish at and above 0.35', () => {
    expect(sentimentLabel(0.35)).toBe('Strongly Bullish');
    expect(sentimentLabel(0.90)).toBe('Strongly Bullish');
  });

  it('labels bullish between 0.05 and 0.34', () => {
    expect(sentimentLabel(0.05)).toBe('Bullish');
    expect(sentimentLabel(0.20)).toBe('Bullish');
    expect(sentimentLabel(0.34)).toBe('Bullish');
  });

  it('labels neutral near zero', () => {
    expect(sentimentLabel(0.0)).toBe('Neutral');
    expect(sentimentLabel(0.04)).toBe('Neutral');
    expect(sentimentLabel(-0.04)).toBe('Neutral');
  });

  it('labels bearish between -0.05 and -0.34', () => {
    expect(sentimentLabel(-0.05)).toBe('Bearish');
    expect(sentimentLabel(-0.20)).toBe('Bearish');
  });

  it('labels strongly bearish at and below -0.35', () => {
    expect(sentimentLabel(-0.35)).toBe('Strongly Bearish');
    expect(sentimentLabel(-1.0)).toBe('Strongly Bearish');
  });
});

// ── sentimentColor ────────────────────────────────────────────────────────────

describe('sentimentColor', () => {
  it('returns muted CSS var for null', () => {
    expect(sentimentColor(null)).toBe('var(--text-muted)');
  });

  it('returns dark green for strongly positive', () => {
    expect(sentimentColor(0.5)).toBe('#16a34a');
  });

  it('returns green for positive', () => {
    expect(sentimentColor(0.1)).toBe('#22c55e');
  });

  it('returns amber for neutral', () => {
    expect(sentimentColor(0.0)).toBe('#d97706');
    expect(sentimentColor(-0.02)).toBe('#d97706');
  });

  it('returns red for negative', () => {
    expect(sentimentColor(-0.1)).toBe('#ef4444');
  });

  it('returns dark red for strongly negative', () => {
    expect(sentimentColor(-0.5)).toBe('#b91c1c');
  });

  it('label and color tiers agree — same boundary, same tier', () => {
    // Spot-check: 0.35 is "Strongly Bullish" (green) not "Bullish" (lighter green)
    expect(sentimentLabel(0.35)).toBe('Strongly Bullish');
    expect(sentimentColor(0.35)).toBe('#16a34a');
  });
});
