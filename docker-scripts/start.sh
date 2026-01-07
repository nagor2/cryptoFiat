#!/bin/bash
# Скрипт запуска Docker контейнера с Hardhat

echo "🚀 Запуск Docker контейнера с Hardhat..."

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден. Создаём из шаблона..."
    cp env.template .env
    echo "✅ Создан файл .env. Пожалуйста, отредактируйте его при необходимости."
fi

# Сборка и запуск контейнера
docker compose up -d --build

echo "✅ Docker контейнер запущен!"
echo ""
echo "📝 Доступные команды:"
echo "   docker compose logs -f hardhat    # Просмотр логов"
echo "   docker compose exec hardhat bash  # Подключиться к контейнеру"
echo "   docker compose down               # Остановить контейнер"
echo ""
echo "🌐 Доступные порты:"
echo "   http://localhost:8545 - Hardhat Network"
echo "   http://localhost:8546 - Ganache (опционально)"
echo ""
echo "💡 Примеры команд внутри контейнера:"
echo "   npx hardhat compile               # Компиляция контрактов"
echo "   npx hardhat test                  # Запуск тестов"
echo "   npx hardhat node                  # Запуск локальной ноды"
echo "   npx hardhat console --network localhost  # Консоль Hardhat"

