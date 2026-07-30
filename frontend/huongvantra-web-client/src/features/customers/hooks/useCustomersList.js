import { useCallback, useEffect, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { fetchCustomers, fetchInactiveCustomers } from '../services/customersApi.js'
import { CUSTOMER_TYPE_BY_TAB } from '../utils/customerDisplay.js'

export function useCustomersList({
  activeTab,
  searchValue,
  tierFilter,
  debtFilter,
  sortBy,
  pollIntervalMs = 30000,
}) {
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const isInactiveTab = activeTab === 'inactive'
  const isDebtsTab = activeTab === 'debts'

  const reload = useCallback(async () => {
    const keyword = searchValue.trim() || undefined
    const filterParams = {
      keyword,
      tierCode: tierFilter || undefined,
      debtFilter: debtFilter || undefined,
      sortBy: sortBy || undefined,
    }

    if (isInactiveTab) {
      const data = await fetchInactiveCustomers({ keyword })
      setCustomers(Array.isArray(data) ? data : [])
      return data
    }

    if (isDebtsTab) {
      const data = await fetchCustomers({
        keyword,
        debtFilter: debtFilter || 'with_debt',
        sortBy: sortBy || 'debt',
      })
      setCustomers(Array.isArray(data) ? data : [])
      return data
    }

    const data = await fetchCustomers({
      ...filterParams,
      customerType: CUSTOMER_TYPE_BY_TAB[activeTab],
    })
    setCustomers(Array.isArray(data) ? data : [])
    return data
  }, [activeTab, searchValue, tierFilter, debtFilter, sortBy, isInactiveTab, isDebtsTab])

  useEffect(() => {
    let mounted = true
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true)
        const data = await reload()
        if (mounted) setCustomers(Array.isArray(data) ? data : [])
      } catch (error) {
        if (mounted) {
          setCustomers([])
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }, 250)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [reload])

  useEffect(() => {
    if (isInactiveTab || !pollIntervalMs || pollIntervalMs <= 0) return undefined

    const interval = setInterval(() => {
      reload().catch(() => {})
    }, pollIntervalMs)

    return () => clearInterval(interval)
  }, [reload, pollIntervalMs, isInactiveTab])


  return { customers, setCustomers, isLoading, reload }
}
