# 🚀 Быстрый старт с Docker + Hardhat

## За 3 шага

### 1️⃣ Создайте .env файл

```bash
cp env.template .env
```

### 2️⃣ Запустите Docker

```bash
./docker-scripts/start.sh
```

### 3️⃣ Подключитесь к контейнеру

```bash
./docker-scripts/shell.sh
```

## 🎯 Что дальше?

### Компиляция контрактов

```bash
npx hardhat compile
```

### Запуск тестов

```bash
npx hardhat test
```

### Запуск локальной ноды

```bash
npx hardhat node
```

## 📝 Полезные команды

```bash
# Из хост-системы (не заходя в контейнер)
npm run docker:compile   # Компиляция
npm run docker:test      # Тесты
npm run docker:shell     # Подключиться к контейнеру
npm run docker:stop      # Остановить контейнер

# Внутри контейнера
npx hardhat compile      # Компиляция
npx hardhat test         # Все тесты
npx hardhat test test/example-hardhat.test.js  # Один тест
npx hardhat node         # Локальная нода
npx hardhat console      # Интерактивная консоль
npx hardhat coverage     # Покрытие кода
```

## 📚 Подробная документация

См. **[DOCKER_README.md](DOCKER_README.md)** для полной документации.

## ❓ Проблемы?

```bash
# Просмотр логов
docker-compose logs -f

# Перезапуск
docker-compose restart

# Пересборка
docker-compose down
docker-compose up -d --build
```

---

**Готово! Теперь у вас есть полноценное окружение для разработки смарт-контрактов! 🎉**

