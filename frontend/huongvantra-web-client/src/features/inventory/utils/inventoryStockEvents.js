export const INVENTORY_STOCK_CHANGED_EVENT = 'hvt-inventory-stock-changed'

export function notifyInventoryStockChanged() {
  window.dispatchEvent(new CustomEvent(INVENTORY_STOCK_CHANGED_EVENT))
}
