@echo off
echo ================================================
echo        Maps Business Finder - Inicializador
echo ================================================
echo.

REM Verifica se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

REM Mostra a versão do Node.js
echo [INFO] Verificando Node.js...
node --version

REM Verifica se npm está disponível
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] npm nao encontrado!
    pause
    exit /b 1
)

echo [INFO] Verificando npm...
npm --version
echo.

REM Verifica se node_modules existe
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar dependencias!
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Iniciando Maps Business Finder...
echo [INFO] Servidor será executado em: http://localhost:3000
echo [INFO] Pressione Ctrl+C para parar o servidor
echo.

REM Inicia a aplicação
npm start

pause