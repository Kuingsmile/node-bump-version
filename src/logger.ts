import chalk from 'chalk';

import ora from './ora.js';
import { LogLevel } from './types/index.js';

const level: Record<LogLevel, string> = {
  success: 'green',
  info: 'blue',
  warn: 'yellow',
  error: 'red'
};

const logger = (msg: string, type: LogLevel): void => {
  let log = (chalk as any)[level[type]](`[Bump ${type.toUpperCase()}]: `);
  log += msg;
  ora.clear();
  ora.frame();
  console.log(log);
};

export default logger;
