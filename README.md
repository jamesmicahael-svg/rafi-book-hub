# Rafi Book

Facebook-style social networking website. React + Vite + TypeScript frontend, Supabase backend (Auth, Postgres, Storage, Realtime).

## Features

- **Authentication** — email/password signup & login (Supabase Auth), profile auto-created via DB trigger
- **News feed** — posts with text + image/video, visibility (public / friends / only me), realtime updates
- **Reactions** — like, love, haha, wow, sad, angry with hover picker
- **Comments** — nested-ready threaded comments on posts
- **Sharing** — share posts to your timeline with caption
- **Stories** — 24h expiring image/video stories for friends
- **Friends** — requests, accept/reject, suggestions, mutual count
- **Follow** — follow/unfollow users
- **Messaging** — 1:1 realtime chat, read receipts, unread badges
- **Notifications** — friend requests, reactions, comments, follows, messages (realtime + badge)
- **Groups** — public/private groups, join/approval, group discussion feed, member list, roles (member/moderator/admin)
- **Events** — create events, RSVP going/maybe/declined, attendee counts
- **Search** — people, posts, groups
- **Profile** — cover, avatar, bio, work, education, location, website, private account toggle
- **Settings** — edit profile, upload avatar
- **Admin** — reports queue, user management, post moderation, stats
- **Moderation** — report posts/comments/profiles
- **Dark / light theme** — toggle persisted to localStorage
- **Responsive** — mobile-friendly layout

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, React Router 6 |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| Styling | Custom CSS (CSS variables, no framework dependency) |

## Project structure

```
src/
  App.tsx                 # routes
  main.tsx
  contexts/AuthContext.tsx
  lib/supabase.ts, types.ts, utils.ts
  styles/globals.css
  components/
    layout/Navbar.tsx, RequireAuth.tsx
    ui/Button.tsx, Avatar.tsx, Modal.tsx, Form.tsx, Feedback.tsx
  features/
    auth/       LoginPage, SignupPage
    feed/       FeedPage, PostCard, PostComposer, ReportModal
    profile/    ProfilePage
    friends/    FriendsPage
    messaging/  MessagesPage
    stories/    StoryTray
    groups/     GroupsPage (+ GroupDetailPage)
    events/     EventsPage
    search/     SearchPage
    settings/   SettingsPage
    admin/      AdminPage
supabase/migrations/0001_initial_schema.sql
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste & run `supabase/migrations/0001_initial_schema.sql`.
3. **Storage** → create a public bucket named `media` (for avatars, post media, stories).
4. **Authentication → Providers** → enable Email (confirm email optional for dev).
5. Copy project URL + anon key from **Settings → API**.

### 2. Local app

```bash
cp .env.example .env
# edit .env — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open http://localhost:5173

### 3. Production build

```bash
npm run build   # outputs to dist/
```

## Environment variables

| Name | Description |
|------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

Never commit `.env`. Only `.env.example` is tracked.

## Database

Normalized schema with row-level security on every table:

- `profiles`, `friend_requests`, `friendships`, `follows`, `blocks`
- `posts`, `reactions`, `comments`, `shares`, `bookmarks`, `reports`
- `conversations`, `messages`
- `notifications`
- `stories`
- `groups`, `group_members`
- `events`, `event_attendees`

Triggers: auto-profile on signup; notifications on reaction, comment, message.

## Notes

- **Do not deploy** unless the product owner explicitly asks (no Vercel/DNS/prod release from this repo's build scripts).
- First signup: set yourself admin in SQL: `update profiles set is_admin = true where username = 'yourname';`
- Media uploads require the `media` storage bucket; without it, text posts still work.

<!-- redeploy: fix invalid api key env -->
