import { useEffect, useMemo, useState } from 'react'

import { Link, useNavigate, useParams } from 'react-router-dom'

import PageShell from '../../../components/shared/PageShell.jsx'

import { showError, showSuccess } from '../../../app/toast.js'

import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'

import { canAdjustStoreStock, canCreateCatalog } from '../../auth/utils/permissions.js'

import ProductSkusPanel from '../components/ProductSkusPanel.jsx'

import { fetchCategories } from '../services/categoriesApi.js'

import { createProduct, fetchProductById, updateProduct } from '../services/productsApi.js'

import { mapProductApiError, validateProductForm } from '../utils/productValidation.js'



function FieldError({ message }) {

  if (!message) return null

  return <p className="text-xs text-[#b42318]">{message}</p>

}



function ProductFormPage({ mode }) {

  const navigate = useNavigate()

  const { id } = useParams()

  const isEditMode = mode === 'edit' || Boolean(id)

  const [session, setSession] = useState(() => loadAuthSession())

  const canEdit = canCreateCatalog(session)

  const canAdjustStock = canAdjustStoreStock(session)



  useEffect(() => {

    const sync = () => setSession(loadAuthSession())

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)

    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)

  }, [])



  const [categories, setCategories] = useState([])

  const [isLoading, setIsLoading] = useState(isEditMode)

  const [isSaving, setIsSaving] = useState(false)

  const [fieldErrors, setFieldErrors] = useState({})

  const [form, setForm] = useState({

    categoryId: '',

    name: '',

    origin: '',

    flavorProfile: '',

    brewingGuide: '',

    description: '',

  })



  useEffect(() => {

    let mounted = true



    async function loadCategories() {

      try {

        const items = await fetchCategories()

        if (mounted) setCategories(items)

      } catch (error) {

        if (mounted) showError(error.message)

      }

    }



    loadCategories()

    return () => {

      mounted = false

    }

  }, [])



  useEffect(() => {

    if (!canEdit) {

      navigate('/products', { replace: true })

    }

  }, [canEdit, navigate])



  useEffect(() => {

    if (!isEditMode || !id) return undefined



    let mounted = true



    async function loadProduct() {

      try {

        setIsLoading(true)

        const product = await fetchProductById(id)

        if (!mounted) return

        setForm({

          categoryId: product.categoryId ? String(product.categoryId) : '',

          name: product.name || '',

          origin: product.origin || '',

          flavorProfile: product.flavorProfile || '',

          brewingGuide: product.brewingGuide || '',

          description: product.description || '',

        })

      } catch (error) {

        if (mounted) showError(error.message)

      } finally {

        if (mounted) setIsLoading(false)

      }

    }



    loadProduct()

    return () => {

      mounted = false

    }

  }, [id, isEditMode])



  function updateField(key) {

    return (event) => {

      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value

      setForm((prev) => ({ ...prev, [key]: value }))

      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))

    }

  }



  async function handleSubmit(event) {

    event.preventDefault()

    if (!canEdit) {

      showError('Chỉ Thủ kho được tạo và sửa sản phẩm.')

      return

    }



    const validation = validateProductForm(form)

    if (!validation.valid) {

      setFieldErrors(validation.errors)

      showError(validation.message)

      return

    }



    const payload = {

      categoryId: Number(form.categoryId),

      name: form.name,

      origin: form.origin,

      flavorProfile: form.flavorProfile,

      brewingGuide: form.brewingGuide,

      description: form.description,

    }



    try {

      setIsSaving(true)

      if (isEditMode && id) {

        await updateProduct(id, payload)

        showSuccess('Đã cập nhật sản phẩm.')

      } else {

        const created = await createProduct(payload)

        showSuccess('Đã tạo sản phẩm. Bạn có thể thêm SKU ngay bây giờ.')

        navigate(`/products/${created.id}/edit`, { replace: true })

      }

    } catch (error) {

      const mapped = mapProductApiError(error.message, error.apiErrors)

      if (Object.keys(mapped.errors).length) setFieldErrors((prev) => ({ ...prev, ...mapped.errors }))

      else if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))

      showError(mapped.message)

    } finally {

      setIsSaving(false)

    }

  }



  const selectableCategories = useMemo(

    () =>

      categories.filter(

        (category) =>

          (!category.isDeleted && category.isActive !== false) ||

          String(category.id) === String(form.categoryId),

      ),

    [categories, form.categoryId],

  )



  if (isLoading) {

    return (

      <PageShell>

        <p className="text-sm text-slate-500">Đang tải sản phẩm...</p>

      </PageShell>

    )

  }



  const isSideBySideLayout = isEditMode && Boolean(id)

  const productFieldGridClass = isSideBySideLayout ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'

  const productFieldSpanClass = isSideBySideLayout ? '' : 'md:col-span-2'



  const productFields = (

    <div className={`grid gap-6 ${productFieldGridClass}`}>

      <label className={`space-y-2 ${productFieldSpanClass}`}>

        <span className="text-xs font-semibold text-[#717971]">Tên sản phẩm *</span>

        <input

          className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.name ? 'ring-2 ring-[#b42318]/40' : ''}`}

          value={form.name}

          onChange={updateField('name')}

        />

        <FieldError message={fieldErrors.name} />

      </label>



      <label className="space-y-2">

        <span className="text-xs font-semibold text-[#717971]">Danh mục *</span>

        <select

          className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.categoryId ? 'ring-2 ring-[#b42318]/40' : ''}`}

          value={form.categoryId}

          onChange={updateField('categoryId')}

        >

          <option value="">Chọn danh mục</option>

          {selectableCategories.map((category) => (

            <option key={category.id} value={category.id}>

              {category.isActive === false || category.isDeleted

                ? `${category.name} (đã ẩn)`

                : category.name}

            </option>

          ))}

        </select>

        <FieldError message={fieldErrors.categoryId} />

      </label>



      <label className="space-y-2">

        <span className="text-xs font-semibold text-[#717971]">Xuất xứ</span>

        <input className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20" value={form.origin} onChange={updateField('origin')} />

        <FieldError message={fieldErrors.origin} />

      </label>



      <label className={`space-y-2 ${productFieldSpanClass}`}>

        <span className="text-xs font-semibold text-[#717971]">Hương vị</span>

        <input className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20" value={form.flavorProfile} onChange={updateField('flavorProfile')} />

        <FieldError message={fieldErrors.flavorProfile} />

      </label>



      <label className={`space-y-2 ${productFieldSpanClass}`}>

        <span className="text-xs font-semibold text-[#717971]">Hướng dẫn pha chế</span>

        <textarea className="min-h-[96px] w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20" value={form.brewingGuide} onChange={updateField('brewingGuide')} />

        <FieldError message={fieldErrors.brewingGuide} />

      </label>



      <label className={`space-y-2 ${productFieldSpanClass}`}>

        <span className="text-xs font-semibold text-[#717971]">Mô tả</span>

        <textarea className="min-h-[96px] w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20" value={form.description} onChange={updateField('description')} />

        <FieldError message={fieldErrors.description} />

      </label>

    </div>

  )



  return (

    <PageShell>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">

        <div>

          <h1 className="text-2xl font-extrabold text-slate-800">

            {isEditMode ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}

          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isEditMode
              ? 'Sửa thông tin sản phẩm và thêm/chỉnh SKU — lưu SP trước, sau đó thêm SKU bên phải'
              : 'Tạo sản phẩm trước, sau đó thêm SKU ở màn sửa'}
          </p>

        </div>



        <div className="flex items-center gap-3">

          <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" to="/products">

            Quay lại

          </Link>

          {canEdit ? (

            <button

              type="button"

              disabled={isSaving}

              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50"

              onClick={handleSubmit}

            >

              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu'}

            </button>

          ) : null}

        </div>

      </div>



      {isEditMode && id ? (

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">

          <form onSubmit={handleSubmit}>

            <div className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">

              <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin sản phẩm</h2>

              {productFields}

            </div>

          </form>



          <ProductSkusPanel
            productId={id}
            canManage={canEdit}
            canAdjustStock={canAdjustStock}
            warehouseStockView={canEdit}
            layout="column"
          />

        </div>

      ) : (

        <form className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8" onSubmit={handleSubmit}>

          <section className="space-y-6 lg:col-span-8">

            <div className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">

              <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin sản phẩm</h2>

              {productFields}

            </div>

          </section>



          <section className="lg:col-span-4">

            <div className="rounded-[1rem] bg-white p-6 shadow-sm">

              <h3 className="text-sm font-bold uppercase tracking-wide text-[#717971]">Ghi chú</h3>

              <ul className="mt-3 space-y-2 text-sm text-slate-600">

                <li>SKU được quản lý riêng với mã unique, tự uppercase khi lưu.</li>

                <li>Giá: 1 – 1.000.000.000 VND, tối đa 2 chữ số thập phân.</li>

                <li>Khối lượng: 1 – 100.000 gram.</li>

                <li>URL ảnh phải bắt đầu bằng http:// hoặc https://</li>

              </ul>

            </div>

          </section>

        </form>

      )}

    </PageShell>

  )

}



export default ProductFormPage

