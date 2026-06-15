import { useEffect, useState } from 'react'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../services/authSession.js'

export function useAuthSession() {
  const [session, setSession] = useState(() => loadAuthSession())

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  return session
}
