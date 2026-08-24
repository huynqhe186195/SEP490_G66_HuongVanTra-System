// QA-02: seed phien dang nhap + chan toan bo API o tang network.
// Muc tieu: `npm ci && npm run test:e2e` chay duoc tren may clean, KHONG can docker backend.
import { expect } from '@playwright/test'

export const AUTH_SESSION_KEY = 'hv-auth-session'

function base64Url(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** JWT gia (khong chu ky) du de decodeJwtPayload doc ra sub + permission. */
export function makeAccessToken({ userId, permissions = [] }) {
  const header = base64Url({ alg: 'none', typ: 'JWT' })
  const payload = base64Url({
    sub: userId,
    permission: permissions,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
  return `${header}.${payload}.e2e`
}

function buildSession({ userId, username, roles, permissions }) {
  const expiresAt = new Date(Date.now() + 3600_000).toISOString()
  return {
    accessToken: makeAccessToken({ userId, permissions }),
    refreshToken: `refresh-${userId}`,
    expiresAt,
    expiresAtUtc: expiresAt,
    username,
    roles,
    permissions,
    userId,
  }
}

// Cac permission duoi day duoc chon de match dung nhanh code that:
// - MANAGE_EMPLOYEE / VIEW_ALL_CUSTOMERS / MANAGE_ROLE => canViewAllOrders => khong bi SaleWeeklyShiftGate
//   va bypass PosShiftDutyGate.
// - MANAGE_CATALOG => hasCatalogPermission => syncSessionFromServer khong goi refresh-token.
export const SESSIONS = {
  admin: buildSession({
    userId: '11111111-1111-1111-1111-111111111111',
    username: 'e2e.admin',
    roles: ['Admin'],
    permissions: ['MANAGE_ROLE', 'MANAGE_EMPLOYEE', 'VIEW_ALL_CUSTOMERS', 'MANAGE_CATALOG'],
  }),
  manager: buildSession({
    userId: '22222222-2222-2222-2222-222222222222',
    username: 'e2e.manager',
    roles: ['AgencyManager'],
    permissions: [
      'MANAGE_EMPLOYEE',
      'VIEW_ALL_CUSTOMERS',
      'CREATE_POS_ORDER',
      'CREATE_ORDER',
      'MANAGE_CATALOG',
    ],
  }),
  warehouse: buildSession({
    userId: '33333333-3333-3333-3333-333333333333',
    username: 'e2e.thukho',
    roles: ['InventoryManager'],
    permissions: ['OPERATE_WAREHOUSE', 'MANAGE_CATALOG'],
  }),
  // Ke toan: khong co module `products`, va khong bi shift gate => dung cho test RBAC bi tu choi.
  accountant: buildSession({
    userId: '44444444-4444-4444-4444-444444444444',
    username: 'e2e.ketoan',
    roles: ['Accountant'],
    permissions: ['VIEW_ALL_ORDERS'],
  }),
}

/** Ghi session vao localStorage truoc khi app boot. */
export async function seedSession(page, session) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [AUTH_SESSION_KEY, JSON.stringify(session)],
  )
}

/** Toast loi: div.bg-red-600 (ToastProvider khong co role/data-testid). */
export function errorToast(page) {
  return page.locator('div.bg-red-600').first()
}

export async function expectErrorToast(page, text) {
  await expect(errorToast(page)).toContainText(text)
}
