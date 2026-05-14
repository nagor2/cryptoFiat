# 🔄 Миграция протокола dotFlat на новые контракты

## 📋 Контекст и причина миграции

Протокол dotFlat использует DAO-голосование для обновления адресов контрактов (Oracle, Auction и др.).
Голосование требует пулинга RLE-токенов в INTDAO. Однако весь supply находится в сторонних вестинг-контрактах,
которые не поддерживают делегирование голосов.

**Параметры governance (из INTDAO):**

| Параметр | Значение | Смысл |
|---|---|---|
| `quorum` | 75% | % от total supply, которые должны быть запулены |
| `absoluteMajority` | 80% | % total supply для мгновенного прохода |
| `minRuleTokensToInitVotingPercent` | 1% | Минимум для инициации голосования |

При total supply 1 000 000 RLE и жидких ~95 000 RLE — **кворум в 750 000 недостижим**.
Голосование для изменения адресов контрактов провести невозможно.

**Вывод:** необходим полный редеплой протокола с последующей миграцией пользователей.

---

## 🚨 Известные ограничения миграции

### Заблокированный ETH — неустранимое ограничение

Это фундаментальная проблема архитектуры: ETH извлекается из CDP **только** через погашение долга в DFC.

```
Долг по CDP = coinsMinted + проценты (начисляются каждую секунду в DFC)
             ↓
Погасить можно только старыми DFC
             ↓
Старые DFC разбросаны по кошелькам, часть недоступна
(потерянные ключи, игнор, мёртвые адреса)
             ↓
⛔ ETH остаётся заперт навсегда
```

**Часть ETH будет потеряна безвозвратно** — пропорционально тому объёму старых DFC,
держатели которых не участвовали в свопе и не вернули токены.

### Круговая зависимость при закрытии своего CDP

Если у деплойера есть открытые CDP-позиции на старом протоколе:

1. Чтобы закрыть CDP → нужны старые DFC (coinsMinted + проценты)
2. Чтобы получить старые DFC → нужно, чтобы пользователи принесли их в DFCSwap
3. Чтобы пользователи принесли DFC в своп → нужен стимул (старый oracle должен умереть)
4. Чтобы убить старый oracle → нужно уже запустить новый протокол

То есть закрытие старых CDP — **последний шаг**, а не первый.

### Про манипуляцию oracle (ликвидационный путь)

Технически деплойер контролирует `updater` на старом `exchangeRateContract` и может выставить
произвольные цены. Снижение цены ETH до нуля сделало бы все CDP ликвидируемыми:
`markToLiquidate → claimMarginCall → Auction` — ETH уходит через аукцион к покупателям.

**Почему это не решение:**
- Для чужих CDP — принудительная ликвидация по искусственной цене, пользователи теряют деньги. Неэтично.
- Для своего CDP — аукционный победитель должен платить DFC. Та же круговая зависимость сохраняется.
- Аукционный путь не устраняет необходимость в DFC, он лишь меняет форму изъятия ETH.

---

## 🗺️ Общая схема миграции

```
Старый протокол                              Новый протокол
────────────────                             ──────────────
CDP (ETH заперт)
  │ 1. пользователи закрывают сами           openCDP() → новые DFC
  │    closeCDP() → ETH обратно ──────────────────────────────────▶
  │ 2. деплойер — инкрементально:
  │    DFCSwap.withdrawOldDFC()
  │    → updateCDP() частями
  │    → closeCDP() когда накоплено

Deposit (DFC заперт)
  │ withdraw() + claimInterest()              deposit() → депозит в новом
  └──────────────────────────────────────────────────────────────▶

Старые DFC на кошельке
  │ DFCSwap.swap() 1:1
  └──────────────────────────────────────────────────────────────▶ новые DFC

RLE в вестинге
  └──── вестинг продолжается без изменений
        новые RLE выдаются по той же схеме на новом протоколе
```

---

## 📦 Фаза 0 — Инвентаризация текущего состояния

Перед началом необходимо зафиксировать полный срез состояния старого протокола.

### Что собрать:
- Все открытые CDP-позиции: owner, coinsMinted, ethAmountLocked, liquidationStatus, totalCurrentFee
- Все активные Deposit: owner, coinsDeposited, accumulatedInterest
- DFC в обращении: `flatCoin.totalSupply()` − `balanceOf(cdpAddress)` − `balanceOf(depositAddress)`
- RLE-балансы (для справки, вестинг-контракты не меняются)
- Инструменты Oracle: список символов, decimals, последние цены
- Конфигурация Basket: items, shares, initialPrices
- Суммарный долг по всем CDP (сумма coinsMinted + накопленных процентов) — **нижняя граница DFC, необходимых для полного закрытия**

