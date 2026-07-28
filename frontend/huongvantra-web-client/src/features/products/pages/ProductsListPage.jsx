import { useEffect, useState } from 'react'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { isWarehouseRole } from '../../auth/utils/permissions.js'
import ProductsStoreListPage from './ProductsStoreListPage.jsx'
import ProductsWarehouseListPage from './ProductsWarehouseListPage.jsx'

function ProductsListPage() {
  const [session, setSession] = useState(() => loadAuthSession())
  const isWarehouse = isWarehouseRole(session)

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  if (isWarehouse) {
    return <ProductsWarehouseListPage />
  }

  return <ProductsStoreListPage />
}

export default ProductsListPage
