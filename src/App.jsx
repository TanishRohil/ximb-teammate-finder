import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Browse from './pages/Browse'
import CreateRequest from './pages/CreateRequest'
import RequestDetail from './pages/RequestDetail'
import MyDashboard from './pages/MyDashboard'

export default function App() {
  const { user, profile, loading, refreshProfile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-display text-sm text-charcoal/50">Opening the archive…</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const needsOnboarding = !profile

  return (
    <div className="min-h-screen">
      <Navbar profile={profile} />
      <Routes>
        <Route
          path="/onboarding"
          element={<Onboarding user={user} existingProfile={profile} onSaved={refreshProfile} />}
        />
        {needsOnboarding ? (
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        ) : (
          <>
            <Route path="/browse" element={<Browse profile={profile} />} />
            <Route path="/new" element={<CreateRequest profile={profile} />} />
            <Route path="/request/:id" element={<RequestDetail profile={profile} />} />
            <Route path="/dashboard" element={<MyDashboard profile={profile} />} />
            <Route path="*" element={<Navigate to="/browse" replace />} />
          </>
        )}
      </Routes>
    </div>
  )
}
