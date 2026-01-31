import { Outlet, NavLink } from 'react-router-dom'
import { Zap, LayoutDashboard, FolderGit2 } from 'lucide-react'

export default function Layout() {
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
          <span className="text-xl font-bold">CynthiaDash</span>
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
        </nav>

        <div className="mt-auto px-2 text-xs text-gray-600">
          Cynthia ⚡ Mission Control
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
