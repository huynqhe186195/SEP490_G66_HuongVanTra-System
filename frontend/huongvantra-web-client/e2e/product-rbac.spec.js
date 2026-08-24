import { expect, test } from '@playwright/test'
import { mockApi } from './fixtures/api.js'
import { SESSIONS, expectErrorToast, seedSession } from './fixtures/session.js'

// QA-02 / flow critical: phan quyen truy cap trang San pham.
// Kiem chung ModuleRouteGuard: co module `products` thi vao duoc, khong co thi bi day ra + toast.
test.describe('RBAC trang San pham', () => {
  test('thu kho vao duoc /inventory/products', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, { session: SESSIONS.warehouse })

    await page.goto('/inventory/products')

    await expect(page).toHaveURL(/\/inventory\/products$/)
    await expect(page.getByRole('heading', { name: 'Sản phẩm & số lượng' })).toBeVisible()
    await expect(page.getByPlaceholder('Tìm theo SKU, tên, biến thể...')).toBeVisible()
  })

  test('ke toan khong co module products thi bi tu choi', async ({ page }) => {
    await seedSession(page, SESSIONS.accountant)
    await mockApi(page, { session: SESSIONS.accountant })

    await page.goto('/inventory/products')

    await expectErrorToast(page, 'Bạn không có quyền truy cập trang này.')
    await expect(page).not.toHaveURL(/\/inventory\/products$/)
    await expect(page.getByRole('heading', { name: 'Sản phẩm & số lượng' })).toBeHidden()
  })

  test('thu kho khong duoc vao trang phan quyen admin', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, { session: SESSIONS.warehouse })

    await page.goto('/admin/phan-quyen')

    await expectErrorToast(page, 'Chỉ Quản trị viên mới được quản lý tài khoản và phân quyền.')
    await expect(page).not.toHaveURL(/\/admin\/phan-quyen$/)
  })
})