### Команды для сбора данных:
```javascript
// Все позиции CDP
const numPositions = await cdp.numPositions();
for (let i = 0; i < numPositions; i++) {
    const pos = await cdp.positions(i);
    const fee = await cdp.totalCurrentFee(i);
    console.log(i, pos.owner, pos.coinsMinted, pos.ethAmountLocked, fee);
}

// Все депозиты
const depositsCounter = await deposit.depositsCounter();
for (let i = 1; i <= depositsCounter; i++) {
    const d = await deposit.deposits(i);
    console.log(i, d.owner, d.coinsDeposited, d.accumulatedInterest);
}

// DFC в свободном обращении
const totalSupply = await flatCoin.totalSupply();
const cdpBalance = await flatCoin.balanceOf(CDP_ADDRESS);
const depositBalance = await flatCoin.balanceOf(DEPOSIT_ADDRESS);
const freeCirculation = totalSupply - cdpBalance - depositBalance;
console.log("DFC в свободном обращении:", freeCirculation);
```

---

## 🏗️ Фаза 1 — Деплой нового протокола

### Порядок деплоя контрактов

Порядок важен — каждый следующий контракт получает адрес DAO.

```
1. INTDAO         ← принимает массив адресов в конструкторе
2. Rule           ← передать адрес INTDAO
3. flatCoin       ← передать адрес INTDAO
4. CDP            ← передать адрес INTDAO
5. Auction        ← передать адрес INTDAO
6. Deposit        ← передать адрес INTDAO
7. exchangeRate   ← передать адрес INTDAO
8. basket         ← передать адрес INTDAO
```

Конструктор INTDAO принимает массив `[cdp, auction, deposit, oracle, rule, flatCoin, basket]`.
При деплое INTDAO адреса всех остальных контрактов ещё неизвестны — используй **CREATE2** или
заранее вычисляй адреса по nonce деплой-аккаунта.

### Фикс governance при новом деплое

В конструкторе INTDAO жёстко прописаны параметры. **Изменить их до деплоя** — вот ключевые:

```solidity
// GOVERNANCE (было → стало)
params["quorum"] = 10;           // 75 → 10: кворум достижим с жидким supply
params["absoluteMajority"] = 51; // 80 → 51: простое большинство

// ORACLE SECURITY (новые параметры)
params["priceBoundForRevert"] = 10;   // revert если цена движется >10% за апдейт
params["oraclePriceDelay"] = 1 hours; // time-lock: цена вступает в силу через 1ч

// LIQUIDATION (было → стало)
params["marginCallTimeLimit"] = 6 hours; // 1 day → 6h: баланс защиты юзера и протокола
```

Также: не отправлять 100% RLE в вестинг. Оставить минимум 10–15% жидкими
для нормальной работы governance.

### После деплоя — инициализация

```javascript
// 1. Обновить кэшированные интерфейсы в каждом контракте
await cdp.renewContracts();
await auction.renewContracts();
await deposit.renewContracts();
await basket.renewContracts();

// 2. Авторизовать CDP и Deposit (делается в конструкторе INTDAO автоматически)

// 3. Инициализировать Oracle — заново добавить все инструменты
await oracle.addInstrument("eth", "Ethereum", 6);
await oracle.addInstrument("GLD", "Gold", 5);
// ... остальные инструменты из инвентаризации (фаза 0)

// 4. Залить начальные цены в pending
await oracle.updateSeveralPrices([ethId, gldId, ...], [ethPrice, gldPrice, ...]);

// 5. Подождать oraclePriceDelay (1 час), затем применить цены
await oracle.applyPendingPrices([ethId, gldId, ...]); // любой может вызвать

// 6. Инициализировать Basket — добавить товары с весами
await basket.addItem("GLD", share, initialPrice);
// ... остальные items из инвентаризации (фаза 0)
```

---

## 🔐 Безопасность централизованного oracle

Oracle в новом протоколе остаётся централизованным (один updater). Это честно признаётся публично,
но компенсируется набором on-chain механизмов, которые ограничивают возможности злоупотребления.

### Проблема: почему degens не доверяют централизованному oracle

Централизованный oracle — это суперсила для команды:

