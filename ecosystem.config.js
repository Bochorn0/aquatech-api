// ecosystem.config.js
// Configuración PM2 para Aquatech API
// Nota: PM2 requiere CommonJS (module.exports), no ES Modules
// Optimizado para servidor con 2GB RAM - ENFOQUE: Prevenir kills, no restarts frecuentes

module.exports = {
  apps: [
    {
      name: 'api-aquatech',
      script: 'src/index.js',
      interpreter: 'node',
      // API puede correr múltiples instancias (stateless, no causa duplicados)
      // Para 2GB RAM: usar 1-2 instancias máximo
      // Para 4GB+ RAM: puedes usar 'max' o número específico
      instances: 1,  // Cambiar a 2 si tienes suficiente RAM y swap configurado
      exec_mode: 'fork',  // 'fork' para múltiples instancias, 'cluster' para mejor rendimiento (requiere más RAM)
      watch: false,
      // IMPORTANTE: max_memory_restart causa restarts y pérdida de sesiones
      // En lugar de esto, usamos node_args para limitar heap y confiamos en swap
      // Solo reiniciar si realmente excede mucho (safety net)
      max_memory_restart: '500M',  // Aumentado para evitar restarts frecuentes
      // Limitar heap de Node.js - esto previene memory leaks sin causar restarts
      node_args: '--max-old-space-size=400',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,  // Reducido para evitar loops de restart
      min_uptime: '30s',  // Aumentado - solo reiniciar si realmente falla
      // Tiempo de espera para cierre graceful
      kill_timeout: 10000,  // Aumentado para permitir cierre graceful
      // NO usar exp_backoff_restart_delay - puede causar problemas
      // Esperar más antes de reiniciar tras crash
      restart_delay: 10000,  // Aumentado para evitar restarts rápidos
    },
    {
      name: 'mqtt-consumer',
      script: 'src/mqtt-consumer.js',
      interpreter: 'node',
      // ⚠️ CRÍTICO: MQTT DEBE correr como instancia única
      // Múltiples instancias = múltiples consumidores = mensajes duplicados = registros duplicados en DB
      instances: 1,  // NO CAMBIAR - debe ser siempre 1
      exec_mode: 'fork',
      watch: false,
      // Mismo enfoque - evitar restarts frecuentes
      max_memory_restart: '350M',  // Aumentado
      // Limitar heap de Node.js
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
      // Tiempo de espera para cierre graceful
      kill_timeout: 10000,
      // Esperar más antes de reiniciar
      restart_delay: 10000,
    },
  ],
};
