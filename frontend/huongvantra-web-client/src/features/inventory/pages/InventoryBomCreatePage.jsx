import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppTopHeader from '../../../components/shared/AppTopHeader.jsx'

const ingredientOptions = [
  { name: 'Premium Matcha Powder (JP)', unitCost: 280 },
  { name: 'Fresh Whole Milk', unitCost: 36 },
  { name: 'Lotus Syrup', unitCost: 120 },
  { name: 'Sugar Pearls', unitCost: 60 },
]

const bomTemplates = {
  'BOM-001': {
    productName: 'Huong Van Special Jasmine',
    bomVersion: 'v3.1 (Autumn 2024)',
    ingredients: [
      { ingredient: 'Premium Matcha Powder (JP)', qty: 12, unit: 'g' },
      { ingredient: 'Lotus Syrup', qty: 25, unit: 'ml' },
      { ingredient: 'Fresh Whole Milk', qty: 170, unit: 'ml' },
    ],
    steps: [
      'Whisk jasmine tea extract with matcha base until fully dissolved.',
      'Add lotus syrup and milk, then shake with ice for 12 seconds.',
      'Pour into branded glass and top with foam layer.',
    ],
  },
  'BOM-042': {
    productName: 'Oolong Milk Tea Premium',
    bomVersion: 'v2.9 (Winter 2024)',
    ingredients: [
      { ingredient: 'Fresh Whole Milk', qty: 160, unit: 'ml' },
      { ingredient: 'Sugar Pearls', qty: 30, unit: 'g' },
      { ingredient: 'Lotus Syrup', qty: 20, unit: 'ml' },
    ],
    steps: [
      'Brew oolong concentrate at 90C for 5 minutes.',
      'Mix concentrate with milk and syrup until balanced.',
      'Serve with sugar pearls and chilled ice cubes.',
    ],
  },
}

const emptyIngredient = () => ({ ingredient: ingredientOptions[0].name, qty: 15, unit: 'g' })

function formatVnd(value) {
  return `${value.toLocaleString('en-US')} VND`
}

