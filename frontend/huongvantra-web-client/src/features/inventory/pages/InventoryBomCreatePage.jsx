import { Navigate, useParams } from 'react-router-dom'

function InventoryBomCreatePage() {
  const { bomId } = useParams()
  const variantId = String(bomId || '').trim()
  const target = variantId ? `/inventory/boms?variantId=${encodeURIComponent(variantId)}` : '/inventory/boms'
  return <Navigate to={target} replace />
}

export default InventoryBomCreatePage
