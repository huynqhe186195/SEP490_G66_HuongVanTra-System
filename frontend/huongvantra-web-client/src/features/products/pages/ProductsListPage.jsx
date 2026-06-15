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

  return (
    <>
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Đang xem catalog cửa hàng (SKU đã đồng bộ).</p>
        <p className="mt-1">
          Sản phẩm mới tạo ở kho sẽ không hiện ở đây cho đến khi Thủ kho thêm SKU và bạn bấm Đồng bộ.
        </p>
      </div>
      <ProductsStoreListPage />
    </>
  )
}

export default ProductsListPage
