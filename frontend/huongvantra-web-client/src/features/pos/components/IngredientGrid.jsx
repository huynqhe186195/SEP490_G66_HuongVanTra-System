function IngredientGrid({ title, colors }) {
  return (
    <div className="pb-2">
      <h3 className="mb-4 text-lg font-bold sm:text-xl">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5 lg:gap-6">
        {colors.map((color, index) => (
          <div key={`${color}-${index}`} className="rounded-[20px] bg-white p-4 shadow-sm">
            <div className={`mb-3 aspect-[16/11] w-full rounded-xl ${color}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default IngredientGrid