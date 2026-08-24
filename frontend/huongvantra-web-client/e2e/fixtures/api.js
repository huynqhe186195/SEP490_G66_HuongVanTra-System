// QA-02: chan moi request /api/** o tang network. Spec chi khai bao route can quan tam,
// con lai roi vao catch-all tra rong => khong test nao phu thuoc backend that.
const JSON_HEADERS = { 'content-type': 'application/json' }

function jsonBody(body) {
  return { status: 200, headers: JSON_HEADERS, body: JSON.stringify(body ?? {}) }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {object} [options.session] session dang dung, de /api/auth/me tra dung username/roles
 * @param {Array<{ pattern: RegExp, response: object }>} [options.routes] override, khop truoc catch-all
 */
export async function mockApi(page, { session = null, routes = [] } = {}) {
  const defaults = [
    // Single-session check trong AdminLayout: fail => bi dang xuat ve /login.
    { pattern: /\/api\/auth\/session$/, response: jsonBody({ active: true }) },
    {
      pattern: /\/api\/auth\/me$/,
      response: jsonBody({
        id: session?.userId ?? null,
        username: session?.username ?? '',
        roles: session?.roles ?? [],
        employee: { fullName: session?.username ?? '' },
      }),
    },
    {
      pattern: /\/api\/auth\/refresh-token$/,
      response: jsonBody({
        accessToken: session?.accessToken ?? '',
        refreshToken: session?.refreshToken ?? '',
        expiresAt: session?.expiresAt ?? new Date(Date.now() + 3600_000).toISOString(),
        username: session?.username ?? '',
        roles: session?.roles ?? [],
        permissions: session?.permissions ?? [],
      }),
    },
    {
      pattern: /\/api\/v1\/notifications\/summary/,
      response: jsonBody({ unreadCount: 0, total: 0 }),
    },
    { pattern: /\/api\/v1\/notifications/, response: jsonBody({ items: [], total: 0 }) },
  ]

  const table = [...routes, ...defaults]

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: JSON_HEADERS, body: '' })
      return
    }

    const hit = table.find((entry) => entry.pattern.test(url))
    await route.fulfill(hit ? hit.response : jsonBody({ items: [], total: 0 }))
  })
}

export { jsonBody }
