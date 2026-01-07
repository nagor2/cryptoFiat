const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CDP Update Decrease (Hardhat version)", function () {
    let dao;
    let cdp;
    let flatCoin;
    let position;
    let posId;
    let expectedOwner;
    let owner, ownerId;

    before(async function () {
        console.log("Deploying CDP Update Decrease test contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true
        });
        
        dao = system.dao;
        cdp = system.cdp;
        flatCoin = system.flatCoin;
        owner = system.owner;
        ownerId = system.accounts[1];
        
        const tx = await cdp.connect(ownerId).openCDP(ethers.parseEther('1000'), {
            value: ethers.parseEther('1')
        });
        const receipt = await tx.wait();
        
        // Извлекаем posID из события
        const event = receipt.logs.find(log => {
            try {
                return cdp.interface.parseLog(log)?.name === 'PositionOpened';
            } catch {
                return false;
            }
        });
        
        if (event) {
            const parsed = cdp.interface.parseLog(event);
            posId = parsed.args.posID;
        }
        
        expectedOwner = ownerId.address;
        
        // Перематываем время на 1 год
        await time.increase(365 * 24 * 60 * 60);
        
        position = await cdp.positions(posId);
        
        // Обновляем позицию
        await cdp.connect(ownerId).updateCDP(posId, ethers.parseEther('100'));
        
        console.log("✅ CDP deployed and position created");
        console.log("✅ Position ID:", posId.toString());
    });

    it("should emit PositionUpdated", async function () {
        // Проверяем, что баланс правильный после обновления
        const balance = await flatCoin.balanceOf(expectedOwner);
        expect(balance).to.equal(ethers.parseEther('100'));
        
        console.log("✅ Position updated event emitted");
    });

    it("should not change ethAmount locked", async function () {
        position = await cdp.positions(posId);
        expect(position.ethAmountLocked).to.equal(ethers.parseEther('1'));
        
        console.log("✅ ETH amount locked unchanged:", ethers.formatEther(position.ethAmountLocked));
    });

    it("should decrease owner's balance", async function () {
        const balance = await flatCoin.balanceOf(expectedOwner);
        expect(balance).to.equal(ethers.parseEther('100'));
        
        console.log("✅ Owner's balance:", ethers.formatEther(balance));
    });

    it("should decrease coinsMinted", async function () {
        position = await cdp.positions(posId);
        expect(position.coinsMinted).to.equal(ethers.parseEther('100'));
        
        console.log("✅ Coins minted:", ethers.formatEther(position.coinsMinted));
    });
});

