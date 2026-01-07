#!/bin/bash
echo "🔨 Компиляция смарт-контрактов Hardhat..."
docker compose exec hardhat npm run compile
if [ $? -eq 0 ]; then
    echo "✅ Контракты успешно скомпилированы!"
else
    echo "❌ Ошибка при компиляции контрактов."
    exit 1
fi
