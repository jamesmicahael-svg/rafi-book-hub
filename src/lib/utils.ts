export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionType = (typeof REACTIONS)[number];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

export function validateUsername(u: string): string | null {
  if (!/^[a-z0-9_]{3,24}$/.test(u)) return 'Username must be 3-24 chars (a-z, 0-9, _)';
  return null;
}

export function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Password must be at least 8 characters';
  return null;
}
