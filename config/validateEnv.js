import { createLogger } from '../services/logger.service.js'

const log = createLogger('config')

export function validateEnvironment() {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') return

  const required = ['MONGODB_URI', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']
  const optional = ['FRONTEND_URL', 'PORT', 'NODE_ENV']

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in .env or your deployment dashboard.'
    )
  }

  for (const key of optional) {
    if (!process.env[key]) {
      log.warn({ variable: key }, 'Optional environment variable not set')
    }
  }
}
