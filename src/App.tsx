import { BrowserRouter, Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/layout/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { FeedPage } from './features/feed/FeedPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { FriendsPage } from './features/friends/FriendsPage';
import { MessagesPage } from './features/messaging/MessagesPage';
import { GroupsPage, GroupDetailPage } from './features/groups/GroupsPage';
import { EventsPage } from './features/events/EventsPage';
import { SearchPage } from './features/search/SearchPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AdminPage } from './features/admin/AdminPage';

function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '4rem' }}>🔍</div>
      <h1 style={{ margin: '12px 0' }}>Page not found</h1>
      <Link to="/" style={{ color: 'var(--primary)', fontWeight: 700 }}>Go to Rafi Book home</Link>
    </div>
  );
}

function GroupDetailPageWrapper() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <NotFound />;
  return <GroupDetailPage id={id} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPageWrapper />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