```
Команда выставляет цену ETH = $1
→ Все CDP мгновенно ликвидируются
→ Команда выкупает ETH через Auction за копейки
→ Цена восстанавливается
```

LP-лок не помогает — он защищает от rug ликвидности, но не от oracle-манипуляции.

### Решение 1: Time-lock на цены (реализовано в exchangeRateContract.sol)

Любая новая цена попадает в `pending` и становится live только через `oraclePriceDelay` (1 час).
Применяется вручную через публичную функцию `applyPendingPrices()`.

```
T+0h   updater вызывает updateSeveralPrices()
       → цены идут в pending, emit PriceSubmitted
       → getPrice() возвращает СТАРУЮ цену
       → Alert-бот видит событие и шлёт уведомление пользователям

T+1h   Любой вызывает applyPendingPrices()
       → цены становятся live
       → CDP, Basket, Auction начинают использовать новые цены
```

Если pending-цена выглядит подозрительно — у пользователей есть 1 час чтобы отреагировать.

### Решение 2: Hard bound — revert при движении >10% (реализовано)

`_submitPrice()` в `exchangeRateContract.sol` проверяет движение цены относительно текущей live-цены.
Если превышен `priceBoundForRevert` (10% по умолчанию, задаётся через INTDAO) — транзакция reverтится.

```
Попытка установить ETH $2500 → $100:
→ движение = (2500-100)/2500 = 96% > 10%
→ revert("price move exceeds bound")
```

Для легитимного движения >10% за апдейт нужно несколько последовательных обновлений,
каждое с 1-часовым time-lock. Это делает мгновенную манипуляцию физически невозможной.

**Полная цепочка от манипуляции до ликвидации при наших параметрах:**

```
Манипулятор пытается уронить ETH $2500 → $1 (99% падение):
  Update 1: $2500 → $2250 (-10%) → pending → ждёт 1ч → applied
  Update 2: $2250 → $2025 (-10%) → pending → ждёт 1ч → applied
  Update 3: $2025 → $1823 (-10%) → pending → ждёт 1ч → applied
  ...нужно 23 апдейта × 1ч = 23 часа чтобы дойти до $100
  + markToLiquidate
  + marginCallTimeLimit = 6 часов до claimMarginCall

Итого: десятки часов. За это время любой человек успеет среагировать.
```

Для сравнения — `highVolatilityEventBarrierPercent` (5%) только эмитирует событие,
`priceBoundForRevert` (10%) делает revert. Оба параметра независимы.

### Решение 3: marginCallTimeLimit = 6 часов

Уменьшено с 1 дня до 6 часов. Это время между `markToLiquidate` и `claimMarginCall` —
окно, в котором владелец CDP может довнести залог или вернуть DFC.

**Почему не 1 день:**
- 1 день + time-lock = протокол висит в недообеспечении 25+ часов при реальном падении рынка
- Это риск bad debt для протокола

**Почему не 1 час:**
- Слишком мало для пользователя без бота
- 6 часов = получил alert в 3 ночи, проснулся в 7 утра, успел

### Решение 4: Alert-бот (обязательная часть запуска)

Time-lock бесполезен без системы уведомлений. Бот слушает `PriceSubmitted` events и сравнивает
pending-цену с рыночной (Binance / CoinGecko API).

```
PriceSubmitted event on-chain
        ↓
Бот сравнивает pending_price с рыночной ценой
        ↓
Если отклонение > порога (например, 3%)
        ↓
Telegram/Discord уведомление всем владельцам CDP:
"⚠️ Pending цена ETH: $1800 (рынок: $2400, -25%)
 Применится через 58 минут.
 Ваша позиция #42 будет под угрозой.
 [Закрыть CDP] [Довнести залог]"
```

**Без alert-бота time-lock даёт лишь иллюзию защиты — у пользователей нет способа узнать
о подозрительной pending-цене без мониторинга контракта.**

### Как честно говорить об этом degens

```
"Oracle централизован на Phase 1. Вот что мы сделали чтобы ограничить риски:
 ✅ Hard bound: цена не может двигаться >10% за апдейт (on-chain revert)
 ✅ Time-lock 1ч: любая цена применяется только через час (виден pending)
 ✅ Alert-бот: уведомления в Telegram при подозрительных ценах
 ✅ marginCallTimeLimit 6ч: есть время довнести залог после маркировки
 ✅ LP locked 12 месяцев
 ✅ Roadmap к decentralized oracle с RLE staking — публичен"
```

---

