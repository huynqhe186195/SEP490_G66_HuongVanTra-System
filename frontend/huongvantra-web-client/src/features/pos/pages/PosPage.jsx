import { useState } from 'react'
import Cart from '../components/Cart.jsx'
import IngredientGrid from '../components/IngredientGrid.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import ProductGrid from '../components/ProductGrid.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'

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
      <PageHeader title="POS bán hàng" searchPlaceholder="Tìm kiếm..." />

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