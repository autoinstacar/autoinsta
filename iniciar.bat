@echo off
title InstaAssist Local - Assistente de Comentarios do Instagram
echo ============================================================
echo   Iniciando InstaAssist Local (Backend + Interface Web)
echo ============================================================
echo.
start http://localhost:5173
npm run dev
pause
