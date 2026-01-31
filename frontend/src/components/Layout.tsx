import { Outlet, NavLink } from 'react-router-dom'
import { Zap, LayoutDashboard, FolderGit2, Bot, Cpu, LogOut, User, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-violet-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 p-4 flex flex-col gap-6">
        <div className="flex items-center gap-2 px-2">
          <Zap className="w-6 h-6 text-violet-400" />
          <span className="text-xl font-bold">SynthiaDash</span>
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
          <NavLink to="/repos" className={linkClass}>
            <FolderGit2 className="w-4 h-4" />
            Repos
          </NavLink>
          <NavLink to="/repos/3E-Tech-Corp/Zhijian" className={linkClass}>
            <Cpu className="w-4 h-4" />
            Zhijian
          </NavLink>
          <NavLink to="/tasks" className={linkClass}>
            <Bot className="w-4 h-4" />
            Tasks
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users" className={linkClass}>
              <Users className="w-4 h-4" />
              Users
            </NavLink>
          )}
        </nav>

        {/* User section */}
        <div className="mt-auto space-y-3">
          {user && (
            <div className="px-2 py-3 bg-gray-900 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium truncate">{user.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 capitalize">{user.role}</span>
                <button
                  onClick={logout}
                  className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3 h-3" /> Sign out
                </button>
              </div>
            </div>
          )}
          <div className="px-2 text-xs text-gray-600">
            Synthia ⚡ Mission Control
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
