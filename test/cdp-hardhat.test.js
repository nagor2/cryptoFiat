const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFullSystem, openCDP, formatFixed } = require("./helpers/contracts");

describe("CDP (Hardhat version)", function () {
    let dao, cdp, rule, oracle, flatCoin;
    let owner, user, expectedOwner;
    let posNumber, positionID;
    let accounts;

    before(async function () {
        console.log("Deploying CDP test contracts...");
        
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true
        });
        dao = system.dao;
        cdp = system.cdp;
        rule = system.rule;
        oracle = system.oracle;
        flatCoin = system.flatCoin;
        owner = system.owner;
        accounts = system.accounts;
        user = system.accounts[0];
        expectedOwner = user.address;
        
        posNumber = await cdp.numPositions();
        
        // Открываем CDP
        positionID = await openCDP(cdp, {
            signer: user,
            coinsToMint: ethers.parseEther('8000'),
            ethValue: ethers.parseEther('1')
        });
        
        console.log("✅ CDP position opened, ID:", positionID.toString());
    });

    it("should create a valid Position", async function () {
        const position = await cdp.positions(positionID);
        
        expect(position.owner).to.equal(expectedOwner);
        expect(position.ethAmountLocked).to.equal(ethers.parseEther('1'));
        expect(position.interestAmountRecorded).to.equal(0n);
        
        const rate = await dao.params('interestRate');
        expect(position.interestRate).to.equal(rate);
        
        expect(position.coinsMinted).to.equal(ethers.parseEther('2170'));
        
        console.log("✅ Position created correctly");
        console.log("  Owner:", position.owner);
        console.log("  ETH locked:", ethers.formatEther(position.ethAmountLocked));
        console.log("  Coins minted:", ethers.formatEther(position.coinsMinted));
    });

    it("should mint max 2170 coins per 1 ether", async function () {
        const coins = await cdp.getMaxFlatCoinsToMint(ethers.parseEther('1'));
        expect(coins).to.equal(ethers.parseEther('2170'));
        
        console.log("✅ Max coins per ETH:", ethers.formatEther(coins));
    });

    it("should put 1 ether on contract's balance", async function () {
        const balance = await ethers.provider.getBalance(await cdp.getAddress());
        expect(balance).to.equal(ethers.parseEther('1'));
        
        console.log("✅ CDP balance:", ethers.formatEther(balance), "ETH");
    });

    it("should mint coins", async function () {
        const position = await cdp.positions(posNumber);
        const coinsMinted = position.coinsMinted;
        const balance = await flatCoin.balanceOf(position.owner);
        
        expect(coinsMinted).to.equal(balance);
        
        console.log("✅ Coins minted and distributed correctly");
    });

    it("time rewind and increase interest fee", async function () {
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        const fee = await cdp.interestAmountUnrecorded(0);
        const feeFormatted = formatFixed(fee);
        
        // Допускаем небольшую погрешность из-за времени
        expect(feeFormatted).to.be.closeTo(195.3, 0.01);
        
        console.log("✅ Interest fee after 1 year:", feeFormatted);
    });

    it("should increase numPositions", async function () {
        const numPos = await cdp.numPositions();
        expect(numPos).to.equal(posNumber + 1n);
        
        console.log("✅ Number of positions:", numPos.toString());
    });

    it("should throw if update from another account", async function () {
        const wrongAccount = accounts[8];
        
        await expect(
            cdp.connect(wrongAccount).updateCDP(positionID, ethers.parseEther('100'))
        ).to.be.revertedWith("only owner");
        
        console.log("✅ Update from wrong account correctly rejected");
    });
});

