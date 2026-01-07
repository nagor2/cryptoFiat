# 🔒 Security Tests for CryptoFiat

Набор security тестов для проверки уязвимостей смарт-контрактов CryptoFiat.

## 📁 Структура

```
test/security/
├── README.md                      # Этот файл
└── dao-flashloan-attack.test.js   # V-DAO-001: Flash loan атака на DAO
```

## 🧪 Существующие тесты

### ✅ dao-flashloan-attack.test.js

**Покрывает:** V-DAO-001 - Flash loan атака на governance

**Результат:** ✅ **ЗАЩИЩЕНО** - атака не работает

**Что тестируется:**
1. Попытка flash loan атаки (pool → vote → return в одной транзакции)
2. Вычитание голосов при returnTokens() во время активного голосования
3. Quorum manipulation через временное pooling
4. Минимальные требования токенов для создания voting
5. nonReentrant защита на poolTokens
6. nonReentrant защита на returnTokens

**Запуск:**
```bash
docker compose exec hardhat npx hardhat test test/security/dao-flashloan-attack.test.js
```

**Ключевые находки:**
- ✅ returnTokens() корректно вычитает голоса из totalPositive
- ✅ Flash loan атака в одной транзакции НЕ работает
- ⚠️ Quorum manipulation теоретически возможна, но требует удержания токенов

---

## 🔴 Планируемые security тесты

### V-ORA-001: Oracle централизация и manipulation
- [ ] Тест на установку экстремальных цен
- [ ] Тест на stale prices (устаревшие цены)
- [ ] Тест на манипуляцию ценами для ликвидаций

### V-CDP-004: Stale Oracle prices
- [ ] Тест на использование устаревших цен
- [ ] Тест на heartbeat check (если добавим)
- [ ] Тест на влияние устаревших цен на ликвидации

### V-AUC-001: Flash loan на RuleBuyOut
- [ ] Тест на initRuleBuyOut с flash loan токенами
- [ ] Тест на проверку баланса после транзакции
- [ ] Тест на lock механизм (если добавим)

### V-CDP-001: Front-running ликвидаций
- [ ] Симуляция front-running markToLiquidate
- [ ] Симуляция front-running claimMarginCall
- [ ] Тест на commit-reveal схему (если добавим)

### V-AUC-002: Front-running ставок аукциона
- [ ] Симуляция front-running makeBid
- [ ] Симуляция front-running improveBid
- [ ] Тест на sealed bid auction (если добавим)

### V-CDP-002: DoS через массовое создание мелких CDP
- [ ] Stress test: создание 1000+ позиций
- [ ] Тест на gas costs при большом количестве позиций
- [ ] Тест на минимальный депозит (если добавим)

### V-CDP-005: Reentrancy через payable.send()
- [ ] Тест с контрактом-владельцем с fallback функцией
- [ ] Тест на closeCDP с reentrancy попыткой
- [ ] Тест на withdrawEther с reentrancy попыткой

### V-CDP-006: finishMarginCall повторные вызовы
- [ ] Тест на повторный вызов finishMarginCall
- [ ] Тест на finishMarginCall во время аукциона
- [ ] Тест на состояние после множественных вызовов

### V-AUC-003: DoS аукциона через отмену лучшей ставки
- [ ] Тест на блокировку аукциона winner'ом
- [ ] Тест на timeout механизм (если добавим)
- [ ] Тест на forced finalization

### V-AUC-004: Зависшие флаги аукционов
- [ ] Тест на ruleBuyOut флаг без ставок
- [ ] Тест на isCoinsBuyOutForStabilization флаг без ставок
- [ ] Тест на cleanup механизм (если добавим)

### V-DAO-002: 51% атака на governance
- [ ] Тест на контроль с 51% токенов
- [ ] Тест на изменение критичных параметров
- [ ] Тест на time-lock механизм (если добавим)

### V-BAS-001: Division by zero в basket
- [ ] Тест на sharesCount = 0
- [ ] Тест на влияние на CDP операции
- [ ] Тест на минимальный sharesCount (если добавим)

### V-DEP-001: topUp чужих депозитов
- [ ] Тест на случайное пополнение чужого депозита
- [ ] Тест на намеренное пополнение чужого депозита
- [ ] Тест на owner check (если добавим)

---

## 🏃 Запуск всех security тестов

```bash
# Все security тесты
docker compose exec hardhat npx hardhat test test/security/*.test.js

# Конкретный тест
docker compose exec hardhat npx hardhat test test/security/dao-flashloan-attack.test.js

# С verbose выводом
docker compose exec hardhat npx hardhat test test/security/*.test.js --verbose

# С gas reporter
REPORT_GAS=true docker compose exec hardhat npx hardhat test test/security/*.test.js
```

---

## 📊 Coverage

| Уязвимость | Severity | Status | Test Coverage |
|-----------|----------|--------|---------------|
| V-DAO-001 | LOW (was CRITICAL) | ✅ PROTECTED | 100% (6 tests) |
| V-ORA-001 | CRITICAL | ⚠️ OPEN | 0% |
| V-CDP-004 | CRITICAL | ⚠️ OPEN | 0% |
| V-AUC-001 | CRITICAL | ⚠️ OPEN | 0% |
| V-CDP-001 | HIGH | ⚠️ OPEN | 0% |
| V-AUC-002 | HIGH | ⚠️ OPEN | 0% |
| V-CDP-005 | HIGH | ⚠️ OPEN | 0% |

**Total:** 1/25+ vulnerabilities tested (4%)

---

## 🎯 Приоритет разработки тестов

### Phase 1: CRITICAL (немедленно)
1. ✅ V-DAO-001: Flash loan на DAO (DONE)
2. ⏳ V-ORA-001: Oracle централизация
3. ⏳ V-CDP-004: Stale prices
4. ⏳ V-AUC-001: Flash loan на RuleBuyOut

### Phase 2: HIGH (скоро)
5. ⏳ V-CDP-001: Front-running ликвидаций
6. ⏳ V-AUC-002: Front-running аукционов
7. ⏳ V-CDP-005: Reentrancy
8. ⏳ V-CDP-006: finishMarginCall

### Phase 3: MEDIUM
9. ⏳ V-CDP-002: DoS через мелкие CDP
10. ⏳ V-AUC-003: DoS аукционов
11. ⏳ V-AUC-004: Зависшие флаги
12. ⏳ V-BAS-001: Division by zero

---

## 🛠️ Helper контракты

### FlashLoanAttacker.sol
Контракт для симуляции flash loan атак на DAO и аукционы.

**Функции:**
- `executeFlashLoanAttack()` - выполняет атаку pool → vote → return
- `createVoting()` - создает voting proposal с pooled токенами
- `fundAttacker()` - пополнение контракта токенами

**Использование:**
```javascript
const FlashLoanAttacker = await ethers.getContractFactory("FlashLoanAttacker");
const attacker = await FlashLoanAttacker.deploy(daoAddress, ruleTokenAddress);
await attacker.executeFlashLoanAttack();
```

---

## 📝 Соглашения

### Naming
- Файлы: `<contract>-<vulnerability-type>.test.js`
- Describe блоки: `Security: <Contract> <Vulnerability Name> (V-XXX-###)`

### Структура тестов
```javascript
describe("Security: <Vulnerability>", function () {
    // Setup
    beforeEach(async function () { ... });
    
    describe("<Attack Type> Scenario", function () {
        it("should demonstrate attack attempt", async function () { ... });
        it("should verify protection mechanism", async function () { ... });
        it("should check edge cases", async function () { ... });
    });
    
    describe("Additional Security Checks", function () {
        it("should verify related protections", async function () { ... });
    });
});
```

### Console logging
- `✅` - Успешная проверка
- `🔴` - Попытка атаки
- `📊` - Результаты
- `⚠️` - Предупреждения/ограничения

---

## 🔗 Связанные файлы

- `.context/modules/security_vulnerabilities_analysis.json` - Полный анализ уязвимостей
- `.context/modules/contracts_architecture.json` - Архитектура контрактов
- `.context/modules/tests_structure.json` - Структура тестов
- `contracts/test/FlashLoanAttacker.sol` - Helper для flash loan тестов

---

## 📚 Ресурсы

- [SWC Registry](https://swcregistry.io/) - Smart Contract Weakness Classification
- [Consensys Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OpenZeppelin Security](https://docs.openzeppelin.com/contracts/4.x/api/security)
- [Trail of Bits Guidelines](https://github.com/crytic/building-secure-contracts)

---

**Статус:** 🚧 В разработке  
**Последнее обновление:** 2025-01-07  
**Автор:** СЛК Security Team

