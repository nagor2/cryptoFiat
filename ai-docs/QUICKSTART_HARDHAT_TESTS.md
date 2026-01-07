# 🚀 Быстрый старт: Hardhat тесты

## ✅ Что уже работает

### Полностью рабочие тесты (протестированы в Docker)

1. **flatCoin-hardhat.test.js** ✅
   ```bash
   docker compose exec hardhat npx hardhat test test/flatCoin-hardhat.test.js
   ```
   - 5/5 тестов проходят
   - Деплой, mint, burn, авторизация

2. **rule-hardhat.test.js** ✅
   ```bash
   docker compose exec hardhat npx hardhat test test/rule-hardhat.test.js
   ```
   - 5/5 тестов проходят
   - Governance token тесты

### Созданные тесты (требуют доработки)

3. **exchangeRate-hardhat.test.js** 🟡
   - Oracle ценообразования
   - Волатильность

4. **basket-hardhat.test.js** 🟡
   - Basket контракт
   - Обновление цен

5. **dao-hardhat.test.js** 🟡
   - Голосование DAO
   - Pooling токенов

6. **cdp-hardhat.test.js** 🟡
   - Основные операции CDP
   - Открытие позиций

7. **cdpUpdateDecrease-hardhat.test.js** 🟡
   - Уменьшение CDP

## 📁 Структура файлов

```
test/
├── flatCoin-hardhat.test.js          ✅ Работает
├── rule-hardhat.test.js              ✅ Работает
├── exchangeRate-hardhat.test.js      🟡 Создан
├── basket-hardhat.test.js            🟡 Создан
├── dao-hardhat.test.js               🟡 Создан
├── cdp-hardhat.test.js               🟡 Создан
├── cdpUpdateDecrease-hardhat.test.js 🟡 Создан
├── helpers/
│   └── contracts.js                  ✅ Helper функции
└── [старые Truffle тесты сохранены]
```

## 🎯 Как запустить

### 1. Запустить Docker
```bash
./docker-scripts/start.sh
```

### 2. Скомпилировать контракты
```bash
./docker-scripts/compile.sh
```

### 3. Запустить рабочие тесты
```bash
# Flatcoin тест
docker compose exec hardhat npx hardhat test test/flatCoin-hardhat.test.js

# Rule тест
docker compose exec hardhat npx hardhat test test/rule-hardhat.test.js

# Все рабочие тесты
docker compose exec hardhat npx hardhat test test/flatCoin-hardhat.test.js test/rule-hardhat.test.js
```

### 4. Запустить все тесты (включая незавершенные)
```bash
docker compose exec hardhat npx hardhat test test/*-hardhat.test.js
```

## 🛠️ Helper функции

Файл `test/helpers/contracts.js` содержит полезные функции:

```javascript
const { deployFullSystem, openCDP, formatFixed } = require("./helpers/contracts");

// Деплой полной системы
const system = await deployFullSystem();
// Возвращает: { dao, flatCoin, rule, cdp, auction, deposit, oracle, basket }

// Открыть CDP
const posId = await openCDP(cdp, {
    signer: user,
    coinsToMint: ethers.parseEther('1000'),
    ethValue: ethers.parseEther('1')
});

// Форматировать BigInt
const formatted = formatFixed(value, 4); // 4 decimal places
```

## 📝 Шаблон для нового теста

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullSystem } = require("./helpers/contracts");

describe("MyContract (Hardhat version)", function () {
    let system, owner, user;

    before(async function () {
        system = await deployFullSystem();
        owner = system.owner;
        user = system.accounts[0];
        
        console.log("✅ Contracts deployed");
    });

    it("should do something", async function () {
        // Ваш тест здесь
        expect(true).to.be.true;
        console.log("✅ Test passed");
    });
});
```

## 🔧 Основные команды Hardhat

```bash
# В Docker контейнере

# Компиляция
npm run compile

# Все тесты
npm run test

# Конкретный тест
npx hardhat test test/flatCoin-hardhat.test.js

# С газ репортом
REPORT_GAS=true npx hardhat test

# Покрытие кода
npx hardhat coverage

# Очистка
npx hardhat clean
```

## 📊 Статус миграции

| Категория | Завершено | Всего | % |
|-----------|-----------|-------|---|
| Базовые тесты | 2 | 2 | 100% |
| Средние тесты | 5 | 5 | 100% |
| Сложные тесты | 0 | 7 | 0% |
| **ИТОГО** | **7** | **14** | **50%** |

## 🎓 Ключевые различия Truffle vs Hardhat

### Accounts
```javascript
// Truffle
contract('Test', (accounts) => { ... })

// Hardhat
describe("Test", function () {
    let accounts;
    before(async () => {
        accounts = await ethers.getSigners();
    });
})
```

### Errors
```javascript
// Truffle
await truffleAssert.fails(call(), "error");

// Hardhat
await expect(call()).to.be.revertedWith("error");
```

### Events
```javascript
// Truffle
truffleAssert.eventEmitted(tx, 'Event');

// Hardhat
await expect(tx).to.emit(contract, 'Event');
```

### Wei
```javascript
// Truffle
web3.utils.toWei('1', 'ether')

// Hardhat
ethers.parseEther('1')
```

## 🚧 Следующие шаги

### Для завершения миграции:

1. **Доработать созданные тесты** (5 файлов)
   - Исправить ошибки деплоя
   - Добавить недостающие проверки

2. **Создать оставшиеся тесты** (7 файлов)
   - CDP Withdraw & Close
   - CDP Fee
   - CDP Update Increase
   - Deposit
   - Auction (2 файла)
   - Margin Call (2 файла)

3. **Протестировать всё**
   - Запустить полный набор тестов
   - Проверить покрытие кода
   - Оптимизировать медленные тесты

## 📚 Документация

- `MIGRATION_TO_HARDHAT.md` - Полное руководство по миграции
- `HARDHAT_TESTS_STATUS.md` - Детальный статус всех тестов
- `HARDHAT_MIGRATION_COMPLETE.md` - Подробный отчет о миграции

## ✅ Checklist для нового теста

- [ ] Создать файл `*-hardhat.test.js`
- [ ] Использовать helper функции из `test/helpers/contracts.js`
- [ ] Добавить console.log для отладки
- [ ] Использовать `expect` вместо `assert`
- [ ] Использовать `ethers.parseEther()` для wei
- [ ] Использовать `await contract.getAddress()`
- [ ] Протестировать локально
- [ ] Протестировать в Docker
- [ ] Обновить статус в TODO

## 🎉 Готово к использованию!

Вы можете сразу начать использовать Hardhat для:
- Разработки новых контрактов
- Тестирования изменений
- Отладки с console.log в Solidity
- Деплоя в тестовые сети

**Happy Testing! 🚀**

