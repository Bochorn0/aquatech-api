// ecosystem.config.multi-api.js
// Configuración alternativa con múltiples instancias de API
// USO: Solo si tienes suficiente RAM (4GB+) o swap configurado (2GB+)
// 
// Para usar esta configuración:
// pm2 delete all
// pm2 start ecosystem.config.multi-api.js
// pm2 save

module.exports = {
  apps: [
    {
      name: 'api-aquatech',
      script: 'src/index.js',
      interpreter: 'node',
      // Múltiples instancias de API (stateless, seguro)
      instances: 2,  // 2 instancias para mejor rendimiento
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',  // Reducido por instancia (2 × 400M = 800M total)
      node_args: '--max-old-space-size=350',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      kill_timeout: 10000,
      restart_delay: 10000,
    },
    {
      name: 'mqtt-consumer',
      script: 'src/mqtt-consumer.js',
      interpreter: 'node',
      // ⚠️ CRÍTICO: MQTT DEBE ser instancia única
      instances: 1,  // NO CAMBIAR
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '350M',
      node_args: '--max-old-space-size=300',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/mqtt-consumer-error.log',
      out_file: 'logs/mqtt-consumer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      kill_timeout: 10000,
      restart_delay: 10000,
    },
  ],
};
