#!/bin/bash

# Environment Setup Verification Script for React Native Expo App
# This script checks if all required tools are installed

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   React Native Expo - Environment Setup Verification      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Flag to track if all checks pass
ALL_PASS=true

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js is installed: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js is NOT installed"
    echo "  Install from: https://nodejs.org"
    ALL_PASS=false
fi

# Check npm
echo ""
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm is installed: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm is NOT installed"
    echo "  Install Node.js from: https://nodejs.org"
    ALL_PASS=false
fi

# Check Expo CLI
echo ""
echo "Checking Expo CLI..."
if command -v expo &> /dev/null; then
    EXPO_VERSION=$(expo --version)
    echo -e "${GREEN}✓${NC} Expo CLI is installed: $EXPO_VERSION"
else
    echo -e "${YELLOW}!${NC} Expo CLI is NOT installed globally"
    echo "  Install with: npm install -g expo-cli"
    echo "  Note: You can also use: npx expo <command>"
fi

# Check if node_modules exists
echo ""
echo "Checking project dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${YELLOW}!${NC} node_modules directory NOT found"
    echo "  Run: npm install"
    ALL_PASS=false
fi

# Check for Android SDK (optional)
echo ""
echo "Checking Android SDK (optional)..."
if command -v adb &> /dev/null; then
    echo -e "${GREEN}✓${NC} Android SDK is installed (ADB found)"
else
    echo -e "${YELLOW}!${NC} Android SDK is NOT installed"
    echo "  Required for local builds, but not for Expo development"
    echo "  Install from: https://developer.android.com/studio"
fi

# Check for Java (optional)
echo ""
echo "Checking Java (optional)..."
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | grep version | awk -F'"' '{print $2}')
    echo -e "${GREEN}✓${NC} Java is installed: $JAVA_VERSION"
else
    echo -e "${YELLOW}!${NC} Java is NOT installed"
    echo "  Required for Android builds"
    echo "  Install from: https://www.oracle.com/java/technologies/downloads/"
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
if [ "$ALL_PASS" = true ]; then
    echo -e "║ ${GREEN}✓ All required tools are installed!${NC}                   ║"
else
    echo -e "║ ${RED}✗ Some required tools are missing${NC}                   ║"
fi
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Next steps
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ ! -d "node_modules" ]; then
    echo "1. Install dependencies:"
    echo "   npm install"
    echo ""
fi

echo "2. Start the development server:"
echo "   npm start"
echo ""
echo "3. Choose your platform:"
echo "   - Press 'a' for Android"
echo "   - Press 'w' for Web"
echo "   - Press 'i' for iOS (macOS only)"
echo ""
echo "For more information, see README.md"
