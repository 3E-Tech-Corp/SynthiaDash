import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Zap, LayoutDashboard, FolderGit2, Bot, LogOut, User, Users, TicketIcon, Rocket, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-violet-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`

  const handleNavClick = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gray-950 border-b border-gray-800 flex items-center gap-3 px-4 py-3 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <Zap className="w-5 h-5 text-violet-400" />
        <span className="text-lg font-bold">SynthiaDash</span>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 border-r border-gray-800 p-4 flex flex-col gap-6
        bg-gray-950 transition-transform duration-200 ease-in-out
        md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-2 px-2">
          <Zap className="w-6 h-6 text-violet-400" />
          <span className="text-xl font-bold">SynthiaDash</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-gray-500 hover:text-white md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={linkClass} onClick={handleNavClick}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
          <NavLink to="/repos" className={linkClass} onClick={handleNavClick}>
            <FolderGit2 className="w-4 h-4" />
            Repos
          </NavLink>
          <NavLink to="/tasks" className={linkClass} onClick={handleNavClick}>
            <Bot className="w-4 h-4" />
            Tasks
          </NavLink>
          <NavLink to="/tickets" className={linkClass} onClick={handleNavClick}>
            <TicketIcon className="w-4 h-4" />
            Tickets
          </NavLink>
          {user?.role === 'admin' && (
            <>
              <NavLink to="/projects" className={linkClass} onClick={handleNavClick}>
                <Rocket className="w-4 h-4" />
                Projects
              </NavLink>
              <NavLink to="/users" className={linkClass} onClick={handleNavClick}>
                <Users className="w-4 h-4" />
                Users
              </NavLink>
            </>
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
      <main className="flex-1 p-4 md:p-8 overflow-auto mt-14 md:mt-0">
        <Outlet />
      </main>
    </div>
  )
}
