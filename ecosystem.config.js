// ecosystem.config.js
// Configuración PM2 para Aquatech API
// Nota: PM2 requiere CommonJS (module.exports), no ES Modules

module.exports = {
  apps: [
    {
      name: 'api-aquatech',
      script: 'src/index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',  // Reducido para sistemas con poca RAM (1.7GB total)
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'mqtt-consumer',
      script: 'src/mqtt-consumer.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/mqtt-consumer-error.log',
      out_file: 'logs/mqtt-consumer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