## 🔁 Фаза 2 — Своп-контракт для DFC

Держатели DFC, которые не являются владельцами CDP (вторичный рынок), не могут закрыть позицию.
Для них нужен обменник старый DFC → новый DFC по курсу 1:1.

DFCSwap выполняет двойную роль:
1. **Для пользователей** — обменять ставшие бесполезными старые DFC на новые
2. **Для деплойера** — накопить старые DFC через `withdrawOldDFC()` для закрытия своих CDP

### Контракт свопа

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract DFCSwap {
    IERC20 public immutable oldDFC;
    IERC20 public immutable newDFC;
    address public immutable owner;

    constructor(address _oldDFC, address _newDFC) {
        oldDFC = IERC20(_oldDFC);
        newDFC = IERC20(_newDFC);
        owner = msg.sender;
    }

    // Обменять старые DFC на новые 1:1
    function swap(uint256 amount) external {
        require(newDFC.balanceOf(address(this)) >= amount, "insufficient new DFC");
        require(oldDFC.transferFrom(msg.sender, address(this), amount), "transfer failed");
        require(newDFC.transfer(msg.sender, amount), "transfer failed");
    }

    // Вывести накопленные старые DFC — для деплойера, чтобы закрыть старые CDP
    function withdrawOldDFC() external {
        require(msg.sender == owner, "owner only");
        oldDFC.transfer(owner, oldDFC.balanceOf(address(this)));
    }

    // Вывести неиспользованные новые DFC (если своп завершён)
    function withdrawNewDFC() external {
        require(msg.sender == owner, "owner only");
        newDFC.transfer(owner, newDFC.balanceOf(address(this)));
    }
}
```

### Пре-фандинг свопа

1. Открыть CDP на **новом** протоколе (используя ETH не заблокированный в старом)
2. Сминтить новые DFC в объёме = DFC в свободном обращении (из инвентаризации фазы 0)
3. Перевести новые DFC в DFCSwap

### Инкрементальное закрытие старых CDP деплойером

По мере того как пользователи приносят старые DFC в своп, деплойер постепенно гасит свой долг:

```javascript
// Шаг 1: забрать накопленные старые DFC из свопа
await dfcSwap.withdrawOldDFC();

// Шаг 2: уменьшить долг на доступную сумму (не закрывать полностью)
const oldDFCBalance = await oldFlatCoin.balanceOf(deployerAddress);
const position = await oldCDP.positions(posID);
const newDebt = position.coinsMinted - oldDFCBalance; // уменьшаем на то, что есть

await oldFlatCoin.approve(OLD_CDP_ADDRESS, oldDFCBalance);
await oldCDP.updateCDP(posID, newDebt);

