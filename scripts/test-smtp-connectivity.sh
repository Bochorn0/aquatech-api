#!/bin/bash
# Test SMTP connectivity from the server
# This script helps diagnose network/firewall issues

echo "============================================================"
echo "🔌 SMTP Connectivity Test"
echo "============================================================"
echo ""

# Test Gmail SMTP
echo "Testing Gmail SMTP (smtp.gmail.com:587)..."
if timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.gmail.com/587' 2>/dev/null; then
    echo "✅ Port 587: OPEN"
else
    echo "❌ Port 587: BLOCKED or TIMEOUT"
fi

# Test Gmail SMTP SSL
echo "Testing Gmail SMTP SSL (smtp.gmail.com:465)..."
if timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.gmail.com/465' 2>/dev/null; then
    echo "✅ Port 465: OPEN"
else
    echo "❌ Port 465: BLOCKED or TIMEOUT"
fi

# Test Office365 SMTP
echo ""
echo "Testing Office365 SMTP (smtp.office365.com:587)..."
if timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.office365.com/587' 2>/dev/null; then
    echo "✅ Port 587: OPEN"
else
    echo "❌ Port 587: BLOCKED or TIMEOUT"
fi

# Test with nc if available
echo ""
echo "Testing with netcat (if available)..."
if command -v nc &> /dev/null; then
    echo "Testing smtp.gmail.com:587..."
    nc -zv -w 5 smtp.gmail.com 587 2>&1 | head -1
    echo "Testing smtp.gmail.com:465..."
    nc -zv -w 5 smtp.gmail.com 465 2>&1 | head -1
else
    echo "⚠️  netcat (nc) not installed. Install with: yum install nc"
fi

# Check firewall status
echo ""
echo "============================================================"
echo "🔥 Firewall Status"
echo "============================================================"
if command -v firewall-cmd &> /dev/null; then
    echo "Firewall services:"
    firewall-cmd --list-services 2>/dev/null | grep -E "(smtp|smtps)" || echo "  ⚠️  SMTP services not found in allowed services"
    echo ""
    echo "Firewall ports:"
    firewall-cmd --list-ports 2>/dev/null | grep -E "(587|465)" || echo "  ⚠️  Ports 587/465 not found in allowed ports"
else
    echo "⚠️  firewall-cmd not found (firewalld may not be installed)"
fi

# Check iptables
if command -v iptables &> /dev/null; then
    echo ""
    echo "Checking iptables rules for SMTP..."
    iptables -L OUTPUT -n | grep -E "(587|465|smtp)" || echo "  No specific SMTP rules found in OUTPUT chain"
fi

echo ""
echo "============================================================"
echo "💡 Recommendations"
echo "============================================================"
echo "If all ports are blocked:"
echo "  1. Configure firewall to allow outbound SMTP:"
echo "     sudo firewall-cmd --permanent --add-service=smtp"
echo "     sudo firewall-cmd --permanent --add-service=smtps"
echo "     sudo firewall-cmd --reload"
echo ""
echo "  2. Or use SendGrid API (bypasses SMTP ports):"
echo "     Set EMAIL_PROVIDER=sendgrid in .env"
echo "     Get API key from https://sendgrid.com"
echo ""
echo "  3. Try port 465 with SSL:"
echo "     SMTP_PORT=465"
echo "     SMTP_SECURE=true"
