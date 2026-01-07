const { ethers } = require("hardhat");

/**
 * Деплоит полный набор контрактов для тестирования
 * @param {Object} options - Опции для деплоя
 * @returns {Object} Объект со всеми контрактами
 */
async function deployFullSystem(options = {}) {
    const signers = await ethers.getSigners();
    const [owner, ...accounts] = signers;
    
    console.log("📦 Deploying full system...");
    
    // Получаем фабрики контрактов
    const INTDAO = await ethers.getContractFactory("INTDAO");
    const FlatCoin = await ethers.getContractFactory("flatCoin");
    const Rule = await ethers.getContractFactory("Rule");
    const CDP = await ethers.getContractFactory("CDP");
    const Auction = await ethers.getContractFactory("Auction");
    const Deposit = await ethers.getContractFactory("DepositContract");
    const Oracle = await ethers.getContractFactory("exchangeRateContract");
    const Basket = await ethers.getContractFactory("basketContract");
    
    // Simple DAO deployment without future address calculation
    // For full integration tests, use options.useFutureAddress = true
    let futureDAOAddress;
    let dao;
    let startNonce;
    
    if (options.useFutureAddress) {
        startNonce = await owner.getNonce();
        // Расчет транзакций от owner:
        // Подсчет nonce offset:
        // flatCoin(1) - от owner
        // rule(1) - от ruleHolder (может быть owner!)
        // cdp(1) - от owner
        // auction(1) - от owner
        // deposit(1) - от owner
        // oracle - от oracleAuthor (НЕ считается)
        // basket - от oracleAuthor (НЕ считается)
        // Если ruleHolder = owner: 5 транзакций
        // Если ruleHolder != owner: 4 транзакции
        const ruleHolder = options.ruleHolder || accounts[6];
        const nonceOffset = (ruleHolder.address === owner.address) ? 5 : 4;
        futureDAOAddress = ethers.getCreateAddress({
            from: owner.address,
            nonce: startNonce + nonceOffset
        });
        console.log("📍 Future DAO address calculation:");
        console.log("   Owner address:", owner.address);
        console.log("   Current nonce:", startNonce);
        console.log("   Future nonce:", startNonce + nonceOffset, "(+" + nonceOffset + ")");
        console.log("   Expected DAO address:", futureDAOAddress);
    } else {
        // Deploy temporary DAO for simple tests
        dao = await INTDAO.deploy([
            ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress,
            ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress
        ]);
        await dao.waitForDeployment();
        futureDAOAddress = await dao.getAddress();
    }
    
    // Деплоим контракты с future DAO address
    const flatCoin = await FlatCoin.deploy(futureDAOAddress);
    await flatCoin.waitForDeployment();
    
    const ruleHolder = options.ruleHolder || accounts[6];
    const rule = await Rule.connect(ruleHolder).deploy(futureDAOAddress);
    await rule.waitForDeployment();
    
    const cdp = await CDP.deploy(futureDAOAddress);
    await cdp.waitForDeployment();
    
    const auction = await Auction.deploy(futureDAOAddress);
    await auction.waitForDeployment();
    
    const deposit = await Deposit.deploy(futureDAOAddress);
    await deposit.waitForDeployment();
    
    const oracleAuthor = options.oracleAuthor || accounts[4];
    const oracle = await Oracle.connect(oracleAuthor).deploy(futureDAOAddress, { 
        value: ethers.parseEther("0.1") 
    });
    await oracle.waitForDeployment();
    
    // Initialize Oracle with basic instruments (as in Truffle migration)
    await oracle.connect(oracleAuthor).addInstrument("eth", "Ethereum", 6);
    await oracle.connect(oracleAuthor).updateSinglePrice(1, 3100000000);
    await oracle.connect(oracleAuthor).addInstrument("Gold", "Gold", 6);
    await oracle.connect(oracleAuthor).updateSinglePrice(2, 1867650000);
    await oracle.connect(oracleAuthor).addInstrument("Lumber", "Lumber", 6);
    await oracle.connect(oracleAuthor).updateSinglePrice(3, 414100000);
    
    const basket = await Basket.connect(oracleAuthor).deploy(futureDAOAddress);
    await basket.waitForDeployment();
    
    // Deploy the actual DAO with correct addresses if using future address
    if (options.useFutureAddress) {
        dao = await INTDAO.deploy([
            await cdp.getAddress(),
            await auction.getAddress(),
            await deposit.getAddress(),
            await oracle.getAddress(),
            await rule.getAddress(),
            await flatCoin.getAddress(),
            await basket.getAddress()
        ]);
        await dao.waitForDeployment();
        const actualAddress = await dao.getAddress();
        
        const actualNonce = await owner.getNonce();
        const usedNonce = actualNonce - startNonce;
        
        // Проверяем совпадение адресов
        if (actualAddress.toLowerCase() !== futureDAOAddress.toLowerCase()) {
            console.error("❌ ОШИБКА: Future DAO address не совпадает с реальным!");
            console.error("   Ожидался:", futureDAOAddress);
            console.error("   Получен:", actualAddress);
            console.error("   Start nonce:", startNonce);
            console.error("   Current nonce:", actualNonce);
            console.error("   Использовано транзакций:", usedNonce);
            console.error("   Нужно пересчитать nonce offset для future address!");
            throw new Error(`Future address mismatch: expected ${futureDAOAddress}, got ${actualAddress}. Used ${usedNonce} transactions.`);
        }
        
        console.log("✅ DAO deployed at correct address:", actualAddress);
        console.log("   Used transactions:", usedNonce);
    }
    
    // Вызываем renewContracts только если explicitly requested (требует правильный DAO)
    if (options.renewContracts === true) {
        await cdp.renewContracts();
        await auction.renewContracts();
        await deposit.renewContracts();
        
        // Basket renewContracts and initialization disabled by default due to updaterOnly issues
        // Enable with options.initializeBasket = true if needed for specific tests
        if (options.initializeBasket === true) {
            await basket.renewContracts();
            await basket.connect(oracleAuthor).addItem("Gold", 10, 1867650000);
            await basket.connect(oracleAuthor).addItem("Lumber", 5, 414100000);
        }
    }
    
    const daoAddress = await dao.getAddress();
    console.log("✅ Full system deployed");
    console.log("  DAO:", daoAddress);
    console.log("  FlatCoin:", await flatCoin.getAddress());
    console.log("  Rule:", await rule.getAddress());
    console.log("  CDP:", await cdp.getAddress());
    console.log("  Auction:", await auction.getAddress());
    
    return {
        dao,
        flatCoin,
        rule,
        cdp,
        auction,
        deposit,
        oracle,
        basket,
        owner,
        accounts,
        signers,
        oracleAuthor
    };
}

