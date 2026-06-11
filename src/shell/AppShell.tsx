import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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
import { ImportLeague } from '../leagues/ImportLeague'
import { LinkMatches } from '../leagues/LinkMatches'
import { BoardPoints } from '../leagues/BoardPoints'
import { EditMatch } from '../matches/EditMatch'
import { PENDING_JOIN_KEY } from '../leagues/JoinLeague'
import { ProfileEdit } from '../profile/ProfileEdit'
import { CourtBackground } from '../ui/CourtBackground'

export function AppShell() {
  const navigate = useNavigate()

  // Someone opened an invite link while signed out, then signed in — finish
  // taking them to the claim screen.
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_JOIN_KEY)
    if (pending) {
      navigate(`/join/${pending}`, { replace: true })
    }
  }, [navigate])

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
        <Route path="/leagues/:id/import" element={<ImportLeague />} />
        <Route path="/leagues/:id/link" element={<LinkMatches />} />
        <Route path="/leagues/:id/board" element={<BoardPoints />} />
        <Route path="/matches/:id" element={<EditMatch />} />
        <Route path="/profile" element={<ProfileEdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
