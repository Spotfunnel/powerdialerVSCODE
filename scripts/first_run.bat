@echo off
echo [Power Dialer] Starting first-run setup...

echo [Power Dialer] Installing dependencies...
call npm install

echo [Power Dialer] Generating Prisma client...
call npx prisma generate

echo [Power Dialer] Pushing database schema...
call npx prisma db push

echo [Power Dialer] Initializing environment...
if not exist .env (
    copy .env.example .env
    echo [Power Dialer] Created .env from example. PLEASE UPDATE IT.
)

echo [Power Dialer] Setup complete! 
echo 1. Update .env with your DATABASE_URL and ENCRYPTION_KEY.
echo 2. Run 'npm run dev' to start.
echo 3. Visit http://localhost:3000/setup to finish configuration.
pause
