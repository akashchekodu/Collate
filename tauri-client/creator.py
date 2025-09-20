# Create a minimal build script
minimal_build_script = '''#!/bin/bash
# minimal-build.sh - Build the simple desktop app

echo "🏗️  Building Simple P2P Notebook Desktop App"
echo "============================================"

# Clean first
echo "🧹 Cleaning previous builds..."
cargo clean

echo ""
echo "🦀 Building Rust desktop app..."

# Build the app
if cargo tauri build; then
    echo ""
    echo "🎉 SUCCESS! Desktop app built successfully!"
    echo ""
    echo "📦 Your app is ready in src-tauri/target/release/bundle/"
    echo ""
    echo "🚀 To run in development mode:"
    echo "   cargo tauri dev"
    echo ""
    echo "✅ What you have now:"
    echo "   - Native desktop application"
    echo "   - Simple document editor" 
    echo "   - Basic UI with placeholders"
    echo "   - Ready for P2P features"
    echo "   - Ready for authentication"
else
    echo ""
    echo "❌ Build failed. Check the error above."
    echo ""
    echo "🔧 Common fixes:"
    echo "   1. Make sure you're in the project root"
    echo "   2. Run: rustup update"
    echo "   3. Run: cargo install @tauri-apps/cli@^2.0.0"
    echo "   4. Check system dependencies (Linux)"
fi
'''

with open('minimal-build.sh', 'w') as f:
    f.write(minimal_build_script)

import os
os.chmod('minimal-build.sh', 0o755)

print("✓ Created minimal-build.sh")

# Create Windows version
minimal_build_bat = '''@echo off
REM minimal-build.bat - Build the simple desktop app

echo 🏗️  Building Simple P2P Notebook Desktop App
echo ============================================

REM Clean first
echo 🧹 Cleaning previous builds...
cargo clean

echo.
echo 🦀 Building Rust desktop app...

REM Build the app
cargo tauri build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 🎉 SUCCESS! Desktop app built successfully!
    echo.
    echo 📦 Your app is ready in src-tauri/target/release/bundle/
    echo.
    echo 🚀 To run in development mode:
    echo    cargo tauri dev
    echo.
    echo ✅ What you have now:
    echo    - Native desktop application
    echo    - Simple document editor
    echo    - Basic UI with placeholders
    echo    - Ready for P2P features
    echo    - Ready for authentication
) else (
    echo.
    echo ❌ Build failed. Check the error above.
    echo.
    echo 🔧 Common fixes:
    echo    1. Make sure you're in the project root
    echo    2. Run: rustup update
    echo    3. Run: cargo install @tauri-apps/cli@^2.0.0
    echo    4. Restart command prompt as administrator
)

pause
'''

with open('minimal-build.bat', 'w') as f:
    f.write(minimal_build_bat)

print("✓ Created minimal-build.bat")