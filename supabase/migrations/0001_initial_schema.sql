-- Rafi Book schema — run in Supabase SQL editor
create extension if not exists "uuid-ossp";

-- PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  bio text default '',
  location text default '',
  website text default '',
  education text default '',
  work text default '',
  avatar_url text default '',
  cover_url text default '',
  is_private boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- FRIEND REQUESTS / RELATIONS
create type friend_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  status friend_status default 'pending',
  created_at timestamptz default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create table if not exists friendships (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, friend_id),
  check (user_id < friend_id)
);

create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- POSTS
create type post_visibility as enum ('public', 'friends', 'private');

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  visibility post_visibility default 'public',
  group_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('like','love','haha','wow','sad','angry')),
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  caption text default '',
  created_at timestamptz default now()
);

create table if not exists bookmarks (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile')),
  target_id uuid not null,
  reason text not null,
  status text default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz default now()
);

-- MESSAGING
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text default '',
  media_url text,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create type notif_type as enum ('friend_request','friend_accept','comment','reaction','follow','message');

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete cascade,
  type notif_type not null,
  entity_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

-- STORIES
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  media_url text not null,
  media_type text default 'image' check (media_type in ('image','video')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- GROUPS
create type group_role as enum ('member','moderator','admin');
create type group_visibility as enum ('public','private');

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  avatar_url text default '',
  visibility group_visibility default 'public',
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role group_role default 'member',
  status text default 'approved' check (status in ('approved','pending','rejected')),
  created_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- EVENTS
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text default '',
  location text default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists event_attendees (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text default 'going' check (status in ('going','maybe','declined')),
  primary key (event_id, user_id)
);

-- add posts.group_id FK
alter table posts add constraint posts_group_fk foreign key (group_id) references groups(id) on delete set null;

-- INDEXES
create index if not exists idx_posts_author on posts(author_id, created_at desc);
create index if not exists idx_posts_group on posts(group_id) where group_id is not null;
create index if not exists idx_reactions_post on reactions(post_id);
create index if not exists idx_comments_post on comments(post_id);
create index if not exists idx_notifications_user on notifications(user_id, read, created_at desc);
create index if not exists idx_messages_conv on messages(conversation_id, created_at);
create index if not exists idx_stories_active on stories(expires_at);
create index if not exists idx_friend_requests_receiver on friend_requests(receiver_id, status);
create index if not exists idx_search_profiles on profiles using gin (to_tsvector('simple', display_name || ' ' || username));

-- RLS
alter table profiles enable row level security;
alter table friend_requests enable row level security;
alter table friendships enable row level security;
alter table follows enable row level security;
alter table blocks enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;
alter table shares enable row level security;
alter table bookmarks enable row level security;
alter table reports enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table stories enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;

-- helper: is admin
create or replace function is_admin() returns boolean language sql stable security definer as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- PROFILES policies
create policy "profiles_read" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id or is_admin());

-- FRIEND REQUESTS
create policy "fr_read" on friend_requests for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id or is_admin()
);
create policy "fr_insert" on friend_requests for insert with check (
  auth.uid() = sender_id and not exists (
    select 1 from blocks where blocker_id = receiver_id and blocked_id = auth.uid()
  )
);
create policy "fr_update" on friend_requests for update using (
  auth.uid() = receiver_id or auth.uid() = sender_id
);

-- FRIENDSHIPS
create policy "friendships_read" on friendships for select using (
  auth.uid() = user_id or auth.uid() = friend_id or is_admin()
);
create policy "friendships_insert" on friendships for insert with check (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friendships_delete" on friendships for delete using (
  auth.uid() = user_id or auth.uid() = friend_id or is_admin()
);

-- FOLLOWS
create policy "follows_read" on follows for select using (true);
create policy "follows_insert" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on follows for delete using (auth.uid() = follower_id);

-- BLOCKS
create policy "blocks_all" on blocks for all using (
  auth.uid() = blocker_id or is_admin()
) with check (auth.uid() = blocker_id);

-- POSTS
create policy "posts_read" on posts for select using (
  visibility = 'public'
  or author_id = auth.uid()
  or is_admin()
  or (visibility = 'friends' and exists (
    select 1 from friendships f
    where (f.user_id = auth.uid() and f.friend_id = author_id)
       or (f.friend_id = auth.uid() and f.user_id = author_id)
  ))
  or (visibility = 'private' and author_id = auth.uid())
  or (group_id is not null and exists (
    select 1 from group_members gm
    where gm.group_id = posts.group_id and gm.user_id = auth.uid() and gm.status = 'approved'
  ))
);
create policy "posts_insert" on posts for insert with check (
  auth.uid() = author_id
  and not exists (select 1 from blocks where blocker_id = author_id and blocked_id = auth.uid())
);
create policy "posts_update_own" on posts for update using (auth.uid() = author_id or is_admin());
create policy "posts_delete_own" on posts for delete using (auth.uid() = author_id or is_admin());

-- REACTIONS
create policy "reactions_read" on reactions for select using (true);
create policy "reactions_insert" on reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on reactions for delete using (auth.uid() = user_id);

-- COMMENTS
create policy "comments_read" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (auth.uid() = author_id);
create policy "comments_update_own" on comments for update using (auth.uid() = author_id or is_admin());
create policy "comments_delete_own" on comments for delete using (auth.uid() = author_id or is_admin());

