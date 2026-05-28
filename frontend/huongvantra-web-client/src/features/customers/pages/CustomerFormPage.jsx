import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppTopHeader from '../../../components/shared/AppTopHeader.jsx'

const customerTemplates = {
  'C-CORP-001': {
    type: 'corporate',
    name: 'VinGroup JSC',
    representative: 'Pham Nhat V.',
    phone: '090 876 5432',
    email: 'vincorp@vin.com.vn',
    address: '72 Le Thanh Ton, District 1, Ho Chi Minh City',
    taxId: '0101234567',
    debt: '125000000',
    tier: 'Gold',
    points: '12000',
    status: 'active',
  },
  'C-VIP-001': {
    type: 'vip',
    name: 'Pham Thanh Tam',
    representative: '',
    phone: '090 123 4567',
    email: 'tam.pham@gmail.com',
    address: 'Thu Duc City, Ho Chi Minh City',
    taxId: '',
    debt: '0',
    tier: 'Gold',
    points: '12450',
    status: 'active',
  },
}

function CustomerFormPage() {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(customerId)

  const [form, setForm] = useState({
    type: searchParams.get('type') === 'vip' ? 'vip' : 'corporate',
    name: '',
    representative: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    debt: '0',
    tier: 'Silver',
    points: '0',
    status: 'active',
  })

  useEffect(() => {
    if (!isEditMode) {
      return
    }
    const template = customerTemplates[customerId]
    if (template) {
      setForm(template)
    }
  }, [customerId, isEditMode])

  const formTitle = useMemo(() => (isEditMode ? `Edit Customer ${customerId}` : 'Add New Customer'), [isEditMode, customerId])

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = () => {
    navigate('/customers')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <AppTopHeader
        searchPlaceholder={formTitle}
        rightContent={
          <div className="flex items-center gap-2 rounded-full bg-[#f6f4ec] px-3 py-1.5">
            <span className="text-xs text-[#717971]">Customer Type</span>
            <div className="inline-flex gap-1 rounded-full bg-white p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'vip' ? 'bg-[#4a6242] text-white' : 'text-[#414942]'}`}
                onClick={() => setForm((current) => ({ ...current, type: 'vip' }))}
              >
                VIP
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'corporate' ? 'bg-[#7e5700] text-white' : 'text-[#414942]'}`}
                onClick={() => setForm((current) => ({ ...current, type: 'corporate' }))}
              >
                Corporate
              </button>
            </div>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <form className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm" onSubmit={(event) => event.preventDefault()}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">{form.type === 'corporate' ? 'Company Name' : 'Customer Name'}</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                placeholder={form.type === 'corporate' ? 'Enter company name' : 'Enter customer full name'}
                type="text"
                value={form.name}
                onChange={updateField('name')}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Representative</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                placeholder="Enter representative/contact person"
                type="text"
                value={form.representative}
                onChange={updateField('representative')}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Phone</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                placeholder="Phone number"
                type="text"
                value={form.phone}
                onChange={updateField('phone')}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Email</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                placeholder="Email address"
                type="email"
                value={form.email}
                onChange={updateField('email')}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold text-[#717971]">Address</span>
              <input
                className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                placeholder="Address"
                type="text"
                value={form.address}
                onChange={updateField('address')}
              />
            </label>

            {form.type === 'corporate' ? (
              <>
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-[#717971]">Tax ID</span>
                  <input
                    className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    placeholder="Tax code"
                    type="text"
                    value={form.taxId}
                    onChange={updateField('taxId')}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold text-[#717971]">Current Debt (VND)</span>
                  <input
                    className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    min="0"
                    type="number"
                    value={form.debt}
                    onChange={updateField('debt')}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-[#717971]">VIP Tier</span>
                  <select className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20" value={form.tier} onChange={updateField('tier')}>
                    <option>Silver</option>
                    <option>Gold</option>
                    <option>Platinum</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold text-[#717971]">Loyalty Points</span>
                  <input
                    className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    min="0"
                    type="number"
                    value={form.points}
                    onChange={updateField('points')}
                  />
                </label>
              </>
            )}

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold text-[#717971]">Status</span>
              <select className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20" value={form.status} onChange={updateField('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#c1c9c0]/40 pt-5">
            <Link to="/customers" className="rounded-xl border border-[#356647] px-5 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5">
              Cancel
            </Link>
            <button
              type="button"
              className="rounded-xl bg-[#4a6242] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={handleSubmit}
            >
              {isEditMode ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>

        <aside className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#356647]">Preview</h3>

          <div className="rounded-xl bg-[#f6f4ec] p-4">
            <p className="text-xs text-[#717971]">Name</p>
            <p className="text-sm font-bold text-[#1b1c17]">{form.name || '-'}</p>
          </div>

          <div className="rounded-xl bg-[#f6f4ec] p-4">
            <p className="text-xs text-[#717971]">Type</p>
            <p className="text-sm font-bold text-[#1b1c17]">{form.type === 'corporate' ? 'Corporate Customer' : 'VIP Customer'}</p>
          </div>

          <div className="rounded-xl bg-[#f6f4ec] p-4">
            <p className="text-xs text-[#717971]">Contact</p>
            <p className="text-sm font-bold text-[#1b1c17]">{form.phone || '-'}</p>
            <p className="text-xs text-[#414942]">{form.email || '-'}</p>
          </div>

          <div className="rounded-xl bg-[#ceebc1] p-4 text-[#0a2007]">
            <p className="text-xs font-semibold">Quick Note</p>
            <p className="mt-1 text-sm">{form.type === 'corporate' ? 'Remember to verify Tax ID before approval.' : 'Keep tier and points aligned with loyalty policy.'}</p>
          </div>
        </aside>
      </section>
    </div>
  )
}

export default CustomerFormPage