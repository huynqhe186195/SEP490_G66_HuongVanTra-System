import { useState } from 'react'
import Cart from '../components/Cart.jsx'
import IngredientGrid from '../components/IngredientGrid.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import ProductGrid from '../components/ProductGrid.jsx'

const products = [
  { name: 'Trà Lục Bảo', price: '320.000đ', stockCounter: '32', stockWarehouse: '0', color: 'bg-[#D3E4AD]' },
  { name: 'Hồng Trà Hương Vân', price: '180.000đ', stockCounter: '16', stockWarehouse: '2', color: 'bg-[#D69E33]' },
  { name: 'Trà Ướp Hoa Bưởi', price: '220.000đ', color: 'bg-[#B5D5B0]' },
  { name: 'Kẹo Trà Hương Vân', price: '95.000đ', color: 'bg-[#C8372D]' },
  { name: 'Túi Gấm Trà Cao Cấp', price: '700.000đ', color: 'bg-[#2D6EB4]' },
  { name: 'Hộp Trà Đỉnh', price: '3.000.000đ', color: 'bg-[#558B64]' },
]

const ingredientItems = ['bg-[#D3E4AD]', 'bg-[#D69E33]', 'bg-[#D69E33]']

const cartItems = [
  { name: 'Hồng Trà Hương Vân x2', price: '360.000đ' },
  { name: 'Trà Ướp Hoa Bưởi x1', price: '220.000đ' },
  { name: 'Túi Gấm Trà Cao Cấp x1', price: '700.000đ' },
]

function PosPage() {
  const [openModal, setOpenModal] = useState(null)

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <div className="border-b-2 border-[#538463] pb-1">
          <span className="text-sm font-medium text-[#538463]">POS bán hàng</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-64">
            <input
              className="w-full rounded-full border-none bg-[#EBF0E9] py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-[#538463]"
              placeholder="Tìm kiếm..."
              type="text"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex items-center gap-4 text-gray-600">
            <button type="button" className="hover:text-[#538463]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
            <button type="button" className="hover:text-[#538463]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="flex items-center">
            <img
              alt="User avatar"
              className="h-9 w-9 rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhD8En3wd_Ho2PlSiRzHa4VT-iVttfv5zGDVQSlO1RFzaKi5nfnglk9lD0NZbUMYlpsu4Bw0JE2DJv2Sp7ZzqW3DVx7QmjrgJFZK70fUM6PNCv9wPY2ndnyZbUbL3xLUeFZg3RdYA3_y7PtKLS2nvVlr211tVECRgnikO_m4hYJRQUBOsIZKFWTLONS_8PslOsjj8Tctssjdnlai5pzwgp-vau7e5x-YIysWIceRZtL1jKVSc2M6O877oLFQy9Qe53czBQYC5zJx1V"
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-visible p-0 md:gap-6 lg:gap-8 xl:flex-row xl:items-start">
        <section className="min-w-0 flex-1 overflow-y-auto pb-0 xl:pr-2">
          <ProductGrid title="Sản phẩm" products={products} />
          <IngredientGrid title="Nguyên liệu" colors={ingredientItems} />
        </section>

        <Cart
          items={cartItems}
          total="1.280.000đ"
          onAddCustomerClick={() => setOpenModal('customer')}
          onAddOfferClick={() => setOpenModal('offer')}
        />
      </div>

      <OrderOfferModal isOpen={openModal === 'offer'} onClose={() => setOpenModal(null)} />
      <AddCustomerModal isOpen={openModal === 'customer'} onClose={() => setOpenModal(null)} />
    </>
  )
}

export default PosPage