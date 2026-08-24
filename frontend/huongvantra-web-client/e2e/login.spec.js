import { expect, test } from '@playwright/test'
import { jsonBody, mockApi } from './fixtures/api.js'
import { AUTH_SESSION_KEY, SESSIONS, makeAccessToken } from './fixtures/session.js'

// QA-02 / flow critical: dang nhap.
test.describe('Dang nhap', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
  })

  test('chua co phien thi bi day ve /login', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible()
  })

  test('nut dang nhap bi disable khi form con trong', async ({ page }) => {
    await page.goto('/login')

    const submit = page.getByRole('button', { name: /Đăng nhập/ })
    await expect(submit).toBeDisabled()

    await page.getByPlaceholder('Nhập tên đăng nhập').fill('e2e.admin')
    await expect(submit).toBeDisabled()

    await page.getByPlaceholder('••••••••').fill('SaiMatKhau123!')
    await expect(submit).toBeEnabled()
  })

  test('sai thong tin dang nhap thi hien loi inline, khong tao phien', async ({ page }) => {
    await mockApi(page, {
      routes: [
        {
          pattern: /\/api\/auth\/login$/,
          response: {
            status: 401,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' }),
          },
        },
      ],
    })

    await page.goto('/login')
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('e2e.admin')
    await page.getByPlaceholder('••••••••').fill('SaiMatKhau123!')
    await page.getByRole('button', { name: /Đăng nhập/ }).click()

    await expect(page.getByText('Tên đăng nhập hoặc mật khẩu không đúng.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_KEY)
    expect(stored).toBeNull()
  })

  test('dang nhap thanh cong thi luu phien va vao trang chu theo quyen', async ({ page }) => {
    const admin = SESSIONS.admin
    await mockApi(page, {
      session: admin,
      routes: [
        {
          pattern: /\/api\/auth\/login$/,
          response: jsonBody({
            accessToken: makeAccessToken({
              userId: admin.userId,
              permissions: admin.permissions,
            }),
            refreshToken: admin.refreshToken,
            expiresAt: admin.expiresAt,
            username: admin.username,
            roles: admin.roles,
            permissions: admin.permissions,
          }),
        },
      ],
    })

    await page.goto('/login')
    await page.getByPlaceholder('Nhập tên đăng nhập').fill(admin.username)
    await page.getByPlaceholder('••••••••').fill('MatKhauDung123!')
    await page.getByRole('button', { name: /Đăng nhập/ }).click()

    // Admin (MANAGE_ROLE) -> resolveHomeRoute = /admin/users
    await expect(page).toHaveURL(/\/admin\/users$/)

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_KEY)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored).username).toBe(admin.username)
  })
})
