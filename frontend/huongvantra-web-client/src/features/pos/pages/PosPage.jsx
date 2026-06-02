import { useState } from 'react'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'



const searchResults = [

  {

    group: 'Sản phẩm',

    items: [

      {

        name: 'Trà Xanh Thái Nguyên Thượng Hạng',

        sku: 'TX-TN-001',

        stock: 'Tồn: 15',

        price: 150000,

        image: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?q=80&w=800&auto=format&fit=crop',

        featured: true,

      },

      {

        name: 'Hồng Trà Cổ Thụ Hà Giang',

        sku: 'HT-HG-002',

        stock: 'Tồn: 8',

        price: 220000,

        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Ô Long Lâm Đồng',

        sku: 'OL-LD-003',

        stock: 'Tồn: 20',

        price: 320000,

        image: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Sen Tây Hồ',

        sku: 'TS-TH-004',

        stock: 'Tồn: 12',

        price: 450000,

        image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Nhài Cao Cấp',

        sku: 'TN-CC-005',

        stock: 'Tồn: 18',

        price: 180000,

        image: 'https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Phổ Nhĩ Vân Nam',

        sku: 'PN-VN-006',

        stock: 'Tồn: 5',

        price: 520000,

        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Gạo Rang Hàn Quốc',

        sku: 'GR-HQ-007',

        stock: 'Tồn: 14',

        price: 130000,

        image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Đào Cam Sả',

        sku: 'TD-CS-008',

        stock: 'Tồn: 25',

        price: 85000,

        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Vải Hoa Hồng',

        sku: 'TV-HH-009',

        stock: 'Tồn: 11',

        price: 95000,

        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Matcha Latte Nhật Bản',

        sku: 'ML-NB-010',

        stock: 'Tồn: 17',

        price: 110000,

        image: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Sữa Ô Long',

        sku: 'TS-OL-011',

        stock: 'Tồn: 30',

        price: 65000,

        image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Sữa Matcha',

        sku: 'TS-MA-012',

        stock: 'Tồn: 26',

        price: 70000,

        image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Cold Brew Trà Đen',

        sku: 'CB-TD-013',

        stock: 'Tồn: 9',

        price: 120000,

        image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Atiso Đỏ',

        sku: 'AT-DO-014',

        stock: 'Tồn: 16',

        price: 140000,

        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Hoa Cúc Mật Ong',

        sku: 'HC-MO-015',

        stock: 'Tồn: 21',

        price: 125000,

        image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Trà Chanh Giã Tay',

        sku: 'TC-GT-016',

        stock: 'Tồn: 40',

        price: 45000,

        image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Bánh Mochi Matcha',

        sku: 'BM-MA-017',

        stock: 'Tồn: 10',

        price: 90000,

        image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Set Quà Tặng Trà Premium',

        sku: 'QT-PR-018',

        stock: 'Tồn: 6',

        price: 890000,

        image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Bình Pha Trà Thủy Tinh',

        sku: 'BP-TT-019',

        stock: 'Tồn: 13',

        price: 350000,

        image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?q=80&w=800&auto=format&fit=crop',

      },

      {

        name: 'Ly Sứ Matcha Nhật',

        sku: 'LS-MN-020',

        stock: 'Tồn: 22',

        price: 175000,

        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',

      },

    ],

  },

]



// const categories = ['Tất cả', 'Trà Xanh', 'Hồng Trà', 'Trà Ô Long', 'Dụng Cụ', 'Quà Tặng']

function Icon({ children, className = '', filled = false }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {children}
    </span>
  )
}

