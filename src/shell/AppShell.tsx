import { Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Home } from '../screens/Home'
import { Log } from '../screens/Log'
import { Stats } from '../screens/Stats'
import { Share } from '../screens/Share'
import { More } from '../screens/More'
import { Contacts } from '../contacts/Contacts'
import { ImportContacts } from '../contacts/ImportContacts'
import { Leagues } from '../leagues/Leagues'
import { League } from '../leagues/League'
import { ProfileEdit } from '../profile/ProfileEdit'
import { CourtBackground } from '../ui/CourtBackground'

export function AppShell() {
  return (
    <div className="min-h-full pb-16">
      <CourtBackground />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<Log />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/share" element={<Share />} />
        <Route path="/more" element={<More />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/import" element={<ImportContacts />} />
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/leagues/:id" element={<League />} />
        <Route path="/profile" element={<ProfileEdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
