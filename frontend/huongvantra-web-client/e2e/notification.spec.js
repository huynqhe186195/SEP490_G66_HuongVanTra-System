import { expect, test } from '@playwright/test'
import { jsonBody, mockApi } from './fixtures/api.js'
import { SESSIONS, seedSession } from './fixtures/session.js'

// QA-02 / flow critical: chuong thong bao tren AdminLayout.
// Luu y: NotificationBell render 2 lan (header mobile `lg:hidden` + bar desktop `lg:flex`).
// O viewport 1440 thi ban mobile bi an, nen phai loc `:visible` chu khong dung .first().
const BELL = 'button[aria-label="Thông báo"]:visible'

const SUMMARY_PATTERN = /\/api\/v1\/notifications\/summary/
const READ_ALL_PATTERN = /\/api\/v1\/notifications\/read-all/
const LIST_PATTERN = /\/api\/v1\/notifications\?/

const NOTIFICATIONS = [
  {
    id: 'aa000000-0000-4000-8000-000000000001',
    type: 'StockAdjustmentRequestCreated',
    title: 'Yêu cầu bổ sung Kệ Hàng mới',
    body: 'YCBS-E2E-001 cần được tiếp nhận.',
    link: '/inventory/stock-requests',
    isRead: false,
    createdAt: '2026-08-24T02:15:00Z',
  },
  {
    id: 'aa000000-0000-4000-8000-000000000002',
    type: 'LowStock',
    title: 'Trà sen 100g sắp hết trên Kệ',
    body: 'Số lượng còn lại: 3.',
    link: null,
    isRead: true,
    createdAt: '2026-08-23T09:00:00Z',
  },
]

test.describe('Thong bao', () => {
  test('khong co thong bao thi mo dropdown thay empty state, khong co badge', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, { session: SESSIONS.warehouse })

    await page.goto('/inventory/products')

    const bell = page.locator(BELL)
    await expect(bell).toBeVisible()
    await expect(bell.locator('span.bg-red-500')).toHaveCount(0)

    await bell.click()

    await expect(page.getByText('Chưa có thông báo nào.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc hết' })).toHaveCount(0)
  })

  test('co thong bao chua doc thi hien badge va danh sach', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, {
      session: SESSIONS.warehouse,
      routes: [
        { pattern: SUMMARY_PATTERN, response: jsonBody({ unreadCount: 1, total: 2 }) },
        { pattern: LIST_PATTERN, response: jsonBody({ items: NOTIFICATIONS, total: 2 }) },
      ],
    })

    await page.goto('/inventory/products')

    const bell = page.locator(BELL)
    await expect(bell.locator('span.bg-red-500')).toHaveText('1')

    await bell.click()

    await expect(page.getByText('Yêu cầu bổ sung Kệ Hàng mới')).toBeVisible()
    await expect(page.getByText('YCBS-E2E-001 cần được tiếp nhận.')).toBeVisible()
    await expect(page.getByText('Trà sen 100g sắp hết trên Kệ')).toBeVisible()
  })

  test('danh dau da doc het thi badge tat', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, {
      session: SESSIONS.warehouse,
      routes: [
        { pattern: READ_ALL_PATTERN, response: jsonBody({ unreadCount: 0 }) },
        { pattern: SUMMARY_PATTERN, response: jsonBody({ unreadCount: 1, total: 2 }) },
        { pattern: LIST_PATTERN, response: jsonBody({ items: NOTIFICATIONS, total: 2 }) },
      ],
    })

    await page.goto('/inventory/products')

    const bell = page.locator(BELL)
    await expect(bell.locator('span.bg-red-500')).toHaveText('1')

    await bell.click()
    await page.getByRole('button', { name: 'Đánh dấu đã đọc hết' }).click()

    await expect(bell.locator('span.bg-red-500')).toHaveCount(0)
  })

  test('bam vao thong bao thi dieu huong theo link', async ({ page }) => {
    await seedSession(page, SESSIONS.warehouse)
    await mockApi(page, {
      session: SESSIONS.warehouse,
      routes: [
        {
          pattern: /\/api\/v1\/notifications\/[0-9a-f-]+\/read$/,
          response: jsonBody(NOTIFICATIONS[0]),
        },
        { pattern: SUMMARY_PATTERN, response: jsonBody({ unreadCount: 1, total: 2 }) },
        { pattern: LIST_PATTERN, response: jsonBody({ items: NOTIFICATIONS, total: 2 }) },
      ],
    })

    await page.goto('/inventory/products')

    await page.locator(BELL).click()
    await page.getByText('Yêu cầu bổ sung Kệ Hàng mới').click()

    await expect(page).toHaveURL(/\/inventory\/stock-requests$/)
    await expect(page.getByRole('heading', { name: 'Yêu cầu bổ sung Kệ Hàng' })).toBeVisible()
  })
})
