#!/bin/bash
# Скрипт запуска локальной Hardhat ноды

echo "🌐 Запуск локальной Hardhat ноды..."
echo "Нода будет доступна на http://localhost:8545"
echo "Нажмите Ctrl+C для остановки"
echo ""

docker compose exec hardhat npx hardhat node

