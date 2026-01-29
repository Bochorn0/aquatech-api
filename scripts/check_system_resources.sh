#!/bin/bash

# ============================================================================
# System Resources Check Script
# ============================================================================
# Verifica recursos del sistema y recomienda ajustes para 2GB RAM
# Uso: bash scripts/check_system_resources.sh
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
echo " 📊 System Resources Check"
echo " 📅 Fecha: $(date)"
echo " 🖥️  Hostname: $(hostname)"
echo "==============================="
echo ""

# ============================================================================
# 1. MEMORIA RAM
# ============================================================================
print_info "1. Estado de Memoria RAM..."
echo ""

TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
USED_MEM=$(free -m | awk 'NR==2{print $3}')
AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')
MEM_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))

echo "  Total: ${TOTAL_MEM}MB"
echo "  Usada: ${USED_MEM}MB (${MEM_PERCENT}%)"
echo "  Disponible: ${AVAILABLE_MEM}MB"
echo ""

if [ "$AVAILABLE_MEM" -lt 200 ]; then
    print_error "⚠️  MEMORIA CRÍTICA: Solo ${AVAILABLE_MEM}MB disponibles"
    print_warning "El sistema está al límite. El OOM killer puede matar procesos."
elif [ "$AVAILABLE_MEM" -lt 500 ]; then
    print_warning "⚠️  MEMORIA BAJA: ${AVAILABLE_MEM}MB disponibles"
    print_info "Considera reducir límites de memoria o agregar swap"
else
    print_success "Memoria disponible: ${AVAILABLE_MEM}MB"
fi

echo ""

# ============================================================================
# 2. SWAP
# ============================================================================
print_info "2. Estado de Swap..."
echo ""

SWAP_TOTAL=$(free -m | awk 'NR==3{print $2}')
SWAP_USED=$(free -m | awk 'NR==3{print $3}')

if [ "$SWAP_TOTAL" -eq 0 ]; then
    print_error "❌ SWAP NO CONFIGURADO"
    print_warning "En un sistema con 2GB RAM, swap es CRÍTICO"
    echo ""
    print_info "Para crear swap de 2GB, ejecuta:"
    echo "  sudo bash scripts/fix_pm2_issues.sh"
    echo "  o manualmente:"
    echo "  sudo fallocate -l 2G /swapfile"
    echo "  sudo chmod 600 /swapfile"
    echo "  sudo mkswap /swapfile"
    echo "  sudo swapon /swapfile"
    echo "  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"
else
    SWAP_PERCENT=$((SWAP_USED * 100 / SWAP_TOTAL))
    echo "  Total: ${SWAP_TOTAL}MB"
    echo "  Usada: ${SWAP_USED}MB (${SWAP_PERCENT}%)"
    echo ""
    
    if [ "$SWAP_PERCENT" -gt 80 ]; then
        print_warning "⚠️  Swap casi lleno (${SWAP_PERCENT}%)"
        print_info "Considera aumentar el tamaño de swap"
    else
        print_success "Swap configurado: ${SWAP_TOTAL}MB (${SWAP_PERCENT}% usado)"
    fi
fi

echo ""

# ============================================================================
# 3. DISCO
# ============================================================================
print_info "3. Estado de Disco..."
echo ""

DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAILABLE=$(df -h / | awk 'NR==2 {print $4}')

echo "  Uso: ${DISK_USAGE}%"
echo "  Disponible: ${DISK_AVAILABLE}"
echo ""

if [ "$DISK_USAGE" -gt 90 ]; then
    print_error "⚠️  DISCO CASI LLENO: ${DISK_USAGE}% usado"
    print_warning "Puede causar problemas con logs y swap"
elif [ "$DISK_USAGE" -gt 80 ]; then
    print_warning "⚠️  Disco con poco espacio: ${DISK_USAGE}% usado"
else
    print_success "Espacio en disco: ${DISK_USAGE}% usado"
fi

echo ""

# ============================================================================
# 4. PROCESOS POR MEMORIA
# ============================================================================
print_info "4. Top 10 procesos por uso de memoria..."
echo ""

ps aux --sort=-%mem | head -11 | awk 'NR==1 || $6 > 0 {printf "  %-8s %6sMB %5s%% %s\n", $2, $6/1024, $4, $11}'

echo ""

# ============================================================================
# 5. PM2 STATUS
# ============================================================================
print_info "5. Estado de PM2..."
echo ""

