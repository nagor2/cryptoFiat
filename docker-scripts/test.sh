#!/bin/bash
echo "🧪 Запуск тестов Hardhat..."
docker compose exec hardhat npm run test
if [ $? -eq 0 ]; then
    echo "✅ Тесты успешно выполнены!"
else
    echo "❌ Ошибка при выполнении тестов."
    exit 1
fi
