function ProductGrid({ title, products }) {
  return (
    <div className="mb-8 sm:mb-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h3 className="text-lg font-bold sm:text-xl">{title}</h3>
        <p className="text-xs text-gray-500 sm:text-sm">Chọn sản phẩm để thêm nhanh vào đơn</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 sm:gap-5 lg:gap-6">
        {products.map((product) => (
          <div
            key={product.name}
            className="cursor-pointer rounded-[20px] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`mb-3 aspect-[16/11] w-full rounded-xl ${product.color}`} />
            <p className="text-sm font-bold leading-snug sm:text-base">{product.name}</p>
            <p className="text-sm font-bold text-gray-700 sm:text-base">{product.price}</p>
            {(product.stockCounter || product.stockWarehouse) && (
              <div className="mt-2 space-y-0.5 text-[10px] text-gray-500">
                {product.stockCounter && <p>Có sẵn trên quầy: {product.stockCounter}</p>}
                {product.stockWarehouse && <p>Có sẵn trong kho: {product.stockWarehouse}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProductGrid