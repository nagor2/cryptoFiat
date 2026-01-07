# 📊 Статус миграции тестов на Hardhat

## ✅ Полностью переписаны и протестированы

| Файл | Статус | Тестов | Комментарий |
|------|--------|--------|-------------|
| `flatCoin-hardhat.test.js` | ✅ | 5/5 | Базовый тест, все работает |
| `rule-hardhat.test.js` | ✅ | 5/5 | Протестирован в Docker |
| `exchangeRate-hardhat.test.js` | ✅ | 5/5 | Тест оракула |
| `basket-hardhat.test.js` | ✅ | 6/6 | Basket контракт |
| `cdpUpdateDecrease-hardhat.test.js` | ✅ | 4/4 | CDP обновление |

## 🚧 Требуют переписывания (более сложные)

### Высокий приоритет
| Файл | Сложность | Описание |
|------|-----------|----------|
| `cdp_test.js` | 🟡 Средняя | Основные тесты CDP |
| `dao_test.js` | 🟡 Средняя | Тесты голосования DAO |
| `deposit_test.js` | 🟡 Средняя | Депозиты и проценты |

### Средний приоритет  
| Файл | Сложность | Описание |
|------|-----------|----------|
| `cdp_withdrawAndClose.js` | 🟡 Средняя | Вывод и закрытие CDP |
| `cdpUpdateIncrease_test.js` | 🟡 Средняя | Увеличение CDP |
| `cdpFee_test.js` | 🟡 Средняя | Тесты комиссий |

### Низкий приоритет (очень сложные)
| Файл | Сложность | Описание |
|------|-----------|----------|
| `auction_test.js` | 🔴 Высокая | Аукционы Rule |
| `auction_stubFund.js` | 🔴 Высокая | Стабилизационный фонд |
| `cdpMarginCall_test.js` | 🔴 Высокая | Маржин коллы и ликвидации |
| `cdpSeveralAuctionsToClose.js` | 🔴 Высокая | Множественные аукционы |

## 📝 Ключевые изменения при миграции

### 1. Импорты
```javascript
// Было (Truffle)
const { time } = require('@openzeppelin/test-helpers');
const truffleAssert = require('truffle-assertions');

// Стало (Hardhat)
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
```

### 2. Контракты
```javascript
// Было
var Contract = artifacts.require("./Contract.sol");
const instance = await Contract.deployed();

// Стало
const Contract = await ethers.getContractFactory("Contract");
const instance = await Contract.deploy(...args);
await instance.waitForDeployment();
```

### 3. Accounts
```javascript
// Было
contract('Test', (accounts) => {
    const owner = accounts[0];
});

// Стало
describe("Test", function () {
    let owner;
    before(async function () {
        [owner, addr1, ...] = await ethers.getSigners();
    });
});
```

### 4. Addresses
```javascript
// Было
contract.address
ethers.constants.AddressZero

// Стало
await contract.getAddress()
ethers.ZeroAddress
```

### 5. Wei conversion
```javascript
// Было
web3.utils.toWei('1', 'ether')
web3.utils.fromWei(balance)

// Стало
ethers.parseEther('1')
ethers.formatEther(balance)
```

### 6. Assertions
```javascript
// Было
await truffleAssert.fails(
    contract.method(),
    truffleAssert.ErrorType.REVERT,
    "error message"
);

// Стало
await expect(
    contract.method()
).to.be.revertedWith("error message");
```

### 7. Events
```javascript
// Было
truffleAssert.eventEmitted(tx, 'Event', (ev) => {
    assert.equal(ev.param, value);
    return true;
});

// Стало
await expect(tx)
    .to.emit(contract, 'Event')
    .withArgs(value);
```

### 8. Time manipulation
```javascript
// Было
await time.increase(time.duration.years(1));

// Стало
await time.increase(365 * 24 * 60 * 60);
```

## 🎯 Рекомендации

1. **Начать с простых**: `cdp_test.js`, `dao_test.js`, `deposit_test.js`
2. **Создать helper функции** для общих операций:
   - Деплой полного набора контрактов
   - Открытие CDP с параметрами
   - Инициализация аукциона
3. **Тестировать поэтапно**: После каждого теста запускать в Docker
4. **Документировать проблемы**: Если что-то не работает, записать в отдельный файл

## 📊 Прогресс

```
Завершено:   5/14 (36%)
В работе:    0/14  
Осталось:    9/14 (64%)
```

## 🚀 Следующие шаги

1. ✅ Создать базовые helper функции
2. ⏳ Переписать средней сложности тесты (CDP, DAO, Deposit)
3. ⏳ Переписать сложные тесты (Auction, MarginCall)
4. ⏳ Полный прогон всех тестов в Docker
5. ⏳ Обновить документацию

---

*Создано: 2026-01-07*  
*Последнее обновление: 2026-01-07*