/**
 * Деплоит минимальный набор контрактов (DAO + указанные)
 * @param {Array<string>} contractNames - Массив имён контрактов для деплоя
 * @returns {Object} Объект с контрактами
 */
async function deployMinimalSystem(contractNames) {
    const signers = await ethers.getSigners();
    const [owner, ...accounts] = signers;
    
    console.log("📦 Deploying minimal system:", contractNames.join(", "));
    
    const INTDAO = await ethers.getContractFactory("INTDAO");
    const dao = await INTDAO.deploy([
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress
    ]);
    await dao.waitForDeployment();
    const daoAddress = await dao.getAddress();
    
    const contracts = { dao, owner, accounts, signers };
    
    for (const name of contractNames) {
        const Factory = await ethers.getContractFactory(name);
        const contract = await Factory.deploy(daoAddress);
        await contract.waitForDeployment();
        contracts[name.toLowerCase()] = contract;
        console.log(`  ${name}:`, await contract.getAddress());
    }
    
    console.log("✅ Minimal system deployed");
    
    return contracts;
}

/**
 * Открывает CDP позицию
 * @param {Object} cdp - Контракт CDP
 * @param {Object} params - Параметры
 * @returns {BigInt} ID открытой позиции
 */
async function openCDP(cdp, params = {}) {
    const {
        signer,
        coinsToMint = ethers.parseEther('1000'),
        ethValue = ethers.parseEther('1')
    } = params;
    
    const tx = await (signer ? cdp.connect(signer) : cdp).openCDP(coinsToMint, {
        value: ethValue
    });
    const receipt = await tx.wait();
    
    // Находим событие PositionOpened
    const event = receipt.logs.find(log => {
        try {
            return cdp.interface.parseLog(log)?.name === 'PositionOpened';
        } catch {
            return false;
        }
    });
    
    if (event) {
        const parsed = cdp.interface.parseLog(event);
        return parsed.args.posID;
    }
    
    throw new Error("PositionOpened event not found");
}

/**
 * Форматирует BigInt для сравнения с точностью
 * @param {BigInt} value - Значение
 * @param {number} decimals - Количество десятичных знаков после запятой
 * @returns {number} Отформатированное число
 */
function formatFixed(value, decimals = 4) {
    return parseFloat(parseFloat(ethers.formatEther(value)).toFixed(decimals));
}

/**
 * Получает событие из транзакции
 * @param {Object} tx - Транзакция или receipt
 * @param {Object} contract - Контракт
 * @param {string} eventName - Имя события
 * @returns {Object|null} Parsed event или null
 */
async function getEvent(tx, contract, eventName) {
    const receipt = tx.wait ? await tx.wait() : tx;
    
    const event = receipt.logs.find(log => {
        try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === eventName;
        } catch {
            return false;
        }
    });
    
    if (event) {
        return contract.interface.parseLog(event);
    }
    
    return null;
}

module.exports = {
    deployFullSystem,
    deployMinimalSystem,
    openCDP,
    formatFixed,
    getEvent
};