function PosPage() {
  const [tabs, setTabs] = useState([
    { id: 1, label: 'Hóa đơn 1' },
    { id: 2, label: 'Hóa đơn 2' },
  ])
  const [activeTabId, setActiveTabId] = useState(1)
//   const [activeCategory, setActiveCategory] = useState('Tất cả')
  const [searchValue, setSearchValue] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('Tìm hoặc thêm khách hàng')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [openModal, setOpenModal] = useState(null)
  const [cartItems, setCartItems] = useState([
    { name: 'Trà Xanh Thái Nguyên Thượng Hạng', qty: 2, unit: 'x', price: 150000, step: 1 },
    { name: 'Hồng Trà Cổ Thụ Hà Giang', qty: 1, unit: 'x', price: 220000, step: 1 },
    { name: 'Bột Matcha Uji Nguyên Chất', qty: 0.5, unit: 'kg x', price: 450000, step: 0.5 },
  ])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(value)

  const subtotal = cartItems.reduce((sum, item) => sum + item.qty * item.price, 0)
  const discountAmount = Math.round((subtotal * discountPercent) / 100)
  const total = Math.max(subtotal - discountAmount, 0)

  const addTab = () => {
    const nextId = tabs.length ? Math.max(...tabs.map((tab) => tab.id)) + 1 : 1
    const nextTab = { id: nextId, label: `Hóa đơn ${nextId}` }
    setTabs((currentTabs) => [...currentTabs, nextTab])
    setActiveTabId(nextId)
  }

  const closeTab = (tabId) => {
    setTabs((currentTabs) => {
      if (currentTabs.length === 1) {
        return currentTabs
      }

      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId)

      if (tabId === activeTabId) {
        setActiveTabId(nextTabs[0]?.id ?? activeTabId)
      }

      return nextTabs
    })
  }

  const updateQuantity = (itemName, direction) => {
    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.name !== itemName) {
          return item
        }

        const nextQty = direction === 'inc' ? item.qty + item.step : Math.max(item.step, item.qty - item.step)
        return {
          ...item,
          qty: Number(nextQty.toFixed(2)),
        }
      }),
    )
  }

  const handleAddCustomer = () => {
    setOpenModal('customer')
  }

  const handleAddDiscount = () => {
    setOpenModal('offer')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)]">
      <header className="space-y-3 bg-[#f6f4ec] px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="group relative flex-1" id="search-container">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717971]">search</Icon>
            <input
              className="w-full rounded-full border-none bg-[#e4e3db] py-2 pl-10 pr-10 text-sm text-[#1b1c17] outline-none transition focus:ring-2 focus:ring-[#356647]"
              placeholder="Tìm sản phẩm (Barcode support)..."
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />

            <div className="absolute left-0 right-0 top-full z-[60] mt-2 hidden max-h-[60vh] overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl group-focus-within:block custom-scrollbar">
              {searchResults.map((section, sectionIndex) => (
                <div key={section.group} className="p-2">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#717971]">{section.group}</div>
                  <div className="space-y-1">
                    {section.items
                      .filter((item) => {
                        const query = searchValue.trim().toLowerCase()
                        if (!query) {
                          return true
                        }

                        return item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
                      })
                      .map((item) => (
                        <button
                          key={item.sku}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                            item.featured ? 'border border-[#356647]/20 bg-[#4e7f5e]/10' : 'hover:bg-[#f6f4ec]'
                          }`}
                        >
                          {item.image ? (
                            <img className="h-12 w-12 rounded-md object-cover" src={item.image} alt={item.name} />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#ceebc1]">
                              <Icon className="text-[#4a6242]">eco</Icon>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[#1b1c17]">{item.name}</div>
                            <div className="text-[11px] text-[#717971]">
                              SKU: {item.sku} • {item.stock}
                            </div>
                          </div>
                          <div className="text-right font-bold text-[#356647]">{formatMoney(item.price)}</div>
                        </button>
                      ))}
                  </div>
                  {sectionIndex < searchResults.length - 1 ? <div className="mx-2 mt-2 h-px bg-[#c1c9c0]" /> : null}
                </div>
              ))}
            </div>

            <Icon className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#717971] hover:text-[#356647]">barcode_scanner</Icon>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setActiveTabId(tab.id)
                }
              }}
              className={`flex items-center rounded-t-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTabId === tab.id ? 'bg-[#356647] text-white shadow-sm' : 'bg-[#eae8e0] text-[#414942] hover:bg-[#e4e3db]'
              }`}
            >
              <span>{tab.label}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
                className="ml-2 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Đóng ${tab.label}`}
              >
                <Icon className="text-[16px] opacity-80">close</Icon>
              </button>
            </div>
          ))}

          <button type="button" onClick={addTab} className="rounded-lg px-3 py-1.5 text-[#356647] transition-colors hover:bg-[#356647]/10">
            <Icon>add</Icon>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col border-r border-[#c1c9c0]">
          <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
            <div className="flex h-full flex-col items-center justify-center p-8 text-center opacity-40">
              <Icon className="mb-4 text-[80px] text-[#717971]">search_check</Icon>
              <p className="font-display-md text-[#414942]">{activeTab.label} - nhập tên hoặc mã để tìm kiếm sản phẩm &amp; nguyên liệu</p>
              <p className="mt-2 text-sm text-[#717971]">Sử dụng máy quét barcode hoặc nhập từ bàn phím</p>
            </div>
          </div>

          {/* <footer className="flex items-center gap-2 overflow-x-auto border-t border-[#c1c9c0] bg-[#f0eee6] p-4 no-scrollbar">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all ${
                  activeCategory === category
                    ? 'bg-[#356647] text-white shadow-sm'
                    : 'bg-[#e4e3db] text-[#414942] hover:bg-[#627b59] hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </footer> */}
        </section>

        <section className="z-10 flex w-[380px] flex-col bg-[#fbf9f1] shadow-[-4px_0_20px_rgba(0,0,0,0.02)]">
          <div className="border-b border-[#c1c9c0] p-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#c1c9c0]/50 bg-[#f6f4ec] px-3 py-2 transition-all focus-within:border-[#356647]">
              <Icon className="text-[#717971]">person_add</Icon>
              <input className="w-full border-none bg-transparent text-sm outline-none focus:ring-0" placeholder="Tìm hoặc thêm khách hàng" type="text" value={selectedCustomer} readOnly />
              <button
                type="button"
                onClick={handleAddCustomer}
                className="rounded-full bg-[#356647] px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-[#4e7f5e]"
              >
                Thêm khách hàng
              </button>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
            {cartItems.map((item) => (
              <div key={item.name} className="group flex gap-3 rounded-lg bg-[#f6f4ec] p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#1b1c17]">{item.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex items-center overflow-hidden rounded-md border border-[#c1c9c0]">
                      <button type="button" onClick={() => updateQuantity(item.name, 'dec')} className="px-2 py-0.5 font-bold text-[#356647] transition-colors hover:bg-[#e4e3db]">
                        -
                      </button>
                      <input
                        type="text"
                        value={item.qty}
                        readOnly
                        className={`${String(item.qty).length > 2 ? 'w-12' : 'w-10'} border-none bg-transparent p-0 text-center text-sm outline-none focus:ring-0`}
                      />
                      <button type="button" onClick={() => updateQuantity(item.name, 'inc')} className="px-2 py-0.5 font-bold text-[#356647] transition-colors hover:bg-[#e4e3db]">
                        +
                      </button>
                    </div>
                    <div className="text-[11px] text-[#717971]">
                      {item.unit} {formatMoney(item.price)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-bold text-[#1b1c17]">{formatMoney(item.qty * item.price)}</div>
                  <Icon className="cursor-pointer text-[18px] text-[#ba1a1a] opacity-0 transition-opacity group-hover:opacity-100">delete</Icon>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-t border-[#c1c9c0] bg-[#f6f4ec] p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-[#414942]">
                <span>Tổng tiền hàng</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-[#414942]">
                <span>Giảm giá</span>
                <button type="button" onClick={handleAddDiscount} className="flex items-center border-b border-[#717971] font-bold text-[#356647] transition-colors hover:border-[#356647]">
                  Thêm chiết khấu
                </button>
              </div>
              <div className="flex justify-between text-sm text-[#414942]">
                <span>Tiền giảm</span>
                <span>-{formatMoney(discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#c1c9c0]/50 pt-2">
                <span className="font-bold text-[#1b1c17]">Khách cần trả</span>
                <span className="text-2xl font-display-md text-[#356647]">{formatMoney(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" className="flex flex-col items-center justify-center rounded-xl bg-[#ffdead] py-3 font-body-md font-bold text-[#604100] shadow-sm transition-all hover:brightness-95 active:scale-95">
                <span className="text-[10px] opacity-70">F10</span>
                <span>Lưu tạm</span>
              </button>
              <button type="button" className="flex flex-col items-center justify-center rounded-xl bg-[#356647] py-3 font-body-md font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95">
                <span className="text-[10px] opacity-70">F12</span>
                <span>Thanh toán</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <AddCustomerModal
        isOpen={openModal === 'customer'}
        onClose={() => {
          setOpenModal(null)
          setSelectedCustomer('Tìm hoặc thêm khách hàng')
        }}
      />
      <OrderOfferModal
        isOpen={openModal === 'offer'}
        onClose={() => {
          setOpenModal(null)
          setDiscountPercent(0)
        }}
      />
    </div>
  )
}

export default PosPage
