#!/bin/bash

# ============================================================================
# PM2 Kill Diagnosis & Checklist Script
# ============================================================================
# Investigates why PM2 is being killed by an external signal (~every 90s).
# Run on the droplet: bash scripts/diagnose_pm2_kill.sh
# For full system checks (cron root, systemd): sudo bash scripts/diagnose_pm2_kill.sh
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

print_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error()   { echo -e "${RED}❌ $1${NC}"; }
print_warning()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_header()  { echo -e "\n${BOLD}=== $1 ===${NC}\n"; }

# Collect action items for the final checklist
ACTION_ITEMS=()

echo ""
echo "==============================="
echo " 🔍 PM2 Kill Diagnosis & Checklist"
echo " 📅 $(date)"
echo " 🖥️  $(hostname)"
echo "==============================="

# ============================================================================
# 1. OOM KILLER
# ============================================================================
print_header "1. OOM Killer (Out of Memory)"
if dmesg 2>/dev/null | grep -i "oom\|out of memory\|killed process" | tail -5; then
    print_error "OOM Killer activity found - processes were killed due to memory"
    ACTION_ITEMS+=("Check memory: free -h; consider swap or more RAM")
else
    print_success "No recent OOM Killer events"
fi

# ============================================================================
# 2. WHO IS PM2'S PARENT? (Critical for "pm2 has been killed by signal")
# ============================================================================
print_header "2. Who is PM2's parent process?"
PM2_PID=""
if command -v pgrep &>/dev/null; then
    # PM2 daemon is often the "node" process that runs PM2
    PM2_PID=$(pgrep -f "PM2.*god\|pm2.*daemon" 2>/dev/null | head -1)
    [ -z "$PM2_PID" ] && PM2_PID=$(pgrep -f "pm2" 2>/dev/null | head -1)
fi
if [ -n "$PM2_PID" ]; then
    print_success "PM2-related PID: $PM2_PID"
    PARENT_PID=$(ps -o ppid= -p "$PM2_PID" 2>/dev/null | tr -d ' ')
    if [ -n "$PARENT_PID" ] && [ "$PARENT_PID" -gt 0 ]; then
        PARENT_CMD=$(ps -o comm= -p "$PARENT_PID" 2>/dev/null)
        echo "   Parent PID: $PARENT_PID ($PARENT_CMD)"
        if [ "$PARENT_CMD" = "systemd" ] || [ "$PARENT_CMD" = "init" ]; then
            print_info "PM2 is under systemd - check the PM2 unit (see section 6)"
        elif [ "$PARENT_CMD" = "sshd" ] || echo "$PARENT_CMD" | grep -q "sshd"; then
            print_warning "PM2 may be running under SSH - if session dies, PM2 can get SIGHUP"
            ACTION_ITEMS+=("Run PM2 under systemd: pm2 startup && pm2 save (so it survives SSH disconnect)")
        else
            echo "   Full parent: $(ps -p "$PARENT_PID" -o args= 2>/dev/null || true)"
        fi
    fi
    if command -v pstree &>/dev/null; then
        echo "   Process tree:"
        pstree -p "$PM2_PID" 2>/dev/null || pstree "$PM2_PID" 2>/dev/null || true
    fi
else
    print_warning "PM2 does not appear to be running"
fi

# ============================================================================
# 3. CRON - User and root, and /etc/cron.d
# ============================================================================
print_header "3. Cron (schedule that could kill PM2 every ~90s)"
CRON_FOUND=0
if crontab -l 2>/dev/null | grep -E "pm2|node|restart|kill|aquatech"; then
    print_warning "Current user crontab contains PM2/node/restart/kill:"
    crontab -l | grep -E "pm2|node|restart|kill|aquatech" || true
    CRON_FOUND=1
fi
if sudo crontab -l 2>/dev/null | grep -E "pm2|node|restart|kill|aquatech"; then
    print_warning "Root crontab contains PM2/node/restart/kill:"
    sudo crontab -l | grep -E "pm2|node|restart|kill|aquatech" || true
    CRON_FOUND=1
