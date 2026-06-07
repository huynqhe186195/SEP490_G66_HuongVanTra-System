import { useEffect, useState } from 'react'

function ProductImage({ src, alt = 'Ảnh sản phẩm', className = '', iconClassName = 'text-[28px]' }) {
  const [failed, setFailed] = useState(false)
  const url = String(src || '').trim()

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}
        title={alt}
        aria-label={alt}
      >
        <span className={`material-symbols-outlined ${iconClassName}`}>image</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className={`bg-slate-100 object-cover ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

export function ProductImagePreview({ src, alt = 'Ảnh sản phẩm', className = 'h-24 w-24 rounded-xl' }) {
  const url = String(src || '').trim()
  if (!url || !/^https?:\/\//i.test(url)) return null

  return (
    <div className="flex items-start gap-3 pt-1">
      <a href={url} target="_blank" rel="noopener noreferrer" title="Mở ảnh trong tab mới" className="shrink-0">
        <ProductImage src={url} alt={alt} className={className} iconClassName="text-[32px]" />
      </a>
      <p className="text-xs leading-relaxed text-slate-500">
        Xem trước ảnh SKU. Nếu không hiển thị, kiểm tra URL hoặc quyền truy cập của host ảnh.
      </p>
    </div>
  )
}

export default ProductImage
