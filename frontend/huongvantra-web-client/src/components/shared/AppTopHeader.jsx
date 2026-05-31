import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, refresh } from '../../features/auth/services/authApi.js'
import { loadAuthSession, saveAuthSession } from '../../features/auth/services/authSession.js'
import PageHeader from './PageHeader.jsx'

function AppTopHeader({ searchPlaceholder = 'Tim kiem...', rightContent = null }) {
  const navigate = useNavigate()
  const [authSession, setAuthSession] = useState(() => loadAuthSession())
  const [currentUser, setCurrentUser] = useState(null)
  const [isSyncingAuth, setIsSyncingAuth] = useState(false)

  useEffect(() => {
    let isMounted = true
    let refreshTimerId = null

    const clearTimer = () => {
      if (refreshTimerId) {
        window.clearTimeout(refreshTimerId)
        refreshTimerId = null
      }
    }

    const handleInvalidSession = () => {
      clearTimer()
      if (isMounted) {
        setAuthSession(null)
        setCurrentUser(null)
      }
      navigate('/login', { replace: true })
    }

    const scheduleRefresh = (session) => {
      clearTimer()

      if (!session?.expiresAtUtc) {
        return
      }

      const expiresAt = new Date(session.expiresAtUtc).getTime()
      const refreshAt = expiresAt - Date.now() - 60000

      if (Number.isNaN(refreshAt)) {
        return
      }

      refreshTimerId = window.setTimeout(() => {
        void syncSession(session)
      }, Math.max(refreshAt, 0))
    }

    const syncSession = async (session) => {
      if (!session) {
        return
      }

      if (isMounted) {
        setIsSyncingAuth(true)
      }

      const syncCurrentUser = async (accessToken, fallbackSession) => {
        const user = await me(accessToken)
        if (!isMounted) {
          return
        }

        setCurrentUser(user)
        setAuthSession(fallbackSession)
        scheduleRefresh(fallbackSession)
      }

      try {
        await syncCurrentUser(session.accessToken, session)
      } catch {
        try {
          const refreshedSession = await refresh(session.accessToken, session.refreshToken)
          saveAuthSession(refreshedSession)
          await syncCurrentUser(refreshedSession.accessToken, refreshedSession)
        } catch {
          handleInvalidSession()
        }
      } finally {
        if (isMounted) {
          setIsSyncingAuth(false)
        }
      }
    }

    void syncSession(authSession)

    return () => {
      isMounted = false
      clearTimer()
    }
  }, [authSession, navigate])

  return (
    <PageHeader searchPlaceholder={searchPlaceholder} rightContent={rightContent} />
  )
}

export default AppTopHeader
