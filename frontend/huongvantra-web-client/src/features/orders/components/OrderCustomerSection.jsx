import { useEffect, useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  createCustomerForOrder,
  fetchCustomerAddresses,
  fetchCustomers,
} from '../../customers/services/customersApi.js'
import {
  formatCustomerAddressLine,
  formatCustomerOrderSnapshot,
  getInitials,
} from '../../customers/utils/customerDisplay.js'
import { validateCustomerForm } from '../../customers/utils/customerValidation.js'

const MODES = [
  { key: 'existing', label: 'Khách có sẵn' },
  { key: 'new', label: 'Tạo khách mới' },
  { key: 'guest', label: 'Khách lẻ' },
]

function OrderCustomerSection({
  customerId,
  customerSnapshotName,
  shippingAddress,
  requireShippingAddress = false,
  customerTypeFilter = null,
  onChange,
}) {
  const [mode, setMode] = useState(customerId ? 'existing' : 'existing')
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)
  const [selectedAddressKey, setSelectedAddressKey] = useState('')
  const [useCustomAddress, setUseCustomAddress] = useState(false)

  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    phone: '',
    addressLine: '',
  })
  const [newCustomerErrors, setNewCustomerErrors] = useState({})
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  const showSearchDropdown = mode === 'existing' && !selectedCustomer && searchValue.trim().length >= 2

  useEffect(() => {
    if (mode !== 'existing' || selectedCustomer || searchValue.trim().length < 2) {
      setSearchResults([])
      return undefined
    }

    let mounted = true
    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        const items = await fetchCustomers({ keyword: searchValue.trim(), customerType: customerTypeFilter || undefined })
        if (mounted) setSearchResults(items.slice(0, 12))
      } catch {
        if (mounted) setSearchResults([])
      } finally {
        if (mounted) setIsSearching(false)
      }
    }, 300)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [mode, searchValue, selectedCustomer, customerTypeFilter])

  useEffect(() => {
    if (mode !== 'existing' || !selectedCustomer?.customerId) {
      setAddresses([])
      return undefined
    }

    let mounted = true
    async function loadAddresses() {
      setIsLoadingAddresses(true)
      try {
        const rows = await fetchCustomerAddresses(selectedCustomer.customerId)
        if (!mounted) return
        setAddresses(rows)
        if (rows.length === 0) {
          setUseCustomAddress(true)
          setSelectedAddressKey('custom')
          return
        }
        const preferred = rows.find((row) => row.isDefault) ?? rows[0]
        const formatted = formatCustomerAddressLine(preferred)
        setUseCustomAddress(false)
        setSelectedAddressKey(String(preferred.id))
        onChange({
          customerId: selectedCustomer.customerId,
          selectedCustomer,
          customerSnapshotName:
            formatCustomerOrderSnapshot(selectedCustomer) || selectedCustomer.fullName,
          shippingAddress: formatted,
        })
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoadingAddresses(false)
      }
    }

    loadAddresses()
    return () => {
      mounted = false
    }
  }, [mode, selectedCustomer?.customerId])

  function switchMode(nextMode) {
    setMode(nextMode)
    setSearchValue('')
    setSearchResults([])
    setSelectedCustomer(null)
    setAddresses([])
    setSelectedAddressKey('')
    setUseCustomAddress(false)
    setNewCustomerErrors({})

    if (nextMode === 'guest') {
      onChange({ customerId: null, selectedCustomer: null, customerSnapshotName: '', shippingAddress: '' })
    } else if (nextMode === 'new') {
      onChange({ customerId: null, selectedCustomer: null, customerSnapshotName: '', shippingAddress: '' })
    } else {
      onChange({ customerId: null, selectedCustomer: null, customerSnapshotName: '', shippingAddress: '' })
    }
  }

  function handleSelectCustomer(customer) {
    setSelectedCustomer(customer)
    setSearchValue('')
    setSearchResults([])
    onChange({
      customerId: customer.customerId,
      selectedCustomer: customer,
      customerSnapshotName: formatCustomerOrderSnapshot(customer) || customer.fullName,
      shippingAddress: '',
    })
  }

  function handleClearCustomer() {
    setSelectedCustomer(null)
    setAddresses([])
    setSelectedAddressKey('')
    setUseCustomAddress(false)
    onChange({ customerId: null, selectedCustomer: null, customerSnapshotName: '', shippingAddress: '' })
  }

  function handleAddressPick(addressKey) {
    if (addressKey === 'custom') {
      setUseCustomAddress(true)
      setSelectedAddressKey('custom')
      onChange({ shippingAddress: '' })
      return
    }

    const address = addresses.find((row) => String(row.id) === String(addressKey))
    if (!address) return
    setUseCustomAddress(false)
    setSelectedAddressKey(String(address.id))
    onChange({ shippingAddress: formatCustomerAddressLine(address) })
  }

  async function handleCreateCustomer() {
    const validation = validateCustomerForm({
      name: newCustomerForm.fullName,
      phone: newCustomerForm.phone,
      customerType: 'GENERAL',
    })
    if (!validation.valid) {
      setNewCustomerErrors(validation.errors)
      showError(validation.message)
      return
    }

    try {
      setIsCreatingCustomer(true)
      const created = await createCustomerForOrder({
        fullName: newCustomerForm.fullName.trim(),
        phone: newCustomerForm.phone.trim(),
        address: newCustomerForm.addressLine.trim() || null,
        customerType: 'GENERAL',
      })
      showSuccess('Đã tạo khách hàng mới.')
      setMode('existing')
      setNewCustomerForm({ fullName: '', phone: '', addressLine: '' })
      setNewCustomerErrors({})
      handleSelectCustomer(created)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const addressOptions = useMemo(
    () =>
      addresses.map((address) => ({
        key: String(address.id),
        label: formatCustomerAddressLine(address),
        sub: [address.receiverName, address.receiverPhone].filter(Boolean).join(' · '),
        isDefault: address.isDefault,
      })),
    [addresses],
  )

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">Khách hàng</h2>
        <div className="flex flex-wrap gap-2">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => switchMode(item.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                mode === item.key
                  ? 'bg-[#538463] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-4">
          {!selectedCustomer ? (
            <label className="relative block space-y-1">
              <span className="text-xs font-semibold text-slate-500">Tìm khách theo tên hoặc SĐT</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                placeholder="Gõ ít nhất 2 ký tự..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              {showSearchDropdown ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {isSearching ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Đang tìm...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Không tìm thấy khách phù hợp.</p>
                  ) : (
                    searchResults.map((customer) => (
                      <button
                        key={customer.customerId}
                        type="button"
                        className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-[#fbf9f1]"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {getInitials(customer.fullName)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{customer.fullName}</p>
                          <p className="text-xs text-slate-500">{customer.phone || customer.customerCode}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </label>
          ) : (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#538463]/20 bg-[#538463]/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-[#538463]">
                  {getInitials(selectedCustomer.fullName)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{selectedCustomer.fullName}</p>
                  <p className="text-sm text-slate-500">{selectedCustomer.phone || '—'}</p>
                  {selectedCustomer.customerCode ? (
                    <p className="text-xs text-slate-400">{selectedCustomer.customerCode}</p>
                  ) : null}
                </div>
              </div>
              <button type="button" className="text-sm font-semibold text-[#538463]" onClick={handleClearCustomer}>
                Đổi khách
              </button>
            </div>
          )}

          {selectedCustomer ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Địa chỉ giao hàng {requireShippingAddress ? '*' : ''}
              </p>
              {isLoadingAddresses ? (
                <p className="text-sm text-slate-500">Đang tải địa chỉ...</p>
              ) : null}
              {!isLoadingAddresses && addressOptions.length > 0 ? (
                <div className="space-y-2">
                  {addressOptions.map((option) => (
                    <label
                      key={option.key}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                        selectedAddressKey === option.key && !useCustomAddress
                          ? 'border-[#538463] bg-[#538463]/5'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="order-shipping-address"
                        checked={selectedAddressKey === option.key && !useCustomAddress}
                        onChange={() => handleAddressPick(option.key)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800">
                          {option.label}
                          {option.isDefault ? (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Mặc định
                            </span>
                          ) : null}
                        </span>
                        {option.sub ? <span className="mt-0.5 block text-xs text-slate-500">{option.sub}</span> : null}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                      useCustomAddress ? 'border-[#538463] bg-[#538463]/5' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="order-shipping-address"
                      checked={useCustomAddress}
                      onChange={() => handleAddressPick('custom')}
                    />
                    <span className="text-sm font-medium text-slate-800">Nhập địa chỉ khác</span>
                  </label>
                </div>
              ) : null}
              {!isLoadingAddresses && addressOptions.length === 0 && selectedCustomer ? (
                <p className="text-sm text-amber-700">Khách chưa có địa chỉ đăng ký — vui lòng nhập địa chỉ giao hàng.</p>
              ) : null}
              {useCustomAddress || addressOptions.length === 0 ? (
                <textarea
                  className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                  placeholder="Số nhà, đường, phường, quận, tỉnh..."
                  value={shippingAddress}
                  onChange={(e) => onChange({ shippingAddress: e.target.value })}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'new' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Họ tên *</span>
            <input
              className={`w-full rounded-xl border px-3 py-2.5 text-sm ${newCustomerErrors.name ? 'border-red-300' : 'border-slate-200'}`}
              value={newCustomerForm.fullName}
              onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />
            {newCustomerErrors.name ? <p className="text-xs text-red-600">{newCustomerErrors.name}</p> : null}
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Số điện thoại *</span>
            <input
              className={`w-full rounded-xl border px-3 py-2.5 text-sm ${newCustomerErrors.phone ? 'border-red-300' : 'border-slate-200'}`}
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
            {newCustomerErrors.phone ? <p className="text-xs text-red-600">{newCustomerErrors.phone}</p> : null}
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Địa chỉ (tuỳ chọn)</span>
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={newCustomerForm.addressLine}
              onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, addressLine: e.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={isCreatingCustomer}
              onClick={handleCreateCustomer}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isCreatingCustomer ? 'Đang lưu...' : 'Lưu khách & chọn'}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'guest' ? (
        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Tên hiển thị trên đơn</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Khách lẻ"
              value={customerSnapshotName}
              onChange={(e) => onChange({ customerId: null, customerSnapshotName: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">
              Địa chỉ giao hàng {requireShippingAddress ? '*' : ''}
            </span>
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={shippingAddress}
              onChange={(e) => onChange({ shippingAddress: e.target.value })}
            />
          </label>
        </div>
      ) : null}
    </section>
  )
}

export default OrderCustomerSection
