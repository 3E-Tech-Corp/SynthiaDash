import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Repos from './pages/Repos'
import RepoDetail from './pages/RepoDetail'
import Tasks from './pages/Tasks'
import TicketsPage from './pages/Tickets'
import ProjectsPage from './pages/Projects'
import UsersPage from './pages/Users'
import ChatPage from './pages/Chat'
import FeaturedProjectsAdmin from './pages/FeaturedProjectsAdmin'
import SettingsPage from './pages/Settings'
import Login from './pages/Login'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function RootRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Home />
  }

  // Authenticated: render Layout with nested routes
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<RootRoute />}>
        <Route index element={<Dashboard />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="repos" element={<Repos />} />
        <Route path="repos/:owner/:repo" element={<RepoDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin/featured" element={<FeaturedProjectsAdmin />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
