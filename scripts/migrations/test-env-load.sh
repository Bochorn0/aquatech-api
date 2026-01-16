#!/bin/bash

# Test script to verify .env loading works correctly

# Load environment variables (same logic as migration script)
if [ -f .env ]; then
    TEMP_ENV=$(mktemp)
    grep -E '^(POSTGRES|TIWATER).*=' .env | grep -v '^#' > "$TEMP_ENV"
    
    echo "=== Variables found in .env (filtered) ==="
    cat "$TEMP_ENV"
    echo ""
    
    # Read from temp file
    while IFS='=' read -r key value; do
        [ -z "$key" ] && continue
        key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$value" | sed 's/^[[:space:]]*"//;s/"[[:space:]]*$//;s/^[[:space:]]*//;s/[[:space:]]*$//')
        
        if [ -n "$key" ]; then
            export "$key"="$value"
            echo "Exported: $key=${value:0:5}..."  # Show first 5 chars only
        fi
    done < "$TEMP_ENV"
    rm -f "$TEMP_ENV"
else
    echo "Error: .env file not found"
    exit 1
fi

echo ""
echo "=== Verification ==="
if [ -n "$POSTGRES_TIWATER_PASSWORD" ]; then
    echo "✓ POSTGRES_TIWATER_PASSWORD is set (length: ${#POSTGRES_TIWATER_PASSWORD})"
elif [ -n "$POSTGRES_PASSWORD" ]; then
    echo "✓ POSTGRES_PASSWORD is set (length: ${#POSTGRES_PASSWORD})"
else
    echo "✗ No password variables found"
fi
