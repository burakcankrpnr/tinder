@echo off
set CI=
cd /d "%~dp0.."
pnpm --filter @dating/mobile dev
