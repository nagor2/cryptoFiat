# Docker окружение для разработки с Hardhat

## 🎯 Что это?

Docker контейнер для разработки Ethereum смарт-контрактов с поддержкой:
- ✅ **Hardhat** - современный фреймворк для разработки
- ✅ **Truffle** - совместимость с существующим кодом
- ✅ **Ganache** - локальный blockchain для тестирования
- ✅ **Node.js 18** - стабильная LTS версия
- ✅ **Все необходимые инструменты** - ethers.js, waffle, coverage и т.д.

## 🚀 Быстрый старт

### 1. Подготовка

```bash
# Создайте .env файл из шаблона
cp env.template .env

# Отредактируйте .env при необходимости
nano .env
```

### 2. Запуск

```bash
# Сделайте скрипты исполняемыми (один раз)
chmod +x docker-scripts/*.sh

# Запустите контейнер
./docker-scripts/start.sh
```

### 3. Подключение к контейнеру

```bash
# Откройте bash внутри контейнера
./docker-scripts/shell.sh
```

## 📝 Доступные скрипты

### Управление контейнером

```bash
./docker-scripts/start.sh    # Запустить контейнер
./docker-scripts/stop.sh     # Остановить контейнер
./docker-scripts/shell.sh    # Подключиться к контейнеру
```

### Работа с Hardhat

```bash
./docker-scripts/compile.sh  # Скомпилировать контракты
./docker-scripts/test.sh     # Запустить тесты
./docker-scripts/node.sh     # Запустить локальную ноду
```

## 🛠️ Команды внутри контейнера

После подключения к контейнеру (`./docker-scripts/shell.sh`) доступны:

### Hardhat команды

```bash
# Компиляция контрактов
npx hardhat compile

# Очистка артефактов
npx hardhat clean

# Запуск тестов
npx hardhat test
npx hardhat test test/specific-test.js  # Конкретный тест

# Запуск локальной ноды
npx hardhat node

# Консоль Hardhat
npx hardhat console --network localhost

# Запуск скриптов
npx hardhat run scripts/deploy.js --network localhost

# Coverage (покрытие кода тестами)
npx hardhat coverage

# Gas reporter (отчёт по газу)
REPORT_GAS=true npx hardhat test

# Верификация контракта на Etherscan
npx hardhat verify --network goerli <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Truffle команды (совместимость)

```bash
# Компиляция
truffle compile

# Миграции
truffle migrate --network development

# Тесты
truffle test

# Консоль
truffle console --network development
```

## 🌐 Доступные сети

### Локальные

- **Hardhat Network** - `http://localhost:8545`
- **Ganache** - `http://localhost:8546` (опционально)

### Тестовые сети

- **Goerli** - Ethereum testnet
- **Sepolia** - Ethereum testnet (новый)
- **Mumbai** - Polygon testnet

### Mainnet

- **Ethereum Mainnet**
- **Polygon Mainnet**

Настройка сетей в файле `hardhat.config.js`

## 📂 Структура проекта

```
cryptoFiat/
├── contracts/           # Solidity смарт-контракты
├── test/               # Тесты (Hardhat/Truffle)
├── scripts/            # Скрипты развертывания
├── migrations/         # Truffle миграции
├── artifacts/          # Скомпилированные контракты
├── cache/              # Кэш Hardhat
├── docker-scripts/     # Утилиты Docker
├── Dockerfile          # Конфигурация Docker образа
├── docker-compose.yml  # Конфигурация Docker Compose
├── hardhat.config.js   # Конфигурация Hardhat
├── truffle-config.js   # Конфигурация Truffle
└── .env                # Переменные окружения (не коммитится!)
```

## 🔧 Конфигурация

### Переменные окружения (.env)

```bash
# Private keys (НИКОГДА НЕ КОММИТЬТЕ!)
PRIVATE_KEY=your_private_key_here

# RPC URLs
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_KEY
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY

# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key

# Options
REPORT_GAS=false
```

### Получение API ключей

- **Infura**: https://infura.io/ (бесплатный plan)
- **Etherscan**: https://etherscan.io/apis (бесплатный)
- **PolygonScan**: https://polygonscan.com/apis (бесплатный)
- **CoinMarketCap**: https://coinmarketcap.com/api/ (для gas reporter)

## 🐛 Отладка и логи

```bash
# Просмотр логов контейнера
docker-compose logs -f hardhat

# Просмотр логов Ganache
docker-compose logs -f ganache

# Перезапуск контейнера
docker-compose restart hardhat

# Полная пересборка
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 💡 Полезные советы

### 1. Работа с accounts

```javascript
// В скрипте Hardhat
const [deployer, user1, user2] = await ethers.getSigners();
console.log("Deploying with:", deployer.address);
```

### 2. Подключение к локальной ноде из dApp

```javascript
// В вашем frontend
const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
```

### 3. Использование разных сетей

```bash
# Компиляция и деплой на Goerli
npx hardhat run scripts/deploy.js --network goerli

# Тесты на конкретной сети
npx hardhat test --network localhost
```

### 4. Проверка баланса аккаунтов

```bash
npx hardhat console --network localhost

# В консоли
const [account] = await ethers.getSigners();
const balance = await account.getBalance();
console.log(ethers.utils.formatEther(balance));
```

## 🔥 Часто используемые команды

```bash
# Запуск всего стека для разработки
./docker-scripts/start.sh && ./docker-scripts/shell.sh

# Компиляция + тесты
npx hardhat clean && npx hardhat compile && npx hardhat test

# Деплой на локальную ноду (в другом терминале должна быть запущена нода)
npx hardhat run scripts/deploy.js --network localhost

# Coverage с газ репортом
REPORT_GAS=true npx hardhat coverage
```

## 📚 Дополнительные ресурсы

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.io/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

## ❓ Проблемы и решения

### Порты заняты

```bash
# Проверьте, что порты свободны
lsof -i :8545
lsof -i :8546

# Или измените порты в docker-compose.yml
```

### Проблемы с node_modules

```bash
# Пересоздайте volume
docker-compose down -v
docker-compose up -d --build
```

### Ошибки компиляции

```bash
# Очистите кэш и артефакты
npx hardhat clean
rm -rf cache artifacts

# Пересоберите
npx hardhat compile
```

## 🤝 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Пересоберите контейнер: `docker-compose down && docker-compose up -d --build`
3. Проверьте конфигурацию в `.env` и `hardhat.config.js`

---

**Успешной разработки! 🚀**

