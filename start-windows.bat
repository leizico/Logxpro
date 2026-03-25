@echo off 
echo ======================================== 
echo   Logistica Pro - Iniciando Sistema 
echo ======================================== 
echo. 
echo [1/2] Iniciando Backend... 
start "Backend" cmd /k "cd backend && node server.js" 
echo     ✅ Backend iniciado 
echo. 
timeout /t 3 /nobreak >nul 
echo [2/2] Abrindo Frontend no navegador... 
start http://localhost:3001 
echo. 
echo ======================================== 
echo   Sistema iniciado com sucesso! 
echo ======================================== 
echo. 
echo Backend: http://localhost:5000 
echo Frontend: Abra os arquivos em frontend/ 
echo. 
pause 
