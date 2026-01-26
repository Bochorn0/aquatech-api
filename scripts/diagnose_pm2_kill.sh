#!/bin/bash

# ============================================================================
# PM2 Kill Diagnosis Script
# ============================================================================
# Este script investiga por qué PM2 fue matado por una señal del sistema
# Uso: sudo bash scripts/diagnose_pm2_kill.sh
# ============================================================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "==============================="
echo " 🔍 PM2 Kill Diagnosis"
echo " 📅 Fecha: $(date)"
echo " 🖥️  Hostname: $(hostname)"
echo "==============================="
echo ""

# ============================================================================
# 1. VERIFICAR OOM KILLER (Out of Memory)
# ============================================================================
print_info "1. Verificando OOM Killer (Out of Memory)..."
echo ""

if dmesg | grep -i "oom\|out of memory\|killed process" | tail -20; then
    print_error "⚠️  OOM KILLER ACTIVO - El sistema mató procesos por falta de memoria"
    echo ""
    print_info "Procesos matados por OOM en las últimas 24h:"
    dmesg | grep -i "oom\|killed process" | tail -10
    echo ""
else
    print_success "No se encontraron eventos de OOM Killer recientes"
fi

echo ""

# ============================================================================
# 2. VERIFICAR MEMORIA Y RECURSOS
# ============================================================================
print_info "2. Estado actual de recursos del sistema..."
echo ""

# Memoria
echo "📊 Memoria:"
free -h
echo ""

# Uso de memoria por proceso
echo "📊 Top 10 procesos por uso de memoria:"
ps aux --sort=-%mem | head -11
echo ""

# CPU
echo "📊 CPU:"
top -bn1 | grep "Cpu(s)" || echo "CPU info no disponible"
echo ""

# Disco
echo "📊 Disco:"
df -h | grep -E "^/dev|Filesystem"
echo ""

# ============================================================================
# 3. VERIFICAR LOGS DEL SISTEMA (journalctl)
# ============================================================================
print_info "3. Revisando logs del sistema (últimas 2 horas)..."
echo ""

if command -v journalctl &> /dev/null; then
    echo "🔍 Logs relacionados con PM2:"
    journalctl --since "2 hours ago" | grep -i "pm2\|node\|killed\|signal\|sigterm\|sigkill" | tail -20 || echo "No se encontraron logs relevantes"
    echo ""
    
    echo "🔍 Errores críticos del sistema:"
    journalctl -p err --since "2 hours ago" | tail -10 || echo "No hay errores críticos recientes"
    echo ""
else
    print_warning "journalctl no está disponible"
fi

# ============================================================================
# 4. VERIFICAR SEÑALES DEL SISTEMA
# ============================================================================
print_info "4. Verificando señales del sistema..."
echo ""

# Verificar si hay procesos PM2 actualmente
if pgrep -f "pm2" > /dev/null; then
    print_success "PM2 está corriendo actualmente"
    echo "PIDs de PM2:"
    pgrep -f "pm2"
    echo ""
else
    print_warning "PM2 no está corriendo actualmente"
    echo ""
fi

# Verificar procesos Node.js
echo "📊 Procesos Node.js activos:"
ps aux | grep -E "node|pm2" | grep -v grep || echo "No hay procesos Node.js/PM2 activos"
echo ""

# ============================================================================
# 5. VERIFICAR LOGS DE PM2
# ============================================================================
print_info "5. Revisando logs de PM2..."
echo ""

PM2_LOG_DIR="$HOME/.pm2/logs"
if [ -d "$PM2_LOG_DIR" ]; then
    echo "📁 Logs encontrados en: $PM2_LOG_DIR"
    echo ""
    
    # Buscar mensajes de kill en logs de PM2
    if find "$PM2_LOG_DIR" -name "*.log" -type f -exec grep -l "killed\|signal\|SIGTERM\|SIGKILL" {} \; 2>/dev/null; then
        print_warning "Se encontraron referencias a 'killed' o 'signal' en logs de PM2"
        echo ""
        echo "Últimas líneas relevantes:"
        find "$PM2_LOG_DIR" -name "*.log" -type f -exec grep -H "killed\|signal\|SIGTERM\|SIGKILL" {} \; 2>/dev/null | tail -10
    else
        print_success "No se encontraron referencias a kills en logs de PM2"
    fi
    echo ""
