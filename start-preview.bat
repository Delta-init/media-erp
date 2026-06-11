@echo off
cd /d "C:\Users\MSI-PC\Delta\mediaERP\frontend"
node node_modules\next\dist\bin\next dev --webpack %*
