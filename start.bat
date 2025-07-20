@echo off
echo ========================================
echo    BOT WHATSAPP - IPUBI OS
echo ========================================
echo.

echo Verificando se Node.js esta instalado...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

echo Instalando dependencias...
npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo Dependencias instaladas com sucesso!
echo.

echo Iniciando o bot...
echo.
echo IMPORTANTE:
echo 1. Acesse http://localhost:3002 no navegador
echo 2. Escaneie o QR Code com seu WhatsApp
echo 3. Aguarde a conexao ser estabelecida
echo.
echo Pressione Ctrl+C para parar o bot
echo.

node webbot.js 