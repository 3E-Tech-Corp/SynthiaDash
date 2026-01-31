import { useEffect, useState } from 'react'
import { Activity, Cpu, Wifi, WifiOff } from 'lucide-react'
import { api } from '../services/api'
import type { GatewayStatus } from '../services/api'

export default function StatusCard() {
  const [status, setStatus] = useState<GatewayStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getStatus()
        setStatus(data)
      } catch {
        setStatus({ online: false })
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-800 rounded w-2/3"></div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 border rounded-xl p-6 ${
      status?.online ? 'border-green-800' : 'border-red-800'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Cynthia Status
        </h2>
        <div className={`flex items-center gap-2 text-sm ${
          status?.online ? 'text-green-400' : 'text-red-400'
        }`}>
          {status?.online ? (
            <><Wifi className="w-4 h-4" /> Online</>
          ) : (
            <><WifiOff className="w-4 h-4" /> Offline</>
          )}
        </div>
      </div>

      {status?.online && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Model</span>
            <p className="text-gray-200 flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {status.model || 'Unknown'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Host</span>
            <p className="text-gray-200">{status.host || 'Unknown'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
