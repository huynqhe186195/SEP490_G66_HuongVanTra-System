import BatchStockAdjustmentModal, { buildSkuSnapshotName } from './BatchStockAdjustmentModal.jsx'

function AdjustSkuStockModal({ sku, productName, quantityOnHand = 0, onClose, onSubmitted }) {
  return (
    <BatchStockAdjustmentModal
      lines={[
        {
          sku,
          productName,
          quantityOnHand,
          skuSnapshotName: buildSkuSnapshotName(sku, productName),
        },
      ]}
      onClose={onClose}
      onSubmitted={onSubmitted}
    />
  )
}

export default AdjustSkuStockModal