-- SHARES
create policy "shares_read" on shares for select using (true);
create policy "shares_insert" on shares for insert with check (auth.uid() = user_id);
create policy "shares_delete_own" on shares for delete using (auth.uid() = user_id);

-- BOOKMARKS
create policy "bookmarks_all" on bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- REPORTS
create policy "reports_insert" on reports for insert with check (auth.uid() = reporter_id);
create policy "reports_read" on reports for select using (auth.uid() = reporter_id or is_admin());

-- CONVERSATIONS
create policy "conv_read" on conversations for select using (
  auth.uid() = user_a or auth.uid() = user_b or is_admin()
);
create policy "conv_insert" on conversations for insert with check (
  auth.uid() = user_a or auth.uid() = user_b
);

-- MESSAGES
create policy "msg_read" on messages for select using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ) or is_admin()
);
create policy "msg_insert" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from conversations c
    where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);
create policy "msg_update_read" on messages for update using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

-- NOTIFICATIONS
create policy "notif_read" on notifications for select using (auth.uid() = user_id);
create policy "notif_update" on notifications for update using (auth.uid() = user_id);
create policy "notif_delete" on notifications for delete using (auth.uid() = user_id);

-- STORIES
create policy "stories_read" on stories for select using (
  expires_at > now() and (
    auth.uid() = user_id
    or exists (
      select 1 from follows f where f.follower_id = auth.uid() and f.following_id = user_id
    )
    or exists (
      select 1 from friendships fr
      where (fr.user_id = auth.uid() and fr.friend_id = user_id)
         or (fr.friend_id = auth.uid() and fr.user_id = user_id)
    )
    or is_admin()
  )
);
create policy "stories_insert" on stories for insert with check (auth.uid() = user_id);
create policy "stories_delete_own" on stories for delete using (auth.uid() = user_id);

-- GROUPS
create policy "groups_read" on groups for select using (
  visibility = 'public'
  or exists (
    select 1 from group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.status = 'approved'
  )
  or owner_id = auth.uid()
  or is_admin()
);
create policy "groups_insert" on groups for insert with check (auth.uid() = owner_id);
create policy "groups_update" on groups for update using (
  owner_id = auth.uid()
  or exists (
    select 1 from group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.role in ('admin','moderator') and gm.status = 'approved'
  )
  or is_admin()
);
create policy "groups_delete" on groups for delete using (owner_id = auth.uid() or is_admin());

-- GROUP MEMBERS
create policy "gm_read" on group_members for select using (
  exists (
    select 1 from groups g
    where g.id = group_id and (
      g.visibility = 'public'
      or g.owner_id = auth.uid()
      or exists (select 1 from group_members x where x.group_id = g.id and x.user_id = auth.uid() and x.status = 'approved')
    )
  ) or is_admin()
);
create policy "gm_insert" on group_members for insert with check (auth.uid() = user_id);
create policy "gm_update" on group_members for update using (
  auth.uid() = user_id
  or exists (
    select 1 from group_members m where m.group_id = group_members.group_id
    and m.user_id = auth.uid() and m.role in ('admin','moderator') and m.status = 'approved'
  )
  or is_admin()
);
create policy "gm_delete" on group_members for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()
  )
  or is_admin()
);

-- EVENTS
create policy "events_read" on events for select using (true);
create policy "events_insert" on events for insert with check (auth.uid() = creator_id);
create policy "events_update_own" on events for update using (auth.uid() = creator_id or is_admin());
create policy "events_delete_own" on events for delete using (auth.uid() = creator_id or is_admin());

create policy "attendees_read" on event_attendees for select using (true);
create policy "attendees_insert" on event_attendees for insert with check (auth.uid() = user_id);
create policy "attendees_update" on event_attendees for update using (auth.uid() = user_id);
create policy "attendees_delete" on event_attendees for delete using (auth.uid() = user_id);

-- trigger: new auth user -> profile
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', coalesce(new.raw_user_meta_data->>'username', 'User'))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- trigger: notify on reaction
create or replace function notify_reaction() returns trigger language plpgsql security definer as $$
declare post_author uuid;
begin
  select author_id into post_author from posts where id = new.post_id;
  if post_author is not null and post_author <> new.user_id then
    insert into notifications (user_id, actor_id, type, entity_id)
    values (post_author, new.user_id, 'reaction', new.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_reaction on reactions;
create trigger on_reaction after insert on reactions
  for each row execute function notify_reaction();

-- trigger: notify on comment
create or replace function notify_comment() returns trigger language plpgsql security definer as $$
declare post_author uuid;
begin
  select author_id into post_author from posts where id = new.post_id;
  if post_author is not null and post_author <> new.author_id then
    insert into notifications (user_id, actor_id, type, entity_id)
    values (post_author, new.author_id, 'comment', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment on comments;
create trigger on_comment after insert on comments
  for each row execute function notify_comment();

-- trigger: notify on new message
create or replace function notify_message() returns trigger language plpgsql security definer as $$
declare conv record; other uuid;
begin
  select * into conv from conversations where id = new.conversation_id;
  if conv.user_a = new.sender_id then other := conv.user_b; else other := conv.user_a; end if;
  insert into notifications (user_id, actor_id, type, entity_id)
  values (other, new.sender_id, 'message', new.id);
  return new;
end;
$$;

drop trigger if exists on_message on messages;
create trigger on_message after insert on messages
  for each row execute function notify_message();