else
    print_warning "Directorio de logs de PM2 no encontrado: $PM2_LOG_DIR"
    echo ""
fi

# ============================================================================
# 6. VERIFICAR SYSTEMD (si aplica)
# ============================================================================
print_info "6. Verificando servicios systemd relacionados..."
echo ""

if command -v systemctl &> /dev/null; then
    # Verificar si hay servicios relacionados
    systemctl list-units --type=service --state=failed | grep -E "pm2|node|mongod|postgres" || echo "No hay servicios fallidos relacionados"
    echo ""
    
    # Verificar logs de systemd
    echo "🔍 Logs de systemd relacionados:"
    journalctl -u "*pm2*" --since "2 hours ago" 2>/dev/null | tail -10 || echo "No hay servicios systemd de PM2"
    echo ""
fi

# ============================================================================
# 7. VERIFICAR CRON Y TAREAS PROGRAMADAS
# ============================================================================
print_info "7. Verificando tareas programadas que puedan afectar PM2..."
echo ""

# Crontab del usuario actual
if crontab -l 2>/dev/null | grep -E "pm2|kill|restart"; then
    print_warning "Se encontraron tareas cron que pueden afectar PM2:"
    crontab -l | grep -E "pm2|kill|restart"
else
    print_success "No hay tareas cron que afecten PM2"
fi
echo ""

# Crontab de root
if sudo crontab -l 2>/dev/null | grep -E "pm2|kill|restart"; then
    print_warning "Se encontraron tareas cron de root que pueden afectar PM2:"
    sudo crontab -l | grep -E "pm2|kill|restart"
else
    print_success "No hay tareas cron de root que afecten PM2"
fi
echo ""

# ============================================================================
# 8. VERIFICAR LÍMITES DE RECURSOS (ulimit)
# ============================================================================
print_info "8. Verificando límites de recursos del sistema..."
echo ""

echo "Límites actuales:"
ulimit -a
echo ""

# ============================================================================
# 9. VERIFICAR PROCESOS ZOMBIE
# ============================================================================
print_info "9. Verificando procesos zombie..."
echo ""

ZOMBIES=$(ps aux | grep -c " Z ")
if [ "$ZOMBIES" -gt 1 ]; then
    print_warning "Se encontraron procesos zombie:"
    ps aux | grep " Z "
else
    print_success "No hay procesos zombie"
fi
echo ""

# ============================================================================
# 10. RESUMEN Y RECOMENDACIONES
# ============================================================================
echo "==============================="
print_info "Resumen y Recomendaciones"
echo "==============================="
echo ""

# Verificar memoria disponible
MEM_AVAILABLE=$(free -m | awk 'NR==2{printf "%.0f", $7}')
if [ "$MEM_AVAILABLE" -lt 500 ]; then
    print_error "⚠️  MEMORIA BAJA: Solo ${MEM_AVAILABLE}MB disponibles"
    print_warning "Recomendación: Considera aumentar memoria o optimizar procesos"
fi

# Verificar espacio en disco
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    print_error "⚠️  DISCO LLENO: ${DISK_USAGE}% usado"
    print_warning "Recomendación: Libera espacio en disco"
fi

echo ""
print_info "Para monitoreo continuo:"
echo "  - Memoria: watch -n 1 free -h"
echo "  - Procesos: watch -n 1 'ps aux --sort=-%mem | head -20'"
echo "  - PM2: pm2 monit"
echo "  - Logs en tiempo real: journalctl -f"
echo ""

print_info "Para prevenir futuros kills:"
echo "  1. Aumentar límite de memoria: ulimit -v [tamaño]"
echo "  2. Configurar swap si no existe"
echo "  3. Revisar max_memory_restart en ecosystem.config.js"
echo "  4. Monitorear uso de recursos regularmente"
echo ""
