function stableSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }

  const entries = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
  return `{${entries.join(',')}}`
}

export function createCheckoutAttemptManager(uuidFactory = () => crypto.randomUUID()) {
  let attempt = null
  let activePromise = null

  return {
    isProcessing() {
      return activePromise !== null
    },

    reset() {
      attempt = null
    },

    submit(requestSnapshot, submitter) {
      if (activePromise) return activePromise

      const fingerprint = stableSerialize(requestSnapshot)
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = {
          fingerprint,
          key: uuidFactory(),
        }
      }

      const currentAttempt = attempt
      let currentPromise
      currentPromise = (async () => {
        await Promise.resolve()
        try {
          const result = await submitter(currentAttempt.key)
          if (attempt === currentAttempt) attempt = null
          return result
        } finally {
          if (activePromise === currentPromise) activePromise = null
        }
      })()
      activePromise = currentPromise
      return currentPromise
    },
  }
}
