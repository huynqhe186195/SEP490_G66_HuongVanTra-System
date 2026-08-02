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

test('account form accepts landline phone starting with 02 (11 digits)', () => {
  const result = validateCreateAccountForm({
    ...validForm,
    phone: '02838123456',
    roleIds: [2],
  })

  assert.equal(result.valid, true)
})

test('account form rejects incomplete landline phone', () => {
  const result = validateCreateAccountForm({
    ...validForm,
    phone: '0283812345',
    roleIds: [2],
  })

  assert.equal(result.valid, false)
  assert.match(result.errors.phone, /máy bàn/i)
})
