import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../../../lib/apiClient.js'

function fmt(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

async function fetchMaterials() {
  const query = new URLSearchParams({ pageSize: '100', page: '1', isActive: 'true', productType: 'NGUYEN_LIEU' })
  const data = await apiRequest(`/api/v1/products?${query.toString()}`, { method: 'GET' })
  const products = Array.isArray(data) ? data : (data?.items ?? data?.Items ?? [])

  const result = []
  for (const product of products) {
    const variants = product.variants ?? product.Variants ?? []
    if (variants.length === 0) {
      result.push({
        skuId: product.id ?? product.Id,
        skuCode: '',
        name: product.name ?? product.Name ?? '',
        unitPrice: 0,
        packagingType: '',
        description: '',
        imageUrl: null,
      })
    } else {
      for (const v of variants) {
        const images = product.images ?? product.Images ?? []
        result.push({
          skuId: v.id ?? v.Id,
          skuCode: v.skuCode ?? v.SkuCode ?? '',
          name: product.name ?? product.Name ?? '',
          unitPrice: Number(v.retailPrice ?? v.RetailPrice ?? 0),
          packagingType: v.variantName ?? v.VariantName ?? '',
          description: '',
          imageUrl: v.imageUrl ?? v.ImageUrl ?? images[0]?.url ?? images[0]?.Url ?? null,
        })
      }
    }
  }
  return result
}

function MaterialCard({ material }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="flex flex-col rounded-2xl border border-[#c1c9c0] bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* ảnh hoặc placeholder */}
      <div className="h-48 bg-[#f6f4ec] flex items-center justify-center overflow-hidden">
        {material.imageUrl && !imgError ? (
          <img
            src={material.imageUrl}
            alt={material.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="material-symbols-outlined text-[72px] text-[#c1c9c0]">
            eco
          </span>
        )}
      </div>

      {/* nội dung */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-base font-bold text-[#1b1c17] leading-snug">{material.name}</p>
        {material.packagingType ? (
          <p className="text-xs text-[#717971]">{material.packagingType}</p>
        ) : null}
        {material.description ? (
          <p className="mt-1 text-xs text-[#717971] line-clamp-2">{material.description}</p>
        ) : null}
        <div className="mt-auto pt-3">
          <span className="text-lg font-extrabold text-[#356647]">{fmt(material.unitPrice)}</span>
          <span className="ml-1 text-xs text-[#717971]">/ đơn vị</span>
        </div>
      </div>
    </div>
  )
}

export default function CustomerDisplayPage() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(new Date())

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const items = await fetchMaterials()
      setMaterials(items)
    } catch (e) {
      setError(e.message || 'Không thể tải danh sách nguyên liệu.')
    } finally {
      setLoading(false)
    }
  }, [])

  // tải lần đầu + auto-refresh mỗi 5 phút
  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  // đồng hồ
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const filtered = materials.filter((m) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return m.name.toLowerCase().includes(q) || m.skuCode.toLowerCase().includes(q)
  })

  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#f6f4ec] flex flex-col">

      {/* Header */}
      <header className="bg-[#1b1c17] text-white px-8 py-5 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-[#a8c5a0] text-4xl">eco</span>
          <div>
            <p className="text-xl font-extrabold tracking-wide">Hương Vân Trà</p>
            <p className="text-xs text-[#a8c5a0] tracking-wider uppercase">Nguyên liệu pha trà</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{timeStr}</p>
          <p className="text-xs text-[#a8c5a0] capitalize">{dateStr}</p>
        </div>
      </header>

      {/* Tagline + search */}
      <div className="bg-[#356647] px-8 py-6 text-white text-center shrink-0">
        <p className="text-2xl font-bold mb-1">Tự chọn nguyên liệu theo sở thích của bạn</p>
        <p className="text-sm text-[#a8c5a0] mb-4">Chọn loại và số lượng — nhân viên sẽ hỗ trợ bạn tạo gói trà cá nhân hoá</p>
        <div className="mx-auto max-w-md relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#717971]">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nguyên liệu..."
            className="w-full rounded-full bg-white pl-10 pr-4 py-2.5 text-sm text-[#1b1c17] placeholder-[#717971] outline-none focus:ring-2 focus:ring-[#a8c5a0]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717971] hover:text-[#1b1c17]"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#717971]">
            <span className="material-symbols-outlined text-5xl animate-spin" style={{ animationDuration: '1.5s' }}>autorenew</span>
            <p className="text-base">Đang tải danh sách nguyên liệu...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#717971]">
            <span className="material-symbols-outlined text-5xl text-red-400">error</span>
            <p className="text-base">{error}</p>
            <button
              onClick={load}
              className="mt-2 rounded-lg bg-[#356647] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a5038]"
            >
              Thử lại
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#717971]">
            <span className="material-symbols-outlined text-5xl">sentiment_dissatisfied</span>
            <p className="text-base">
              {search ? `Không tìm thấy nguyên liệu "${search}"` : 'Chưa có nguyên liệu nào.'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="text-sm text-[#356647] underline">
                Xoá tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-[#717971]">
              Hiển thị <span className="font-semibold text-[#1b1c17]">{filtered.length}</span> nguyên liệu
              {search ? ` cho "${search}"` : ''}
            </p>
            <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((m) => (
                <MaterialCard key={m.skuId} material={m} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1b1c17] text-[#717971] text-center py-4 text-xs shrink-0">
        Vui lòng nhờ nhân viên hỗ trợ để tạo gói trà theo yêu cầu của bạn
      </footer>
    </div>
  )
}
