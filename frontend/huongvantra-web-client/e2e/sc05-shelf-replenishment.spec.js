import { expect, test } from '@playwright/test'
import { jsonBody, mockApi } from './fixtures/api.js'
import { SESSIONS, expectErrorToast, seedSession } from './fixtures/session.js'

// QA-02 / SC-05: Yeu cau bo sung Ke Hang (Kho -> Ke).
// Backend INV-01..INV-09 con dang lam, nen day la smoke o tang UI + contract cua response;
// khi backend len se tro thanh regression that.
const LIST_PATTERN = /\/api\/v1\/inventory\/stock-adjustment-requests(\?|$)/

const REQUEST_ROW = {
  id: '9f1c0000-0000-4000-8000-000000000001',
  requestCode: 'YCBS-E2E-001',
  reason: 'Kệ hết hàng trà sen',
  status: 'Pending',
  requestedByName: 'e2e.manager',
  requestedAt: '2026-08-24T02:15:00Z',
  items: [
    {
      id: '9f1c0000-0000-4000-8000-000000000011',
      skuId: '9f1c0000-0000-4000-8000-000000000021',
      skuCode: 'TS-100G',
      skuSnapshotName: 'Trà sen 100g',
      requestedQuantity: 12,
      status: 'Pending',
    },
  ],
}

test.describe('SC-05 Yeu cau bo sung Ke Hang', () => {
  test('thu kho mo duoc danh sach va thay yeu cau cho tiep nhan', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, {
      session: SESSIONS.warehouse,
      routes: [{ pattern: LIST_PATTERN, response: jsonBody([REQUEST_ROW]) }],
    })

    await page.goto('/inventory/stock-requests')

    await expect(page).toHaveURL(/\/inventory\/stock-requests$/)
    await expect(page.getByRole('heading', { name: 'Yêu cầu bổ sung Kệ Hàng' })).toBeVisible()
    await expect(page.getByPlaceholder('Tìm mã yêu cầu, mã SKU, tên sản phẩm...')).toBeVisible()

    await expect(page.getByText('YCBS-E2E-001')).toBeVisible()
    await expect(page.getByText('Chờ tiếp nhận').first()).toBeVisible()

    // Thu kho la nguoi xu ly, khong phai nguoi tao yeu cau.
    await expect(page.getByRole('button', { name: 'Tạo yêu cầu' })).toHaveCount(0)
  })

  test('khong co du lieu thi hien empty state, khong vo trang', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, {
      session: SESSIONS.warehouse,
      routes: [{ pattern: LIST_PATTERN, response: jsonBody([]) }],
    })

    await page.goto('/inventory/stock-requests')

    await expect(page.getByRole('heading', { name: 'Yêu cầu bổ sung Kệ Hàng' })).toBeVisible()
    await expect(page.getByText(/Chưa có yêu cầu bổ sung tồn|Không có yêu cầu khớp bộ lọc/)).toBeVisible()
  })

  test('quan ly la nguoi tao yeu cau nen thay nut Tao yeu cau', async ({ page }) => {
    await seedSession(page, SESSIONS.manager)
    await mockApi(page, {
      session: SESSIONS.manager,
      routes: [{ pattern: LIST_PATTERN, response: jsonBody([REQUEST_ROW]) }],
    })

    await page.goto('/inventory/stock-requests')

    await expect(page.getByRole('heading', { name: 'Yêu cầu bổ sung Kệ Hàng' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tạo yêu cầu' })).toBeVisible()
  })

  test('ke toan khong co module stock_adjustment_ops thi bi tu choi', async ({ page }) => {
    await seedSession(page, SESSIONS.accountant)
    await mockApi(page, { session: SESSIONS.accountant })

    await page.goto('/inventory/stock-requests')

    await expectErrorToast(page, 'Chỉ Quản lý, Thủ kho hoặc Admin được xem Yêu cầu bổ sung Kệ Hàng')
    await expect(page).not.toHaveURL(/\/inventory\/stock-requests$/)
  })
})
