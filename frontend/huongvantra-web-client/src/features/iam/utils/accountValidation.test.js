import assert from 'node:assert/strict'
import test from 'node:test'

import { validateCreateAccountForm } from './accountValidation.js'

const validForm = {
  username: 'dual_user',
  password: '123456',
  fullName: 'Dual User',
  phone: '0900000000',
}

test('account form accepts a valid multi-role selection', () => {
  const result = validateCreateAccountForm({ ...validForm, roleIds: [2, 3] })

  assert.equal(result.valid, true)
})

test('account form rejects an empty role selection', () => {
  const result = validateCreateAccountForm({ ...validForm, roleIds: [] })

  assert.equal(result.valid, false)
  assert.match(result.errors.roleIds, /ít nhất một vai trò/)
})

test('account form remains compatible with legacy roleId input', () => {
  const result = validateCreateAccountForm({ ...validForm, roleId: 2 })

  assert.equal(result.valid, true)
})
