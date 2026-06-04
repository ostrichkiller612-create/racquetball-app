import { Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Home } from '../screens/Home'
import { Log } from '../screens/Log'
import { Stats } from '../screens/Stats'
import { More } from '../screens/More'

export function AppShell() {
  return (
    <div className="min-h-full pb-16">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<Log />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
