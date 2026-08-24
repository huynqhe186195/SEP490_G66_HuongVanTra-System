import { expect, test } from '@playwright/test'
import { mockApi } from './fixtures/api.js'
import { SESSIONS, expectErrorToast, seedSession } from './fixtures/session.js'

// QA-02 / flow critical: man hinh POS.
// Session Quan ly co MANAGE_EMPLOYEE => bypass SaleWeeklyShiftGate va PosShiftDutyGate,
// nen smoke test khong phu thuoc du lieu ca lam viec.
test.describe('POS', () => {
  test('quan ly mo duoc man POS, nut thanh toan bi disable khi gio hang rong', async ({ page }) => {
    await seedSession(page, SESSIONS.manager)
    await mockApi(page, { session: SESSIONS.manager })

    await page.goto('/pos')

    await expect(page).toHaveURL(/\/pos$/)
    await expect(page.getByText('Cần đăng ký & được duyệt ca quầy')).toHaveCount(0)

    await expect(page.getByPlaceholder('Tìm SP, SKU, barcode...')).toBeVisible()
    await expect(page.getByPlaceholder('Tìm tên, SĐT, mã KH...')).toBeVisible()

    const checkout = page.getByRole('button', { name: /F12 Thanh toán/ })
    await expect(checkout).toBeVisible()
    await expect(checkout).toBeDisabled()
  })

  test('tai khoan khong co quyen POS thi bi tu choi', async ({ page }) => {
    await seedSession(page, SESSIONS.accountant)
    await mockApi(page, { session: SESSIONS.accountant })

    await page.goto('/pos')

    await expectErrorToast(page, 'Tài khoản không có quyền tạo đơn POS/COD')
    await expect(page).not.toHaveURL(/\/pos$/)
  })
})
