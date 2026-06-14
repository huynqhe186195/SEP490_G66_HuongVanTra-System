import { useState, useEffect } from 'react'
import { apiRequestAuth } from '../../../lib/apiClient.js'
import { fetchOrders } from '../../orders/services/ordersApi.js'
import { printEndOfDayReport } from '../utils/printEndOfDayReport.js'
import { loadPosSeller } from '../../pos/utils/posSeller.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
}

function formatDateToLocalString(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function EndOfDayReportModal({ isOpen, onClose }) {
  const [filterDate, setFilterDate] = useState(formatDateToLocalString(new Date()))
  const [paperSize, setPaperSize] = useState('A4')
  
  const [users, setUsers] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [sellerInfo, setSellerInfo] = useState({ name: '', role: '—' })
  const session = loadAuthSession()
  const agencyName = session?.agency?.name || 'Chi nhánh chính'

  useEffect(() => {
    loadPosSeller().then(setSellerInfo)
  }, [])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await apiRequestAuth('/api/users?pageSize=100', { method: 'GET' })
        setUsers(res?.items || [])
      } catch (err) {
        console.error('Failed to load users:', err)
      }
    }
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const loadOrders = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Start and end of the selected date (local time converted to UTC roughly, but API handles Date properly if we send string)
        const dateObj = new Date(filterDate)
        dateObj.setHours(0, 0, 0, 0)
        const fromDate = dateObj.toISOString()
        
        const dateObjEnd = new Date(filterDate)
        dateObjEnd.setHours(23, 59, 59, 999)
        const toDate = dateObjEnd.toISOString()

        const req = {
          status: 'Completed',
          fromDate,
          toDate,
          pageSize: 1000 // Get all for the day
        }
        if (selectedEmployeeId) {
          req.employeeId = selectedEmployeeId
        }

        const res = await fetchOrders(req)
        
        setOrders(res.items || [])
      } catch (err) {
        setError('Không thể tải dữ liệu báo cáo: ' + err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [isOpen, filterDate, selectedEmployeeId])

  if (!isOpen) return null

  const handlePrint = async () => {
    // KiotViet format date string: DD/MM/YYYY
    const d = new Date(filterDate)
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    
    await printEndOfDayReport({
      dateStr,
      employeeName: selectedEmployeeId 
        ? `${users.find(u => u.id === selectedEmployeeId)?.username} - ${users.find(u => u.id === selectedEmployeeId)?.employee?.fullName || 'Chưa cập nhật'}`
        : 'Tất cả nhân viên',
      orders,
      paperSize,
      creatorName: sellerInfo.username ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}` : sellerInfo.role,
      agencyName
    })
  }

  const totalGross = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
  const totalNet = orders.reduce((sum, o) => sum + (o.finalAmount || 0), 0)
  const totalDiscount = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-6">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold text-gray-900">Báo cáo cuối ngày</h2>
            
            <div className="flex items-center gap-3">
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="rounded-lg border-gray-300 text-sm focus:border-[#356647] focus:ring-[#356647]"
              />
              <select 
                value={selectedEmployeeId} 
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="rounded-lg border-gray-300 text-sm focus:border-[#356647] focus:ring-[#356647]"
              >
                <option value="">Tất cả nhân viên</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username} - {u.employee?.fullName || 'Chưa cập nhật'}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              value={paperSize} 
              onChange={(e) => setPaperSize(e.target.value)}
              className="rounded-lg border-gray-300 text-sm focus:border-[#356647] focus:ring-[#356647]"
            >
              <option value="A4">Khổ A4</option>
              <option value="K80">Khổ K80</option>
            </select>
            <button
              onClick={handlePrint}
              disabled={isLoading || orders.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[#356647] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a5238] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              Xuất ra PDF
            </button>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm ring-1 ring-gray-200" style={{ minHeight: '600px' }}>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold uppercase text-gray-800">BÁO CÁO CUỐI NGÀY VỀ BÁN HÀNG</h1>
              <div className="text-sm font-bold text-gray-800 mb-4">Hệ thống Quản lý Hương Vân Trà</div>
              <div className="text-center mb-4 text-sm font-bold text-gray-800">
                Ngày giao dịch: {filterDate}
              </div>
              
              <div className="text-left text-sm text-gray-800 leading-relaxed grid grid-cols-2 gap-4">
                <div><strong>Thời gian tạo:</strong> {formatVietnamDateTimeMinute(new Date().toISOString())}</div>
                <div><strong>Người tạo:</strong> {sellerInfo.username ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}` : sellerInfo.role}</div>
                <div><strong>Chi nhánh:</strong> {agencyName}</div>
                <div><strong>Nhân viên:</strong> {
                  selectedEmployeeId 
                  ? `${users.find(u => u.id === selectedEmployeeId)?.username} - ${users.find(u => u.id === selectedEmployeeId)?.employee?.fullName || 'Chưa cập nhật'}`
                  : 'Tất cả nhân viên'
                }</div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#356647] border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="text-center text-red-600 p-4 bg-red-50 rounded-lg">{error}</div>
            ) : (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-blue-50 text-xs font-bold uppercase text-blue-900 border-y border-blue-200">
                  <tr>
                    <th className="px-4 py-3">Mã giao dịch</th>
                    <th className="px-4 py-3 text-center">Thời gian</th>
                    <th className="px-4 py-3 text-center">SL</th>
                    <th className="px-4 py-3 text-right">Doanh thu</th>
                    <th className="px-4 py-3 text-right">Giảm giá</th>
                    <th className="px-4 py-3 text-right">Thực thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => {
                    const qty = o.totalQuantity || 0;
                    const timeStr = new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <span className="material-symbols-outlined text-[16px] text-gray-400 mr-2 align-middle">receipt_long</span>
                          {o.orderCode}
                        </td>
                        <td className="px-4 py-3 text-center">{timeStr}</td>
                        <td className="px-4 py-3 text-center font-medium">{qty}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(o.totalAmount)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(o.discountAmount || 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(o.finalAmount)}</td>
                      </tr>
                    )
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Không có giao dịch nào trong ngày.
                      </td>
                    </tr>
                  )}
                </tbody>
                {orders.length > 0 && (
                  <tfoot className="bg-yellow-50 font-bold border-y border-yellow-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-yellow-900">
                        TỔNG CỘNG ({orders.length} Đơn)
                      </td>
                      <td className="px-4 py-3 text-right text-yellow-900">{formatCurrency(totalGross)}</td>
                      <td className="px-4 py-3 text-right text-yellow-900"></td>
                      <td className="px-4 py-3 text-right text-red-600 text-base">{formatCurrency(totalNet)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
