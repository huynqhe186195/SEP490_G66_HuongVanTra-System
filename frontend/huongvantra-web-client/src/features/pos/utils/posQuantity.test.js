import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPosBaseUnitLabel,
  normalizePosBaseQuantity,
} from './posQuantity.js'

test('piece quantity accepts a positive integer', () => {
  assert.equal(normalizePosBaseQuantity(3, 'Piece'), 3)
})

test('piece quantity rejects decimal input without rounding', () => {
  assert.throws(
    () => normalizePosBaseQuantity(1.6, 'Piece'),
    /không tự làm tròn/,
  )
})

test('gram quantity remains the exact integer number of grams', () => {
  assert.equal(normalizePosBaseQuantity('475', 'Gram'), 475)
  assert.equal(getPosBaseUnitLabel('Gram'), 'g')
})

test('empty or Vietnamese display units map to Piece', () => {
  assert.equal(normalizePosBaseQuantity(2, ''), 2)
  assert.equal(normalizePosBaseQuantity(2, 'cái'), 2)
  assert.equal(normalizePosBaseQuantity(2, 'Hộp 100g'), 2)
  assert.equal(getPosBaseUnitLabel('cái'), 'cái')
  assert.equal(getPosBaseUnitLabel('Hộp 100g'), 'cái')
})
