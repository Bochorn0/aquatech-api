#!/bin/bash
# Test port 2525 connectivity and firewall configuration

echo "============================================================"
echo "🔌 Testing Port 2525 Connectivity"
echo "============================================================"
echo ""

# Test if port 2525 is accessible
echo "Testing port 2525 connectivity..."
echo ""

# Test Gmail SMTP on 2525 (if supported)
echo "1. Testing smtp.gmail.com:2525..."
if timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.gmail.com/2525' 2>/dev/null; then
    echo "   ✅ Port 2525: OPEN to Gmail"
else
    echo "   ❌ Port 2525: BLOCKED or Gmail doesn't support it"
fi

# Test Mailgun SMTP on 2525
echo ""
echo "2. Testing smtp.mailgun.org:2525..."
if timeout 5 bash -c 'cat < /dev/null > /dev/tcp/smtp.mailgun.org/2525' 2>/dev/null; then
    echo "   ✅ Port 2525: OPEN to Mailgun"
else
    echo "   ❌ Port 2525: BLOCKED or timeout"
fi

# Test with netcat if available
echo ""
if command -v nc &> /dev/null; then
    echo "3. Testing with netcat..."
    echo "   Testing smtp.mailgun.org:2525..."
    nc -zv -w 5 smtp.mailgun.org 2525 2>&1 | head -1
else
    echo "3. netcat (nc) not installed. Install with: yum install nc"
fi

echo ""
echo "============================================================"
echo "🔥 Checking Firewall Configuration"
echo "============================================================"
echo ""

if command -v firewall-cmd &> /dev/null; then
    echo "Current firewall rules for port 2525:"
    firewall-cmd --list-ports 2>/dev/null | grep -E "2525" || echo "  ⚠️  Port 2525 not found in allowed ports"
    
    echo ""
    echo "Current firewall services:"
    firewall-cmd --list-services 2>/dev/null | grep -E "(smtp|mail)" || echo "  ⚠️  SMTP services not found"
    
    echo ""
    echo "💡 To add port 2525 to firewall (if needed):"
    echo "   sudo firewall-cmd --permanent --add-port=2525/tcp"
    echo "   sudo firewall-cmd --reload"
    echo "   sudo firewall-cmd --list-ports  # Verify"
else
    echo "⚠️  firewall-cmd not found (firewalld may not be installed)"
fi

echo ""
echo "============================================================"
echo "💡 Recommendations"
echo "============================================================"
echo ""
echo "If port 2525 is blocked:"
echo "  → Use Mailgun API (already working, no ports needed)"
echo "  → Verify your domain in Mailgun to send to any email"
echo ""
echo "If port 2525 works:"
echo "  → You can use Mailgun SMTP on port 2525"
echo "  → Or try Gmail SMTP on 2525 (if Gmail supports it)"
echo ""
