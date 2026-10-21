export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  location: string;
  website: string;
  education: string;
  work: string;
  avatar_url: string;
  cover_url: string;
  is_private: boolean;
  is_admin: boolean;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  body: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  visibility: 'public' | 'friends' | 'private';
  group_id: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
  reactions_count?: number;
  comments_count?: number;
  shares_count?: number;
  my_reaction?: string | null;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author?: Profile;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
};

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  other?: Profile;
  last_message?: Message;
  unread_count?: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  media_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: 'friend_request' | 'friend_accept' | 'comment' | 'reaction' | 'follow' | 'message';
  entity_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  expires_at: string;
  created_at: string;
  user?: Profile;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  visibility: 'public' | 'private';
  owner_id: string;
  created_at: string;
  member_count?: number;
  my_role?: string;
  my_status?: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: 'post' | 'comment' | 'profile';
  target_id: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  reporter?: Profile;
};

export type EventItem = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  attendee_count?: number;
};
