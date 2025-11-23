
const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

// custom setup
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  success: 5,
  block: 6,
  tx: 7,
  }

const logColours = {
    error: 'brightRed',
    warn: 'brightYellow',
    info: 'brightGreen',
    verbose: 'greyBG',
    debug: 'brightBlue',
    success: 'greenBG',
    block: 'brightMagenta',
    tx: 'brightCyan',
  }

winston.addColors(logColours);


// Create logger instance
const log = winston.createLogger({
  levels: logLevels,
  level: isProduction ? 'info' : 'tx',  // Less verbose logging in production mode - ensures all messages of 'success' level (5) or lower are logged 
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD hh:mm:ss.SSS A',
    }),
    colorize(),
    printf((log) =>`[${log.timestamp}] ${log.level}: ${log.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    ...(!isProduction ? [new winston.transports.File({ filename: '_logs/debug.log' })] : [])  // Creates logs only in dev mode
  ]
});


module.exports = log;
