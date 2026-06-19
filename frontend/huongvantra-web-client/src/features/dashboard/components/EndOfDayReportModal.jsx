import { useState, useEffect } from 'react'
import { apiRequestAuth } from '../../../lib/apiClient.js'
import { fetchOrders } from '../../orders/services/ordersApi.js'
import { printEndOfDayReport } from '../utils/printEndOfDayReport.js'
import { loadPosSeller } from '../../pos/utils/posSeller.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canViewAllOrders } from '../../auth/utils/permissions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import * as XLSX from 'xlsx'

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
  const [exportFormat, setExportFormat] = useState('pdf')
  
  const [users, setUsers] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [sellerInfo, setSellerInfo] = useState({ name: '', role: '—' })
  const session = loadAuthSession()
  const canFilterByEmployee = canViewAllOrders(session)
  const agencyName = session?.agency?.name || 'Chi nhánh chính'

  useEffect(() => {
    loadPosSeller().then(setSellerInfo)
  }, [])

  useEffect(() => {
    if (!isOpen || !canFilterByEmployee) {
      setUsers([])
      return
    }

    const loadUsers = async () => {
      try {
        const res = await apiRequestAuth('/api/users?pageSize=100', {
          method: 'GET',
          silentAuthErrors: true,
        })
        const allowedRoles = ['Sale', 'AgencyManager']
        const fetchedUsers = res?.items || []
        const filtered = fetchedUsers.filter(u => {
          const uRoles = Array.isArray(u.roles) ? u.roles : [u.role].filter(Boolean)
          return uRoles.some(r => allowedRoles.includes(r) || allowedRoles.includes(r?.name))
        })
        setUsers(filtered)
      } catch (err) {
        console.error('Failed to load users:', err)
        setUsers([])
      }
    }

    loadUsers()
  }, [isOpen, canFilterByEmployee])

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

  const getExportFilename = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const timeStr = `${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`
    return `Bao_cao_cuoi_ngay_${filterDate.replace(/-/g, '_')}_${timeStr}`
  }

  const handlePrint = async () => {
    // KiotViet format date string: DD/MM/YYYY
    const d = new Date(filterDate)
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    
    await printEndOfDayReport({
      dateStr,
      employeeName: !canFilterByEmployee
        ? (sellerInfo.username
          ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}`
          : 'Bản thân')
        : selectedEmployeeId
          ? `${users.find(u => u.id === selectedEmployeeId)?.username} - ${users.find(u => u.id === selectedEmployeeId)?.employee?.fullName || 'Chưa cập nhật'}`
          : 'Tất cả nhân viên',
      orders,
      paperSize,
      creatorName: sellerInfo.username ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}` : sellerInfo.role,
      agencyName,
      filename: getExportFilename()
    })
  }

  const totalGross = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
  const totalNet = orders.reduce((sum, o) => sum + (o.finalAmount || 0), 0)
  const totalDiscount = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0)

  const handleExportExcel = () => {
    const creatorName = sellerInfo.username ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}` : sellerInfo.role;
    const employeeName = !canFilterByEmployee
        ? (sellerInfo.username
          ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}`
          : 'Bản thân')
        : selectedEmployeeId
          ? `${users.find(u => u.id === selectedEmployeeId)?.username} - ${users.find(u => u.id === selectedEmployeeId)?.employee?.fullName || 'Chưa cập nhật'}`
          : 'Tất cả nhân viên';

    const wsData = [
      ["BÁO CÁO DOANH THU CUỐI NGÀY", null, null, null, null, null],
      ["Hệ thống Quản lý Hương Vân Trà", null, null, null, null, null],
      [`Ngày giao dịch: ${filterDate}`, null, null, null, null, null],
      [`Thời gian tạo: ${formatVietnamDateTime(new Date().toISOString())}`, null, null, `Người tạo: ${creatorName}`, null, null],
      [`Chi nhánh: ${agencyName}`, null, null, `Nhân viên: ${employeeName}`, null, null],
      [],
      ["Mã giao dịch", "Thời gian", "Số lượng", "Doanh thu", "Giảm giá", "Thực thu"]
    ];

    orders.forEach(o => {
      wsData.push([
        o.orderCode,
        new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        o.totalQuantity || 0,
        o.totalAmount || 0,
        o.discountAmount || 0,
        o.finalAmount || 0
      ]);
    });

    wsData.push([
      "TỔNG CỘNG", null,
      orders.reduce((sum, o) => sum + (o.totalQuantity || 0), 0),
      totalGross,
      totalDiscount,
      totalNet
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 3, c: 5 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 4, c: 5 } },
      { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 1 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");
    XLSX.writeFile(wb, `${getExportFilename()}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Báo cáo doanh thu cuối ngày</h2>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="flex items-center justify-between">
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
                disabled={!canFilterByEmployee}
              >
                <option value="">Tất cả nhân viên</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username} - {u.employee?.fullName || 'Chưa cập nhật'}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              {exportFormat === 'pdf' && (
                <select 
                  value={paperSize} 
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="rounded-lg border-gray-300 text-sm focus:border-[#356647] focus:ring-[#356647]"
                >
                  <option value="A4">Khổ A4</option>
                  <option value="K80">Khổ K80</option>
                </select>
              )}
              <div className="flex rounded-lg shadow-sm">
                <select 
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="rounded-l-lg border-gray-300 text-sm focus:border-[#356647] focus:ring-[#356647] bg-gray-50 border-r-0"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
                <button
                  onClick={exportFormat === 'pdf' ? handlePrint : handleExportExcel}
                  disabled={isLoading || orders.length === 0}
                  className="flex items-center gap-2 rounded-r-lg bg-[#356647] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a5238] disabled:opacity-50 border border-l-0 border-[#356647]"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {exportFormat === 'pdf' ? 'print' : 'table_view'}
                  </span>
                  Xuất báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm ring-1 ring-gray-200" style={{ minHeight: '600px' }}>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold uppercase text-gray-800">BÁO CÁO DOANH THU CUỐI NGÀY</h1>
              <div className="text-sm font-bold text-gray-800 mb-4">Hệ thống Quản lý Hương Vân Trà</div>
              <div className="text-center mb-4 text-sm font-bold text-gray-800">
                Ngày giao dịch: {filterDate}
              </div>
              
              <div className="text-left text-sm text-gray-800 leading-relaxed grid grid-cols-2 gap-4">
                <div><strong>Thời gian tạo:</strong> {formatVietnamDateTime(new Date().toISOString())}</div>
                <div><strong>Người tạo:</strong> {sellerInfo.username ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}` : sellerInfo.role}</div>
                <div><strong>Chi nhánh:</strong> {agencyName}</div>
                <div><strong>Nhân viên:</strong> {
                  !canFilterByEmployee
                    ? (sellerInfo.username
                      ? `${sellerInfo.username} - ${sellerInfo.fullName || 'Chưa cập nhật'}`
                      : 'Bản thân')
                    : selectedEmployeeId
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
                    const timeStr = new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
                      <td colSpan={2} className="px-4 py-3 text-yellow-900">
                        TỔNG CỘNG ({orders.length} Đơn)
                      </td>
                      <td className="px-4 py-3 text-center text-yellow-900">{orders.reduce((sum, o) => sum + (o.totalQuantity || 0), 0)}</td>
                      <td className="px-4 py-3 text-right text-yellow-900">{formatCurrency(totalGross)}</td>
                      <td className="px-4 py-3 text-right text-yellow-900">{formatCurrency(totalDiscount)}</td>
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
