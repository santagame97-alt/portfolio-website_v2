// PM2 конфигурация для VPS

module.exports = {
  apps: [{
    name: 'portfolio',
    script: './backend/server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Переменные окружения
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Автоматический перезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Логи
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Перезапуск при ошибках
    min_uptime: '10s',
    max_restarts: 10,
    
    // Задержка между перезапусками
    restart_delay: 4000
  }]
};