if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 list 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$PM2_STATUS"
        echo ""
        
        # Verificar memoria de procesos PM2
        PM2_MEM=$(pm2 jlist 2>/dev/null | grep -o '"memory":[0-9]*' | awk -F: '{sum+=$2} END {print sum/1024/1024}')
        if [ ! -z "$PM2_MEM" ]; then
            PM2_MEM_INT=${PM2_MEM%.*}
            echo "  Memoria total usada por PM2: ~${PM2_MEM_INT}MB"
            echo ""
            
            if [ "$PM2_MEM_INT" -gt 600 ]; then
                print_warning "⚠️  PM2 usa mucha memoria (${PM2_MEM_INT}MB)"
                print_info "Considera reducir max_memory_restart en ecosystem.config.cjs"
            else
                print_success "Memoria de PM2 dentro de límites razonables"
            fi
        fi
    else
        print_warning "PM2 no está corriendo o hay un error"
    fi
else
    print_warning "PM2 no está instalado"
fi

echo ""

# ============================================================================
# 6. OOM KILLER EVENTS
# ============================================================================
print_info "6. Eventos del OOM Killer (últimas 24h)..."
echo ""

OOM_EVENTS=$(dmesg 2>/dev/null | grep -i "oom\|out of memory\|killed process" | tail -5)
if [ ! -z "$OOM_EVENTS" ]; then
    print_error "⚠️  SE ENCONTRARON EVENTOS DEL OOM KILLER:"
    echo "$OOM_EVENTS" | while read line; do
        echo "  $line"
    done
    echo ""
    print_warning "El sistema está matando procesos por falta de memoria"
    print_info "Acción requerida: Reducir uso de memoria o agregar swap"
else
    print_success "No se encontraron eventos del OOM Killer recientes"
fi

echo ""

# ============================================================================
# 7. RECOMENDACIONES
# ============================================================================
echo "==============================="
print_info "📋 Recomendaciones"
echo "==============================="
echo ""

# Calcular memoria recomendada para apps
SYSTEM_OVERHEAD=800  # Sistema + MongoDB + PostgreSQL + PM2 daemon
RECOMMENDED_APP_MEM=$((TOTAL_MEM - SYSTEM_OVERHEAD))

if [ "$RECOMMENDED_APP_MEM" -lt 500 ]; then
    print_warning "Con ${TOTAL_MEM}MB RAM, el espacio para apps es limitado"
    print_info "Memoria recomendada para apps Node.js: ~${RECOMMENDED_APP_MEM}MB"
    echo ""
    print_info "Configuración actual en ecosystem.config.cjs:"
    echo "  - api-aquatech: 300M (max-old-space-size: 300)"
    echo "  - mqtt-consumer: 200M (max-old-space-size: 200)"
    echo "  - Total: 500M"
    echo ""
    
    if [ "$RECOMMENDED_APP_MEM" -lt 500 ]; then
        print_warning "⚠️  Los límites actuales (500M) pueden ser altos para este sistema"
        print_info "Considera reducir a:"
        echo "  - api-aquatech: 250M (max-old-space-size: 250)"
        echo "  - mqtt-consumer: 150M (max-old-space-size: 150)"
    fi
fi

echo ""

# Verificar swap
if [ "$SWAP_TOTAL" -eq 0 ]; then
    print_error "🔴 ACCIÓN CRÍTICA: Configurar swap"
    echo "  Ejecuta: sudo bash scripts/fix_pm2_issues.sh"
    echo ""
fi

# Verificar memoria disponible
if [ "$AVAILABLE_MEM" -lt 200 ]; then
    print_error "🔴 ACCIÓN CRÍTICA: Memoria muy baja"
    echo "  Opciones:"
    echo "  1. Reiniciar el servidor para liberar memoria"
    echo "  2. Detener servicios no esenciales"
    echo "  3. Aumentar RAM del droplet"
    echo "  4. Configurar swap si no existe"
    echo ""
fi

print_info "Comandos útiles:"
echo "  - Monitorear memoria: watch -n 1 free -h"
echo "  - Monitorear PM2: pm2 monit"
echo "  - Ver logs PM2: pm2 logs"
echo "  - Verificar OOM: dmesg | grep -i oom"
echo "  - Reiniciar PM2: pm2 restart all"
echo ""
