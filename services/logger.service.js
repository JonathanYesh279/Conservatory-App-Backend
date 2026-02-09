import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  redact: [
    'password',
    'token',
    'refreshToken',
    'authorization',
    '*.password',
    '*.token',
    '*.refreshToken'
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      })
})

export function createLogger(module) {
  return logger.child({ module })
}

export default logger
