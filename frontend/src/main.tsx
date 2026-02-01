import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <App />
    </Suspense>
  </StrictMode>,
)
