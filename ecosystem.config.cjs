module.exports = {
  apps: [
    {
      name: 'cerosai-bot',
      script: 'src/bot.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Variáveis de ambiente
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info'
      },
      
      // Configurações de logs PM2
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      
      // Configurações de restart
      min_uptime: '10s',
      max_restarts: 5,
      
      // Configurações de recursos
      node_args: '--max-old-space-size=1024'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:ynkjohn/CerosBOT-for-whatsapp.git',
      path: '/var/www/production',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};