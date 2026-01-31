import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Repos from './pages/Repos'
import RepoDetail from './pages/RepoDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="repos" element={<Repos />} />
          <Route path="repos/:owner/:repo" element={<RepoDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
