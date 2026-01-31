import StatusCard from '../components/StatusCard'
import { Zap } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Zap className="w-8 h-8 text-violet-400" />
        Mission Control
      </h1>

      <div className="grid gap-6">
        <StatusCard />

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-4">
            <a
              href="/repos"
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-2">📦</div>
              <div className="text-sm font-medium">Repos</div>
              <div className="text-xs text-gray-500">View & deploy</div>
            </a>
            <div className="bg-gray-800 rounded-lg p-4 text-center opacity-50">
              <div className="text-2xl mb-2">💬</div>
              <div className="text-sm font-medium">Chat</div>
              <div className="text-xs text-gray-500">Coming soon</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center opacity-50">
              <div className="text-2xl mb-2">⏰</div>
              <div className="text-sm font-medium">Cron Jobs</div>
              <div className="text-xs text-gray-500">Coming soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
