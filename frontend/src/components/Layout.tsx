import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderGit2, Bot, LogOut, User, Users, TicketIcon, Rocket, Menu, X, MessageCircle, Star, Settings, ChevronsLeft, ChevronsRight, UserPlus, Bell, Sparkles, Lightbulb, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import AnimatedLogo from './AnimatedLogo'

const COLLAPSED_KEY = 'synthia-sidebar-collapsed'

export default function Layout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation('nav')
  const navigate = useNavigate()
  // Desktop collapsed state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })
  // Mobile expanded overlay
  const [mobileExpanded, setMobileExpanded] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* noop */ }
  }, [collapsed])

  const toggleCollapsed = () => setCollapsed(c => !c)

  // On mobile, clicking an icon in the rail navigates directly
  const handleMobileIconClick = (to: string) => {
    navigate(to)
    setMobileExpanded(false)
  }

  const handleNavClick = () => setMobileExpanded(false)

  // Desktop: expanded or collapsed sidebar; Mobile: always-visible rail + optional overlay
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-violet-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`

  const collapsedLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-center p-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-violet-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`

  type NavItem = { to: string; icon: React.ReactNode; label: string; end?: boolean; adminOnly?: boolean; authOnly?: boolean }

  const navItems: NavItem[] = [
    { to: '/synthia', icon: <Zap className="w-4 h-4" />, label: 'Synthia' },
    { to: '/projects', icon: <Rocket className="w-4 h-4" />, label: t('projects'), authOnly: true },
    { to: '/chat', icon: <MessageCircle className="w-4 h-4" />, label: t('chat') },
    { to: '/', icon: <LayoutDashboard className="w-4 h-4" />, label: t('dashboard'), end: true },
    { to: '/tickets', icon: <TicketIcon className="w-4 h-4" />, label: t('tickets') },
    { to: '/proposals', icon: <Lightbulb className="w-4 h-4" />, label: t('proposals') },
    { to: '/repos', icon: <FolderGit2 className="w-4 h-4" />, label: t('repos'), adminOnly: true },
    { to: '/tasks', icon: <Bot className="w-4 h-4" />, label: t('tasks'), adminOnly: true },
    { to: '/users', icon: <Users className="w-4 h-4" />, label: t('users'), adminOnly: true },
    { to: '/admin/featured', icon: <Star className="w-4 h-4" />, label: t('featured'), adminOnly: true },
    { to: '/admin/demo-requests', icon: <UserPlus className="w-4 h-4" />, label: t('demoRequests'), adminOnly: true },
    { to: '/admin/notifications', icon: <Bell className="w-4 h-4" />, label: t('notifications'), adminOnly: true },
    { to: '/admin/proposals', icon: <Lightbulb className="w-4 h-4" />, label: t('adminProposals'), adminOnly: true },
    { to: '/about', icon: <Sparkles className="w-4 h-4" />, label: t('about') },
  ]

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false
    if (item.authOnly && !user) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* ===== MOBILE: always-visible icon rail ===== */}
      <aside className="fixed top-0 left-0 z-50 h-full w-16 border-r border-gray-800 bg-gray-950 flex flex-col items-center py-3 gap-1 md:hidden">
        {/* Logo / hamburger */}
        <button
          onClick={() => setMobileExpanded(v => !v)}
          className="mb-3 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title={t('expandSidebar', 'Expand sidebar')}
        >
          {mobileExpanded ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Nav icons */}
        <nav className="flex flex-col gap-1 items-center w-full px-2">
          {visibleItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={collapsedLinkClass}
              onClick={() => handleMobileIconClick(item.to)}
              title={item.label}
            >
              {item.icon}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user avatar */}
        {user && (
          <div className="mt-auto flex flex-col items-center gap-2 pb-2">
            <NavLink to="/settings" className="p-2 text-gray-500 hover:text-violet-400 rounded-lg hover:bg-gray-800 transition-colors" title={t("settings")} onClick={() => setMobileExpanded(false)}>
              <Settings className="w-4 h-4" />
            </NavLink>
            <button onClick={logout} className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors" title={t("signOut")}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile expanded overlay */}
      {mobileExpanded && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 md:hidden" onClick={() => setMobileExpanded(false)} />
          <aside className="fixed top-0 left-0 z-[60] h-full w-64 border-r border-gray-800 p-4 flex flex-col gap-6 bg-gray-950 md:hidden">
            <div className="flex items-center gap-2 px-2">
              <AnimatedLogo className="h-7 inline-block" interval={15000} />
              <span className="text-xl font-bold">ynthia.bot</span>
              <button onClick={() => setMobileExpanded(false)} className="ml-auto text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {visibleItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={handleNavClick}>
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto space-y-3">
              {user && (
                <div className="px-2 py-3 bg-gray-900 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium truncate">{user.displayName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 capitalize">{user.role}</span>
                    <div className="flex items-center gap-2">
                      <NavLink to="/settings" onClick={handleNavClick} className="text-xs text-gray-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
                        <Settings className="w-3 h-3" />
                      </NavLink>
                      <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                        <LogOut className="w-3 h-3" /> {t('signOut')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="px-2 text-xs text-gray-600">{t('missionControl')}</div>
            </div>
          </aside>
        </>
      )}

      {/* ===== DESKTOP sidebar ===== */}
      <aside className={`
        hidden md:flex md:static md:flex-col md:gap-6 md:border-r md:border-gray-800 md:bg-gray-950
        transition-all duration-200 ease-in-out flex-shrink-0
        ${collapsed ? 'md:w-16 md:p-2' : 'md:w-64 md:p-4'}
      `}>
        {/* Logo area */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-2 px-2'}`}>
          <AnimatedLogo className="h-7 inline-block flex-shrink-0" interval={15000} />
          {!collapsed && <span className="text-xl font-bold">ynthia.bot</span>}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {visibleItems.map(item =>
            collapsed ? (
              <NavLink key={item.to} to={item.to} end={item.end} className={collapsedLinkClass} title={item.label}>
                {item.icon}
              </NavLink>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                {item.icon}
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        {/* User section + collapse toggle */}
        <div className="mt-auto space-y-3">
          {user && !collapsed && (
            <div className="px-2 py-3 bg-gray-900 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium truncate">{user.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 capitalize">{user.role}</span>
                <div className="flex items-center gap-2">
                  <NavLink to="/settings" className="text-xs text-gray-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
                    <Settings className="w-3 h-3" />
                  </NavLink>
                  <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                    <LogOut className="w-3 h-3" /> {t('signOut')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {user && collapsed && (
            <div className="flex flex-col items-center gap-2">
              <NavLink to="/settings" className="p-2 text-gray-500 hover:text-violet-400 rounded-lg hover:bg-gray-800 transition-colors" title={t("settings")}>
                <Settings className="w-4 h-4" />
              </NavLink>
              <button onClick={logout} className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors" title={t("signOut")}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {!collapsed && <div className="px-2 text-xs text-gray-600">{t('missionControl')}</div>}
          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={`flex items-center justify-center w-full p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors ${collapsed ? '' : 'gap-2'}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <><ChevronsLeft className="w-4 h-4" /> <span className="text-xs">{t('collapse')}</span></>}
          </button>
        </div>
      </aside>

      {/* Main content — offset for mobile rail */}
      <main className="flex-1 p-4 md:p-8 overflow-auto ml-16 md:ml-0">
        <Outlet />
      </main>
    </div>
  )
}
