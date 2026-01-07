const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullSystem } = require("./helpers/contracts");

describe("Basket (Hardhat version)", function () {
    let dao, basket, eRC;
    let owner, exRAuthour;

    before(async function () {
        console.log("Deploying Basket contracts...");
        
        const signers = await ethers.getSigners();
        exRAuthour = signers[5];
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true,
            oracleAuthor: exRAuthour
        });
        
        dao = system.dao;
        basket = system.basket;
        eRC = system.oracle;
        owner = system.owner;
        
        const sharesCount = await basket.sharesCount();
        const itemsCount = await basket.itemsCount();
        
        expect(sharesCount).to.equal(15n);
        expect(itemsCount).to.equal(2n);
        
        console.log("✅ Basket deployed to:", await basket.getAddress());
        console.log("✅ Shares count:", sharesCount.toString());
        console.log("✅ Items count:", itemsCount.toString());
    });

    it("should return valid share/stb price", async function () {
        const sharePrice = await basket.getCurrentSharePriceChange();
        expect(sharePrice).to.equal(10n ** 6n);
        
        const ethVsCommodities = await basket.getEthereumVSCommoditiesPriceChange();
        expect(ethVsCommodities).to.equal(3100n * 10n ** 6n);
        
        console.log("✅ Share price:", sharePrice.toString());
        console.log("✅ ETH vs Commodities:", ethVsCommodities.toString());
    });

    it("should return valid share/stb price after eth price update", async function () {
        await eRC.connect(exRAuthour).updateSinglePrice(1, 310000000);
        
        const sharePrice = await basket.getCurrentSharePriceChange();
        expect(sharePrice).to.equal(10n ** 6n);
        
        const ethVsCommodities = await basket.getEthereumVSCommoditiesPriceChange();
        expect(ethVsCommodities).to.equal(310n * 10n ** 6n);
        
        console.log("✅ Updated ETH vs Commodities:", ethVsCommodities.toString());
    });

    it("should return valid share/stb price after another update", async function () {
        await eRC.connect(exRAuthour).updateSinglePrice(1, 1550000000);
        
        const sharePrice = await basket.getCurrentSharePriceChange();
        expect(sharePrice).to.equal(10n ** 6n);
        
        const ethVsCommodities = await basket.getEthereumVSCommoditiesPriceChange();
        expect(ethVsCommodities).to.equal(1550n * 10n ** 6n);
        
        console.log("✅ Updated ETH vs Commodities:", ethVsCommodities.toString());
    });

    it("should return valid share/stb price if price changed", async function () {
        await eRC.connect(exRAuthour).updateSinglePrice(3, 455510000); // +10%
        await eRC.connect(exRAuthour).updateSinglePrice(2, 2241180000); // +20%
        
        const sharePrice = await basket.getCurrentSharePriceChange();
        expect(sharePrice).to.equal(BigInt(Math.floor(1.166666 * 10 ** 6)));
        
        const ethVsCommodities = await basket.getEthereumVSCommoditiesPriceChange();
        expect(ethVsCommodities).to.equal(BigInt(Math.floor(1328.572187 * 10 ** 6)));
        
        console.log("✅ Share price after changes:", sharePrice.toString());
        console.log("✅ ETH vs Commodities:", ethVsCommodities.toString());
    });

    it("should return valid share/stb price if share changed", async function () {
        const itemBefore = await basket.items(2);
        expect(itemBefore.share).to.equal(5n);
        
        await basket.connect(exRAuthour).setShare(2, 10);
        
        const itemAfter = await basket.items(2);
        expect(itemAfter.share).to.equal(10n);
        
        const sharesCount = await basket.sharesCount();
        expect(sharesCount).to.equal(20n);
        
        const sharePrice = await basket.getCurrentSharePriceChange();
        expect(sharePrice).to.equal(BigInt(Math.floor(1.150000 * 10 ** 6)));
        
        const ethVsCommodities = await basket.getEthereumVSCommoditiesPriceChange();
        expect(ethVsCommodities).to.equal(BigInt(Math.floor(1347.826086 * 10 ** 6)));
        
        console.log("✅ Updated share:", itemAfter.share.toString());
        console.log("✅ New shares count:", sharesCount.toString());
    });

    after(async function () {
        // Reset prices
        await eRC.connect(exRAuthour).updateSinglePrice(2, 3100000000);
        await eRC.connect(exRAuthour).updateSinglePrice(2, 1867650000);
        await eRC.connect(exRAuthour).updateSinglePrice(3, 414100000);
        
        console.log("✅ Prices reset to initial values");
    });
});

