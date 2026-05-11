// ecosystem.config.js - إدارة العمليات مع PM2
module.exports = {
  apps: [
    {
      name: 'news-bot',
      script: 'news-bot.js',
      interpreter: 'node',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/news-bot-error.log',
      out_file: 'logs/news-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'main-server',
      script: 'server.js',
      interpreter: 'node',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/server-error.log',
      out_file: 'logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'python-bot',
      script: 'app.py',
      interpreter: 'python3',
      watch: false,
      max_memory_restart: '500M',
      error_file: 'logs/python-bot-error.log',
      out_file: 'logs/python-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};