// Повторять итеративно по мере накопления DFC в свопе
// Когда coinsMinted достигнет минимума → closeCDP(posID)
```

---

## 📢 Фаза 3 — Коммуникация с пользователями

Т.к. пользователей немного, уведомление проводится напрямую (on-chain события + прямая связь).

### Шаблон сообщения

> **Важно: Миграция протокола dotFlat**
>
> Протокол dotFlat переезжает на новые контракты.
>
> **Что нужно сделать до [ДАТА]:**
>
> Если у вас открыта CDP-позиция:
> 1. Верните DFC на сумму долга + проценты
> 2. Вызовите `closeCDP(posID)` — получите ETH обратно
> 3. Откройте новую позицию на новом протоколе: [НОВЫЙ АДРЕС CDP]
>
> Если у вас активный Deposit:
> 1. Вызовите `withdraw(id, amount)` + `claimInterest(id)`
> 2. Внесите DFC в новый Deposit: [НОВЫЙ АДРЕС DEPOSIT]
>
> Если у вас есть DFC на кошельке:
> 1. Обменяйте старые DFC на новые через своп: [АДРЕС СВОПА]
>
> **После [ДАТА]** Oracle старого протокола перестанет обновлять цены.
> Старые DFC потеряют полезность — успейте обменять.

---

## 🌅 Фаза 4 — Закат старого протокола

После завершения миграционного окна:

1. **Остановить Oracle updater** на старом `exchangeRateContract` — прекратить обновление цен.
   Это главный стимул для оставшихся держателей DFC принести токены в своп:
   старый DFC без работающего oracle теряет смысл.
2. Продолжать итеративно закрывать свои CDP через `withdrawOldDFC → updateCDP → closeCDP`.
3. Старый протокол технически продолжает существовать, но становится нефункциональным de-facto.
4. Принять как факт: часть ETH останется в старом CDP навсегда, если соответствующие DFC
   так и не вернутся. Это неустранимое ограничение архитектуры.

---

## ✅ Итоговый чеклист

### Подготовка
- [ ] Собрать инвентаризацию: CDP-позиции с долгами, депозиты, DFC в свободном обращении
- [ ] Собрать конфигурацию Oracle: инструменты, decimals, актуальные цены
- [ ] Собрать конфигурацию Basket: items, shares, initialPrices
- [ ] Вычислить объём DFC для пре-фандинга свопа (= DFC в свободном обращении)
- [ ] Убедиться, что есть свободный ETH (не заблокированный в старом CDP) для открытия новых позиций

### Деплой нового протокола
- [ ] Скорректировать параметры в INTDAO перед деплоем:
  - `quorum` → 10
  - `absoluteMajority` → 51
  - `priceBoundForRevert` → 10 (hard bound oracle)
  - `oraclePriceDelay` → 3600 (1 час time-lock)
  - `marginCallTimeLimit` → 21600 (6 часов)
- [ ] Оставить 10–15% RLE liquid (не отправлять всё в вестинг)
- [ ] Задеплоить все 8 контрактов в правильном порядке
- [ ] Вызвать `renewContracts()` на CDP, Auction, Deposit, Basket
- [ ] Инициализировать Oracle (все инструменты)
- [ ] Залить начальные цены через `updateSeveralPrices()` → подождать 1ч → `applyPendingPrices()`
- [ ] Инициализировать Basket (все items с весами)
- [ ] Проверить `getEthereumVSCommoditiesPriceChange()` — корректное значение

### Alert-бот и oracle-нода
- [ ] Развернуть alert-бот: слушает `PriceSubmitted`, сравнивает с Binance/CoinGecko
- [ ] Настроить Telegram/Discord уведомления для всех владельцев CDP
- [ ] Обновить oracle-ноду: добавить вызов `applyPendingPrices()` в начале каждого цикла
- [ ] Убедиться что приватный ключ updater'а не хардкожен в исходниках (env variable)

### Своп-контракт
- [ ] Задеплоить DFCSwap с адресами старого и нового DFC
- [ ] Открыть CDP на новом протоколе, сминтить нужное количество новых DFC
- [ ] Перевести новые DFC в DFCSwap

### Коммуникация
- [ ] Уведомить всех пользователей, установить дедлайн миграции (рекомендуется 3–6 месяцев)
- [ ] Опубликовать адреса новых контрактов и адрес DFCSwap

### Закрытие старых CDP (итеративно, после старта миграции)
- [ ] Периодически вызывать `DFCSwap.withdrawOldDFC()`
- [ ] Частично гасить долг через `oldCDP.updateCDP(posID, меньший_долг)`
- [ ] Когда накоплено достаточно — `oldCDP.closeCDP(posID)`, получить ETH

### Завершение
- [ ] Остановить Oracle updater на старом протоколе
- [ ] Зафиксировать финальный объём ETH, оставшегося заблокированным (если есть)
- [ ] Вывести неиспользованные новые DFC из свопа (`withdrawNewDFC`)

---

## 🔑 Ключевые адреса

### Старый протокол (Ethereum Mainnet)

| Контракт | Адрес |
|---|---|
| INTDAO | `0x55Ead3b40016b1d5417F5A20F2d1E53e2d1c9122` |
| CDP | `0xbCf58DE37791eFe60fE87a6d420FE8F7AEA99ef8` |
| flatCoin (DFC) | `0x1F709Cfa0C409E158C68EdcD32453809c9Eb69EE` |
| Deposit | `0x44881F5ac2938AAaF4260d7DBE18997318788f9f` |
| Auction | `0xBdFb52d4C9fBdE41805abBb206465aca3b3499D6` |
| Rule (RLE) | `0x3Dfa45997ddB7980Eb4D73CBfCf0E024F05b08a3` |
| ExchangeRate | `0x1DF609afDC67396a9f307de2BA3E3b667dEe8b5B` |

### Новый протокол

*Заполнить после деплоя.*

| Контракт | Адрес |
|---|---|
| INTDAO | `—` |
| CDP | `—` |
| flatCoin (DFC) | `—` |
| Deposit | `—` |
| Auction | `—` |
| Rule (RLE) | `—` |
| ExchangeRate | `—` |
| basket | `—` |
| DFCSwap | `—` |
