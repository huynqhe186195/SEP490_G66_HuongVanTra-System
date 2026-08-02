import { Navigate } from 'react-router-dom'
import { loadAuthSession } from '../features/auth/services/authSession.js'
import { resolveHomeRoute } from './navigation.js'

function HomeRedirect() {
  return <Navigate to={resolveHomeRoute(loadAuthSession())} replace />
}


export default HomeRedirect
