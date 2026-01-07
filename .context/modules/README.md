# 📚 CryptoFiat Project - Context Modules

## 🎯 Обзор

Модули СЛК системы для проекта CryptoFiat, содержащие знания о смарт-контрактах и их тестировании.

## 📦 Доступные модули

### 🔧 contracts_architecture.json
**Архитектура смарт-контрактов CryptoFiat**

Содержит полное описание всех контрактов системы:
- **INTDAO** - децентрализованная автономная организация
- **CDP** - система залоговых позиций (Collateralized Debt Position)
- **flatCoin** - основной стейблкоин (DFC)
- **Rule** - governance токен (RLE)
- **Auction** - система аукционов
- **DepositContract** - депозиты с процентами
- **exchangeRateContract** - оракул цен
- **basketContract** - корзина commodities

Включает:
- ✅ Основные функции каждого контракта
- ✅ События (events)
- ✅ Параметры системы
- ✅ Порядок деплоя с future address
- ✅ Авторизационные потоки
- ✅ Критические заметки для тестирования

### 🧪 tests_structure.json
**Структура и стандарты тестирования Hardhat**

Содержит информацию о всех тестах:
- **90 тестов** в 15 файлах (100% покрытие)
- Структура каждого теста
- Критические проверки
- Паттерны тестирования
- Стандарты assertion (delta = 0.01)
- Хелпер функции (contracts.js)
- Команды запуска

## 🚀 Автозагрузка

Эти модули **автоматически загружаются** при старте СЛК в проекте CryptoFiat:

```bash
# Команда "слк старт" автоматически загружает:
.context/modules/contracts_architecture.json
.context/modules/tests_structure.json
```

## 📖 Использование

### Загрузка контекста контрактов
```bash
слк контракты
```

### Информация о конкретном контракте
Модуль содержит детали по каждому контракту:
- Путь к файлу
- Описание и функциональность
- Основные функции с параметрами
- События
- Важные параметры

### Информация о тестах
Для каждого теста описано:
- Количество тестов
- Покрытие (coverage)
- Ключевые проверки
- Критические расчеты
- Примеры использования

## 🏗️ Структура проекта

```
contracts/
├── INTDAO.sol              # DAO контракт
├── CDP.sol                 # Залоговые позиции
├── flatCoin.sol            # Стейблкоин DFC
├── Rule.sol                # Governance токен RLE
├── Auction.sol             # Аукционная система
├── DepositContract.sol     # Депозиты
├── exchangeRateContract.sol # Оракул
└── basketContract.sol      # Корзина

test/
├── helpers/
│   └── contracts.js        # Хелпер для деплоя
├── flatCoin-hardhat.test.js
├── rule-hardhat.test.js
├── cdp-hardhat.test.js
├── cdpUpdateIncrease-hardhat.test.js
├── cdpUpdateDecrease-hardhat.test.js
├── cdpWithdrawAndClose-hardhat.test.js
├── cdpFee-hardhat.test.js
├── cdpMarginCall-hardhat.test.js
├── cdpSeveralAuctionsToClose-hardhat.test.js
├── deposit-hardhat.test.js
├── dao-hardhat.test.js
├── auction-hardhat.test.js
├── auctionStubFund-hardhat.test.js
├── exchangeRate-hardhat.test.js
└── basket-hardhat.test.js
```

## 🎯 Ключевые концепции

### Future Address Calculation
Используется для разрешения циркулярных зависимостей:
```javascript
const futureDAOAddress = ethers.getCreateAddress({
  from: deployer.address,
  nonce: await deployer.getNonce() + 4
});
```

### Precision Testing
Все числовые проверки используют `closeTo` с delta = 0.01:
```javascript
expect(Number(ethers.formatEther(value))).to.be.closeTo(expected, 0.01);
```

### Deployment Order
1. Rule (с future DAO address)
2. FlatCoin (с future DAO address)
3. CDP (с future DAO address)
4. Auction (с future DAO address)
5. Deposit (с future DAO address)
6. Oracle (с future DAO address)
7. Basket (с future DAO address)
8. INTDAO (с адресами всех контрактов)
9. renewContracts() на всех контрактах

## 📊 Статистика

- **Всего контрактов:** 8 основных
- **Всего тестов:** 90 (100% проходят)
- **Тестовых файлов:** 15
- **Фреймворк:** Hardhat + Ethers.js v6
- **Среднее время выполнения:** 3-4 секунды

## 🔗 Связанные файлы

- `.context/modules/core/manifest.json` - главный манифест СЛК
- `.context/modules/core/standards.json` - стандарты кодирования
- `hardhat.config.js` - конфигурация Hardhat
- `package.json` - зависимости проекта
- `docker-compose.yml` - Docker окружение

## 💡 Подсказки для AI

При работе с контрактами и тестами:

1. **Всегда используй future address** для DAO при деплое
2. **Вызывай renewContracts()** после деплоя DAO
3. **Используй delta = 0.01** для всех closeTo проверок
4. **Помни об oracleAuthor** для обновления цен
5. **Передавай 1% Rule токенов** перед initRuleBuyOut
6. **Проверяй события** через manual parsing (не withArgs)

## 📚 Дополнительная информация

Для более детальной информации смотри JSON модули:
- `contracts_architecture.json` - полная спецификация контрактов
- `tests_structure.json` - полная спецификация тестов

---

**Версия:** 1.0.0  
**Дата создания:** 2025-01-07  
**Проект:** CryptoFiat - Decentralized Stablecoin System