fi
if [ -d /etc/cron.d ]; then
    for f in /etc/cron.d/*; do
        [ -f "$f" ] || continue
        if grep -qE "pm2|node|restart|aquatech" "$f" 2>/dev/null; then
            print_warning "File $f references pm2/node/restart:"
            grep -E "pm2|node|restart|aquatech" "$f" || true
            CRON_FOUND=1
        fi
    done
fi
if [ $CRON_FOUND -eq 0 ]; then
    print_success "No cron entries found that clearly target PM2/node/restart"
else
    ACTION_ITEMS+=("Remove or reschedule cron that runs pm2 restart/kill (crontab -e or edit /etc/cron.d)")
fi

# ============================================================================
# 4. SYSTEMD - PM2 unit and timers
# ============================================================================
print_header "4. Systemd (PM2 unit and timers)"
if command -v systemctl &>/dev/null; then
    PM2_UNIT=$(systemctl list-units --all --no-legend 2>/dev/null | grep -i pm2 | awk '{print $1}' | head -1)
    if [ -n "$PM2_UNIT" ]; then
        print_info "PM2 unit: $PM2_UNIT"
        echo "   Content (systemctl cat $PM2_UNIT):"
        systemctl cat "$PM2_UNIT" 2>/dev/null | sed 's/^/   /' || true
        # Check for Restart=, WatchdogSec, TimeoutStopSec that could cause restarts
        if systemctl show "$PM2_UNIT" 2>/dev/null | grep -E "Restart=|WatchdogSec|TimeoutStopSec"; then
            echo ""
            print_warning "Unit has Restart/Watchdog/Timeout - may restart PM2 under certain conditions"
            ACTION_ITEMS+=("Review systemd unit $PM2_UNIT: Restart=, WatchdogSec, TimeoutStopSec")
        fi
    else
        print_info "No PM2 systemd unit found (PM2 may be started manually or by another method)"
    fi
    echo ""
    echo "   All timers (systemctl list-timers --all):"
    systemctl list-timers --all --no-pager 2>/dev/null | head -20 || true
else
    print_warning "systemctl not available"
fi

# ============================================================================
# 4b. SELinux (PM2 pid file - systemd Permission denied)
# ============================================================================
print_header "4b. SELinux (PM2 pid file access)"
SELINUX_PM2_FOUND=0
if command -v getenforce &>/dev/null && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
    print_info "SELinux is Enforcing - checking for PM2 pid file denials..."
    if command -v journalctl &>/dev/null; then
        if journalctl --since "24 hours ago" 2>/dev/null | grep -qE "pm2\.pid|PM2.*pid.*Permission denied|SELinux is preventing systemd.*pm2\.pid"; then
            print_error "SELinux is blocking systemd from reading PM2 pid file - can cause restarts"
            echo "   Recent journal lines:"
            journalctl --since "24 hours ago" 2>/dev/null | grep -iE "pm2\.pid|selinux.*systemd.*pm2" | tail -5 | sed 's/^/   /'
            SELINUX_PM2_FOUND=1
            ACTION_ITEMS+=("Fix SELinux for PM2: see MANUAL_FIXES.md 'SELinux: PM2 pid file' (restorecon or audit2allow)")
        fi
    fi
    if [ $SELINUX_PM2_FOUND -eq 0 ]; then
        print_success "No PM2 pid file SELinux denials found in journal"
    fi
else
    print_info "SELinux not enforcing or getenforce not available"
fi

# ============================================================================
# 5. MEMORY & RESOURCES
# ============================================================================
print_header "5. Memory and resources"
echo "Memory:"
free -h 2>/dev/null || true
echo ""
echo "Top processes by memory:"
ps aux --sort=-%mem 2>/dev/null | head -8 || true
MEM_AVAILABLE=$(free -m 2>/dev/null | awk 'NR==2{printf "%.0f", $7}')
[ -n "$MEM_AVAILABLE" ] && [ "$MEM_AVAILABLE" -lt 500 ] && ACTION_ITEMS+=("Low memory (${MEM_AVAILABLE}MB available) - add swap or RAM")

# ============================================================================
# 6. PM2 LOGS (killed / signal)
# ============================================================================
print_header "6. PM2 logs (killed / signal)"
PM2_LOG_DIR="${PM2_HOME:-$HOME/.pm2}/logs"
if [ -d "$PM2_LOG_DIR" ]; then
    if find "$PM2_LOG_DIR" -name "*.log" -type f -exec grep -l "pm2 has been killed\|process killed" {} \; 2>/dev/null | head -3; then
        print_warning "PM2 logs contain 'killed by signal' / 'process killed'"
    else
        print_success "No 'killed by signal' in recent PM2 log names checked"
    fi
else
    print_info "PM2 log dir not found: $PM2_LOG_DIR"
fi

# ============================================================================
# 7. JOURNAL (system logs)
# ============================================================================
print_header "7. System journal (PM2/signal/kill)"
if command -v journalctl &>/dev/null; then
    journalctl --since "2 hours ago" 2>/dev/null | grep -i "pm2\|killed\|signal\|sigterm" | tail -15 || echo "No matching lines"
else
    print_warning "journalctl not available"
fi

# ============================================================================
# 8. LÍMITES (ulimit)
# ============================================================================
print_header "8. Resource limits (ulimit)"
ulimit -a 2>/dev/null || true

# ============================================================================
# 9. CHECKLIST & ACTION REQUIRED (manual fixes)
# ============================================================================
print_header "9. Checklist & action required (manual fixes)"
echo "Apply these on the droplet as needed. See also: src/docs/MANUAL_FIXES.md"
echo ""
if [ ${#ACTION_ITEMS[@]} -eq 0 ]; then
    print_success "No automatic action items detected from this run."
    echo "If PM2 is still being killed, ensure:"
    echo "  - PM2 runs under systemd (pm2 startup && pm2 save)"
    echo "  - No cron runs 'pm2 restart' or 'kill' on a short interval"
    echo "  - No watchdog/timer restarts the PM2 service unnecessarily"
else
    print_warning "Action items (fix on server):"
    for i in "${!ACTION_ITEMS[@]}"; do
        echo "  $((i+1)). ${ACTION_ITEMS[$i]}"
    done
fi
echo ""
print_info "Code fixes already applied in repo: SIGTERM handler in API + PostgreSQL pool close on SIGTERM."
print_info "Deploy and run this script on the droplet, then address the action items above."
echo ""
