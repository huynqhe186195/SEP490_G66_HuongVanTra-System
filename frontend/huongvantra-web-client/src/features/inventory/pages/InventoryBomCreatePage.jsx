import { Navigate, useParams } from 'react-router-dom'

function InventoryBomCreatePage() {
  const { bomId } = useParams()
  const variantId = Number(bomId)
  const target = Number.isFinite(variantId) && variantId > 0 ? `/inventory/bom?variantId=${variantId}` : '/inventory/bom'
  return <Navigate to={target} replace />
}

export default InventoryBomCreatePage
