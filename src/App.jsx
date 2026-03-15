import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Results from './pages/Results'
import Templates from './pages/Templates'
import Broadcasts from './pages/Broadcasts'
import Groups from './pages/Groups'
import Friends from './pages/Friends'
import Logs from './pages/Logs'
import Settings from './pages/Settings'

export default function App() {
  const { user, loading, signIn, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Login onSignIn={signIn} />

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} onSignOut={signOut} />
      <main className="flex-1 ml-[260px] min-h-screen">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
          <Route path="/results" element={<Results />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/broadcasts" element={<Broadcasts />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
