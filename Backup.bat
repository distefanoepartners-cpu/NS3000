@echo off
echo === NS3000 BACKUP ===
set BACKUP_DIR=C:\NS3000_Backups
set DATE_TIME=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATE_TIME=%DATE_TIME: =0%
set BACKUP_PATH=%BACKUP_DIR%\NS3000_%DATE_TIME%

echo Creating backup in: %BACKUP_PATH%
mkdir "%BACKUP_PATH%"

echo Copying files...
xcopy /E /I /Y app "%BACKUP_PATH%\app"
xcopy /E /I /Y components "%BACKUP_PATH%\components"
xcopy /E /I /Y lib "%BACKUP_PATH%\lib"
xcopy /I /Y package.json "%BACKUP_PATH%\"
xcopy /I /Y next.config.ts "%BACKUP_PATH%\"

echo Backup completato!
echo Percorso: %BACKUP_PATH%
pause