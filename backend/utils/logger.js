const { createLogger, format, transports, addColors } = require('winston');
const path = require('path');
const fs   = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

addColors({ http: 'magenta' });

const { combine, timestamp, printf, colorize, errors } = format;

const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
});

const fileFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'http',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true })
  ),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat)
    }),
    new transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: fileFormat
    }),
    new transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: fileFormat
    })
  ]
});

module.exports = logger;
