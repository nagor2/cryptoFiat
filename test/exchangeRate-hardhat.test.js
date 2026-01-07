const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Exchange Rate (Hardhat version)", function () {
    let exRate, dao;
    let author, owner, addr1;
    let ethInstrument;

    before(async function () {
        [owner, addr1, , , , author] = await ethers.getSigners();
        
        console.log("Deploying Exchange Rate Oracle...");
        
        // Deploy DAO first (Oracle needs it for params)
        const INTDAO = await ethers.getContractFactory("INTDAO");
        dao = await INTDAO.deploy([
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress
        ]);
        await dao.waitForDeployment();
        
        const ExRate = await ethers.getContractFactory("exchangeRateContract");
        exRate = await ExRate.connect(author).deploy(await dao.getAddress(), {
            value: ethers.parseEther("0.1")
        });
        await exRate.waitForDeployment();
        
        // Добавляем базовые инструменты (как в Truffle миграции)
        await exRate.connect(author).addInstrument("eth", "Ethereum", 6);
        await exRate.connect(author).updateSinglePrice(1, 3100000000);
        
        await exRate.connect(author).addInstrument("Gold", "Gold", 6);
        await exRate.connect(author).updateSinglePrice(2, 1867650000);
        
        await exRate.connect(author).addInstrument("Lumber", "Lumber", 6);
        await exRate.connect(author).updateSinglePrice(3, 414100000);
        
        console.log("✅ Oracle deployed to:", await exRate.getAddress());
    });

    it("should put money on balance", async function () {
        const balance = await ethers.provider.getBalance(await exRate.getAddress());
        expect(Number(ethers.formatEther(balance))).to.be.closeTo(0.10, 0.01);
        
        console.log("✅ Oracle balance:", ethers.formatEther(balance), "ETH");
    });

    it("should add and update instrument", async function () {
        let eth2Instrument = await exRate.dictionary("eth2");
        expect(eth2Instrument.name).to.equal("");
        
        await exRate.connect(author).addInstrument("eth2", "Ethereum", 2);
        await exRate.connect(author).updateSinglePrice(4, 310000);
        
        const ethPrice = await exRate.getPrice('eth2');
        eth2Instrument = await exRate.dictionary("eth2");
        const formattedPrice = Number(ethPrice) / (10 ** Number(eth2Instrument.decimals));
        
        expect(formattedPrice).to.equal(3100);
        
        console.log("✅ ETH2 price:", formattedPrice);
    });

    it("should change price", async function () {
        await exRate.connect(author).updateSinglePrice(4, 110021);
        
        const ethPrice = await exRate.getPrice('eth2');
        const eth2Instrument = await exRate.dictionary("eth2");
        const formattedPrice = Number(ethPrice) / (10 ** Number(eth2Instrument.decimals));
        
        expect(formattedPrice).to.equal(1100.21);
        
        console.log("✅ Updated ETH2 price:", formattedPrice);
    });

    it("should change several prices", async function () {
        await exRate.connect(author).updateSeveralPrices([3, 1, 2], [100, 101, 102]);
        
        const lumberPrice = await exRate.getPrice("Lumber");
        expect(lumberPrice).to.equal(100n);
        
        const goldPrice = await exRate.getPrice("Gold");
        expect(goldPrice).to.equal(102n);
        
        const ethPrice = await exRate.getPrice("eth");
        expect(ethPrice).to.equal(101n);
        
        console.log("✅ Updated prices - Lumber:", lumberPrice.toString(), "Gold:", goldPrice.toString(), "ETH:", ethPrice.toString());
    });

    it("should emit highVolatilityEventBarrierPercent", async function () {
        const tx = await exRate.connect(author).updateSeveralPrices([3, 1, 2], [100, 101, 10]);
        
        await expect(tx)
            .to.emit(exRate, 'highVolatility')
            .withArgs(2);
        
        console.log("✅ High volatility event emitted for id 2");
    });
});

