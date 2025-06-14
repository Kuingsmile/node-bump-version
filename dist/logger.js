import chalk from 'chalk';
import ora from './ora.js';
const level = {
    success: 'green',
    info: 'blue',
    warn: 'yellow',
    error: 'red'
};
const logger = (msg, type) => {
    let log = chalk[level[type]](`[Bump ${type.toUpperCase()}]: `);
    log += msg;
    ora.clear();
    ora.frame();
    console.log(log);
};
export default logger;
//# sourceMappingURL=logger.js.map