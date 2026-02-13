@echo off
echo ===================================================
echo   AUDITCB EMAIL SYSTEM DEPLOYMENT
echo ===================================================

echo.
echo 1. Checking Supabase Login Status...
call npx supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] You are not logged in to Supabase.
    echo Please run the following command in your terminal and follow the browser instructions:
    echo.
    echo     npx supabase login
    echo.
    echo After logging in, run this script again.
    pause
    exit /b 1
)

echo.
echo 2. Linking Project (dfzisgfpstrsyncfsxyb)...
call npx supabase link --project-ref dfzisgfpstrsyncfsxyb
if %errorlevel% neq 0 (
    echo [WARNING] Link might have failed or is already linked. Continuing...
)

echo.
echo 3. Setting Secrets...
echo.
echo IMPORTANT: You will be prompted to enter your Resend API Key
echo Get your API key from: https://resend.com/api-keys
echo.
set /p RESEND_API_KEY=Enter Resend API Key: 
if "%RESEND_API_KEY%"=="" (
    echo [ERROR] Resend API Key is required.
    pause
    exit /b 1
)
call npx supabase secrets set RESEND_API_KEY=%RESEND_API_KEY%
if %errorlevel% neq 0 (
    echo [ERROR] Failed to set secrets.
    pause
    exit /b 1
)

echo.
echo 4. Deploying 'send-email' function...
call npx supabase functions deploy send-email --no-verify-jwt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to deploy send-email.
    pause
    exit /b 1
)

echo.
echo 5. Deploying 'invite-user' function...
call npx supabase functions deploy invite-user --no-verify-jwt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to deploy invite-user.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   DEPLOYMENT SUCCESSFUL!
echo ===================================================
echo.
pause
