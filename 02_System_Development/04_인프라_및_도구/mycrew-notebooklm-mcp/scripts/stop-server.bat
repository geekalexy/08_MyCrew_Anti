@echo off
REM Arrête le serveur NotebookLM MCP
taskkill /F /FI "WINDOWTITLE eq node*http-wrapper*" 2>nul
taskkill /F /FI "IMAGENAME eq node.exe" /FI "MEMUSAGE gt 100000" 2>nul
echo Serveur arrêté.
