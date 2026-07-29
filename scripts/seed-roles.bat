@echo off
echo ========================================
echo   Seeding Roles and Permissions
echo ========================================
echo.

npm run prisma:seed

echo.
echo ========================================
echo   Seeding completed!
echo ========================================
pause
