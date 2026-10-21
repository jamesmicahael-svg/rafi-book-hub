import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { REACTIONS, REACTION_EMOJI, timeAgo, type ReactionType } from '../../lib/utils';
import type { Comment, Post } from '../../lib/types';
import { ReportModal } from './ReportModal';

export function PostCard({ post, onChanged }: { post: Post; onChanged?: () => void }) {
  const { profile } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [reactOpen, setReactOpen] = useState(false);
  const [myReaction, setMyReaction] = useState<string | null>(post.my_reaction ?? null);
  const [counts, setCounts] = useState({ reactions: post.reactions_count ?? 0, comments: post.comments_count ?? 0, shares: post.shares_count ?? 0 });
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!showComments) return;
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments]);

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, author:profiles(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) || []);
  }

  async function react(type: ReactionType | null) {
    setReactOpen(false);
    if (!profile) return;
    const prev = { r: myReaction, c: counts.reactions };
    if (myReaction === type) {
      setMyReaction(null);
      setCounts((c) => ({ ...c, reactions: c.reactions - 1 }));
      await supabase.from('reactions').delete().eq('post_id', post.id).eq('user_id', profile.id);
    } else if (type) {
      setMyReaction(type);
      setCounts((c) => ({ ...c, reactions: prev.r ? c.reactions : c.reactions + 1 }));
      const { error } = await supabase
        .from('reactions')
        .upsert({ post_id: post.id, user_id: profile.id, type }, { onConflict: 'post_id,user_id' });
      if (error) {
        setMyReaction(prev.r);
        setCounts((c) => ({ ...c, reactions: prev.c }));
      }
    }
    onChanged?.();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !profile) return;
    const body = commentText.trim();
    setCommentText('');
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, author_id: profile.id, body })
      .select('*, author:profiles(*)')
      .single();
    if (!error && data) {
      setComments((c) => [...c, data as Comment]);
      setCounts((c) => ({ ...c, comments: c.comments + 1 }));
    }
  }

  async function share() {
    if (!profile) return;
    const caption = prompt('Share this post with a caption (optional):') ?? '';
    const { error } = await supabase.from('shares').insert({ post_id: post.id, user_id: profile.id, caption });
    if (!error) {
      setCounts((c) => ({ ...c, shares: c.shares + 1 }));
      alert('Shared to your timeline!');
    }
  }

  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', post.id);
    onChanged?.();
  }

  const author = post.author;
  const myLabel = myReaction ? REACTION_EMOJI[myReaction as ReactionType] : null;

  return (
    <div className="card card-pad">
      <div className="row between">
        <div className="row">
          <Avatar url={author?.avatar_url} name={author?.display_name || '?'} size={44} onClick={() => (window.location.href = `/profile/${author?.username}`)} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{author?.display_name}</div>
            <div className="muted">@{author?.username} · {timeAgo(post.created_at)} · {post.visibility === 'public' ? '🌍' : post.visibility === 'friends' ? '👥' : '🔒'}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {profile?.id === post.author_id && (
            <button className="icon-btn" onClick={deletePost} title="Delete" aria-label="Delete post">🗑️</button>
          )}
          <button className="icon-btn" onClick={() => setReporting(true)} title="Report" aria-label="Report post">⚑</button>
        </div>
      </div>

      {post.body && <div className="post-body">{post.body}</div>}
      {post.media_url && post.media_type === 'image' && <img className="post-media" src={post.media_url} alt="" />}
      {post.media_url && post.media_type === 'video' && (
        <video className="post-media" src={post.media_url} controls />
      )}

      <div className="row between muted" style={{ padding: '4px 2px' }}>
        <span>{counts.reactions > 0 && `${REACTION_EMOJI[myReaction as ReactionType] || '👍'} ${counts.reactions}`}</span>
        <span>{counts.comments > 0 && `${counts.comments} comments`} {counts.shares > 0 && `· ${counts.shares} shares`}</span>
      </div>

      <div className="reaction-bar" style={{ position: 'relative' }}>
        <button
          className={`reaction-btn ${myReaction ? 'active' : ''}`}
          onMouseEnter={() => setReactOpen(true)}
          onMouseLeave={() => setTimeout(() => setReactOpen(false), 250)}
          onClick={() => react(myReaction ? null : 'like')}
        >
          {myLabel || '👍'} {myReaction ? myReaction[0].toUpperCase() + myReaction.slice(1) : 'Like'}
        </button>
        {reactOpen && (
          <div style={{
            position: 'absolute', bottom: '105%', left: 8, background: 'var(--surface)', borderRadius: 24,
            padding: '6px 10px', display: 'flex', gap: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10,
          }}>
            {REACTIONS.map((r) => (
              <button
                key={r}
                onClick={() => react(r)}
                style={{ fontSize: '1.5rem', transition: 'transform 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                title={r}
                aria-label={r}
              >
                {REACTION_EMOJI[r]}
              </button>
            ))}
          </div>
        )}
        <button className="reaction-btn" onClick={() => setShowComments((v) => !v)}>💬 Comment</button>
        <button className="reaction-btn" onClick={share}>↗️ Share</button>
      </div>

      {showComments && (
        <div style={{ marginTop: 12 }}>
          <form onSubmit={addComment} className="row" style={{ gap: 8, marginBottom: 10 }}>
            <Avatar url={profile?.avatar_url} name={profile?.display_name || '?'} size={32} />
            <input
              className="input"
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              style={{ borderRadius: 20, flex: 1 }}
            />
            <Button type="submit" size="sm" disabled={!commentText.trim()}>Post</Button>
          </form>
          {comments.map((c) => (
            <div key={c.id} className="row" style={{ alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <Avatar url={c.author?.avatar_url} name={c.author?.display_name || '?'} size={32} />
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '6px 12px', flex: 1 }}>
                <b style={{ fontSize: '0.85rem' }}>{c.author?.display_name}</b>
                <div style={{ fontSize: '0.9rem' }}>{c.body}</div>
                <div className="muted" style={{ fontSize: '0.75rem' }}>{timeAgo(c.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReportModal
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="post"
        targetId={post.id}
      />
    </div>
  );
}
