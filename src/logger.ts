import chalk from 'chalk'

import ora from './ora'
import { LOG_LEVELS, type LogLevel } from './types/index'

const LOG_LEVEL_COLORS = {
  success: chalk.green,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red
} as const satisfies Record<LogLevel, typeof chalk.green>

export const isValidLogLevel = (level: string): level is LogLevel => {
  return LOG_LEVELS.includes(level as LogLevel)
}
const logger = (message: string, logLevel: LogLevel): void => {
  // Validate log level using type-safe validation
  if (!isValidLogLevel(logLevel)) {
    throw new Error(`Invalid log level: ${logLevel}. Valid levels are: ${LOG_LEVELS.join(', ')}`)
  }

  const colorFunction = LOG_LEVEL_COLORS[logLevel]
  const prefix = colorFunction(`[Bump ${logLevel.toUpperCase()}]: `)
  const formattedMessage = `${prefix}${message}`

  ora.clear()
  ora.frame()
  console.log(formattedMessage)
}

export const logSuccess = (message: string): void => logger(message, 'success')
export const logInfo = (message: string): void => logger(message, 'info')
export const logWarn = (message: string): void => logger(message, 'warn')
export const logError = (message: string): void => logger(message, 'error')

export const logMultiple = (messages: string[], logLevel: LogLevel): void => {
  messages.forEach(message => logger(message, logLevel))
}

export default logger