function InventoryBomCreatePage() {
  const navigate = useNavigate()
  const { bomId } = useParams()
  const isEditMode = Boolean(bomId)
  const [productName, setProductName] = useState('Sen Tuyet Matcha Latte')
  const [bomVersion, setBomVersion] = useState('v2.4 (Summer 2024)')
  const [ingredients, setIngredients] = useState([
    { ingredient: 'Premium Matcha Powder (JP)', qty: 15, unit: 'g' },
    { ingredient: 'Fresh Whole Milk', qty: 180, unit: 'ml' },
  ])
  const [steps, setSteps] = useState([
    'Whisk 15g of Matcha powder with 30ml of hot water (80C) until smooth and frothy.',
    'Pour Lotus syrup into the serving glass, add ice, and then gently pour the prepared milk.',
  ])

  useEffect(() => {
    if (!isEditMode) {
      return
    }

    const template = bomTemplates[bomId]
    if (!template) {
      return
    }

    setProductName(template.productName)
    setBomVersion(template.bomVersion)
    setIngredients(template.ingredients)
    setSteps(template.steps)
  }, [bomId, isEditMode])

  const ingredientRows = useMemo(
    () =>
      ingredients.map((row) => {
        const selected = ingredientOptions.find((option) => option.name === row.ingredient) || ingredientOptions[0]
        const cost = selected.unitCost * Number(row.qty || 0)
        return { ...row, cost }
      }),
    [ingredients],
  )

  const totalCost = useMemo(() => ingredientRows.reduce((sum, row) => sum + row.cost, 0), [ingredientRows])
  const estimatedMargin = useMemo(() => {
    const srp = 45000
    if (!totalCost) {
      return 0
    }
    return Math.max(0, Math.round(((srp - totalCost) / srp) * 1000) / 10)
  }, [totalCost])

  const updateIngredient = (index, field, value) => {
    setIngredients((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const removeIngredient = (index) => {
    setIngredients((current) => current.filter((_, i) => i !== index))
  }

  const addIngredient = () => {
    setIngredients((current) => [...current, emptyIngredient()])
  }

  const updateStep = (index, value) => {
    setSteps((current) => current.map((step, i) => (i === index ? value : step)))
  }

  const addStep = () => {
    setSteps((current) => [...current, ''])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <AppTopHeader searchPlaceholder={isEditMode ? `Edit BOM ${bomId}` : 'Recipe Definition (BOM)'} />

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="custom-scrollbar space-y-4 overflow-y-auto pb-20">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#627b59] text-[#f8ffef]">
                <span className="material-symbols-outlined">liquor</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#1b1c17]">Target Product</h3>
                <p className="text-sm text-[#414942]">Select the final beverage to define its recipe</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="ml-1 text-xs font-semibold text-[#717971]">Product Name</span>
                <select
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-4 text-base font-bold focus:ring-2 focus:ring-[#356647]/20"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                >
                  <option>Sen Tuyet Matcha Latte</option>
                  <option>Oolong Milk Tea Premium</option>
                  <option>Huong Van Special Jasmine</option>
                  <option>Black Tea Caramel Cloud</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="ml-1 text-xs font-semibold text-[#717971]">BOM Version</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-4 text-base focus:ring-2 focus:ring-[#356647]/20"
                  value={bomVersion}
                  onChange={(event) => setBomVersion(event.target.value)}
                  type="text"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fec25b] text-[#744f00]">
                  <span className="material-symbols-outlined">cooking</span>
                </div>
                <h3 className="text-xl font-semibold text-[#1b1c17]">Ingredients List</h3>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-[#4e7f5e] px-4 py-2 font-bold text-[#f6fff5] transition-all hover:shadow-md active:scale-95"
                onClick={addIngredient}
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span className="text-xs">Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {ingredientRows.map((row, index) => (
                <div key={`${row.ingredient}-${index}`} className="group flex items-center gap-4 rounded-xl border border-transparent bg-[#f6f4ec] p-4 transition-all hover:border-[#c1c9c0]">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-semibold text-[#717971]">Ingredient</label>
                    <select
                      className="w-full rounded-lg border-none bg-[#eae8e0]/70 p-2 text-sm font-bold focus:ring-1 focus:ring-[#356647]"
                      value={row.ingredient}
                      onChange={(event) => updateIngredient(index, 'ingredient', event.target.value)}
                    >
                      {ingredientOptions.map((option) => (
                        <option key={option.name}>{option.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="mb-1 block text-xs font-semibold text-[#717971]">Qty</label>
                    <input
                      className="w-full rounded-lg border-none bg-[#eae8e0]/70 p-2 text-center text-sm focus:ring-1 focus:ring-[#356647]"
                      min="0"
                      type="number"
                      value={row.qty}
                      onChange={(event) => updateIngredient(index, 'qty', Number(event.target.value || 0))}
                    />
                  </div>

                  <div className="w-20">
                    <label className="mb-1 block text-xs font-semibold text-[#717971]">Unit</label>
                    <select
                      className="w-full rounded-lg border-none bg-[#eae8e0]/70 p-2 text-center text-sm focus:ring-1 focus:ring-[#356647]"
                      value={row.unit}
                      onChange={(event) => updateIngredient(index, 'unit', event.target.value)}
                    >
                      <option>g</option>
                      <option>ml</option>
                      <option>pcs</option>
                    </select>
                  </div>

                  <div className="w-32 text-right">
                    <label className="mb-1 block text-xs font-semibold text-[#717971]">Est. Cost</label>
                    <p className="py-2 text-sm font-bold">{formatVnd(row.cost)}</p>
                  </div>

                  <button
                    type="button"
                    className="rounded-lg p-2 text-[#ba1a1a] opacity-0 transition-all hover:bg-[#ffdad6] group-hover:opacity-100"
                    onClick={() => removeIngredient(index)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-end justify-between border-t border-[#c1c9c0] pt-6">
              <div>
                <p className="text-xs font-semibold text-[#717971]">Total Ingredients Cost</p>
                <p className="mt-1 text-2xl font-bold text-[#356647]">
                  {formatVnd(totalCost)} <span className="text-sm font-medium text-[#414942]">/ unit</span>
                </p>
              </div>

              <div className="rounded-full bg-[#eae8e0] px-3 py-1 text-xs font-bold text-[#414942]">
                Recommended SRP: 45,000 VND
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ceebc1] text-[#0a2007]">
                <span className="material-symbols-outlined">format_list_numbered</span>
              </div>
              <h3 className="text-xl font-semibold text-[#1b1c17]">Instruction Steps</h3>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={`step-${index}`} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c1c9c0] font-bold text-[#1b1c17]">{index + 1}</div>
                  <textarea
                    className="w-full rounded-xl border-none bg-[#f0eee6] p-4 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    placeholder="Describe this preparation step..."
                    rows={2}
                    value={step}
                    onChange={(event) => updateStep(index, event.target.value)}
                  />
                </div>
              ))}

              <button type="button" className="ml-12 inline-flex items-center gap-2 text-sm font-bold text-[#356647] hover:underline" onClick={addStep}>
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Add New Step
              </button>
            </div>
          </section>
        </div>

        <aside className="flex h-full flex-col gap-4">
          <section className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="group relative h-48 overflow-hidden">
              <img
                alt="Preview"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA44XQbhZPqk8_91Vr2RcliunwIKP8fYl4JoE34RHoEHSsG5pWFyl0fzG_UiBo8svvsBSzy7LUODhX1lMa5qmGosY98oNqU64QE1hGw0CA2eKsZab6QWQTl7-hcExHT9L0EhwYQ_lU06YpQB3o8CpFAUhGtSjjzai9l1lkO2OIB4zZopS8sdiafSCeiOh-jzBgn-V3pWyCMDzxrzkqi_r6pJcEVS-xaeqJxXeK2jEraLUNRnGCRytMpPOLV44IA6JUIbu0fPBnMz483"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h4 className="text-xl font-semibold text-white">Sen Tuyet Matcha</h4>
                <p className="text-xs text-white/80">Premium Signature Series</p>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#414942]">Prep Time</span>
                <span className="font-bold">4.5 min</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#414942]">Nutritional Value</span>
                <span className="font-bold">240 kcal</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#414942]">Complexity</span>
                <div className="flex gap-1 text-[#356647]">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <span className="material-symbols-outlined text-[16px]">star</span>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-auto space-y-3 rounded-xl bg-[#eae8e0] p-5">
            <div className="mb-4 rounded-xl bg-[#ceebc1] p-4">
              <div className="mb-1 flex items-center justify-between text-[#0a2007]">
                <span className="text-xs font-semibold">Profit Margin Est.</span>
                <span className="font-bold">{estimatedMargin}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#0a2007]/20">
                <div className="h-full bg-[#356647]" style={{ width: `${Math.min(100, estimatedMargin)}%` }} />
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#356647] px-6 py-4 font-bold text-[#356647] transition-colors hover:bg-[#356647]/5"
            >
              <span className="material-symbols-outlined">save</span>
              {isEditMode ? 'Update Draft' : 'Save as Draft'}
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4a6242] px-6 py-4 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95"
            >
              <span className="material-symbols-outlined">check_circle</span>
              {isEditMode ? 'Update BOM' : 'Submit for Approval'}
            </button>

            <p className="px-4 text-center text-[10px] text-[#414942]">
              By submitting, you agree to update global inventory depletion rules for this product across all outlets.
            </p>

            <Link to="/inventory/bom" className="mt-2 block text-center text-xs font-semibold text-[#356647] hover:underline">
              Back to BOM list
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default InventoryBomCreatePage