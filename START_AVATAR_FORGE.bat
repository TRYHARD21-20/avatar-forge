@echo off
setlocal
cd /d "%~dp0"
title Avatar Forge - Launcher
color 0E
echo.
echo ==========================================================
echo                 AVATAR FORGE  ^|  START
 echo ==========================================================
echo.
where node >nul 2>&1
if errorlevel 1 goto nodeMissing
where npm >nul 2>&1
if errorlevel 1 goto nodeMissing
for /f "delims=" %%v in ('node --version') do echo Node installed: %%v
echo.
REM Framer Motion 12.23.3 needs older motion-dom / motion-utils exports.
REM Detect and repair older installed dependency trees automatically.
node -e "try { var f = require('./node_modules/framer-motion/package.json').version; var d = require('./node_modules/motion-dom/package.json').version; var u = require('./node_modules/motion-utils/package.json').version; process.exit(f === '12.23.3' && d === '12.23.2' && u === '12.23.2' ? 0 : 1); } catch (_) { process.exit(1); }"
if errorlevel 1 (
  echo Repairing incompatible animation dependencies or installing for first run...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto installFailed
)
echo Checking dependency compatibility...
node -e "try { var f = require('./node_modules/framer-motion/package.json').version; var d = require('./node_modules/motion-dom/package.json').version; var u = require('./node_modules/motion-utils/package.json').version; console.log('Animation packages: framer-motion ' + f + ', motion-dom ' + d + ', motion-utils ' + u); process.exit(f === '12.23.3' && d === '12.23.2' && u === '12.23.2' ? 0 : 1); } catch (_) { process.exit(1); }"
if errorlevel 1 goto mismatch
echo.
echo Starting app and API in a NEW terminal window...
start "Avatar Forge - Dev Server" /D "%CD%" cmd /k "npm run dev"
echo Waiting for the frontend to respond at http://localhost:5173 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; 1..35 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173/' -TimeoutSec 2; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch { } ; Start-Sleep -Seconds 2 }; if ($ok) { Start-Process 'http://localhost:5173/'; Write-Host 'App opened in your browser.' } else { Write-Host 'Server was not reachable; check errors in the other terminal window.' }"
echo.
echo If the page stays blank, press F12 in Chrome ^> Console and read the FIRST red error.
echo You may use OPEN_PREVIEW.html for an offline visual preview.
pause
exit /b 0
:mismatch
echo ERROR: Motion packages still do not match.
echo Try: npm install
pause
exit /b 1
:nodeMissing
echo ERROR: Node.js and npm must be installed first.
echo Install Node.js 22 LTS from https://nodejs.org/
echo Restart VS Code, then double-click this script again.
pause
exit /b 1
:installFailed
echo.
echo ERROR: npm install did not complete.
echo Check your internet connection and npm's error message ABOVE.
echo The app cannot display until installation succeeds.
pause
exit /b 1
