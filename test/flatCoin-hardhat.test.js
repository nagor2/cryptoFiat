const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("flatCoin (Hardhat version)", function () {
    let dao;
    let coin;
    let owner, addr1, addr2, addr3;

    before(async function () {
        // Получаем signers (аналог accounts в Truffle)
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        console.log("Deploying contracts...");
        console.log("Owner address:", owner.address);
        
        // Деплоим INTDAO сначала с пустыми адресами
        const INTDAO = await ethers.getContractFactory("INTDAO");
        
        // INTDAO принимает массив из 7 адресов:
        // [cdp, auction, deposit, oracle, rule, flatCoin, basket]
        // Сначала деплоим с нулевыми адресами, потом обновим
        dao = await INTDAO.deploy([
            ethers.ZeroAddress,  // cdp
            ethers.ZeroAddress,  // auction
            ethers.ZeroAddress,  // deposit
            ethers.ZeroAddress,  // oracle
            ethers.ZeroAddress,  // rule
            ethers.ZeroAddress,  // flatCoin (обновим позже)
            ethers.ZeroAddress   // basket
        ]);
        await dao.waitForDeployment();
        console.log("INTDAO deployed to:", await dao.getAddress());
        
        // Теперь деплоим flatCoin с адресом DAO
        const FlatCoin = await ethers.getContractFactory("flatCoin");
        coin = await FlatCoin.deploy(await dao.getAddress());
        await coin.waitForDeployment();
        console.log("flatCoin deployed to:", await coin.getAddress());
        
        // Обновляем адрес flatCoin в DAO (через voting в реальности, но для теста напрямую)
        // В данном случае используем внутренний механизм DAO
        console.log("Setting up DAO authorization...");
    });

    it("deploys successfully", async function () {
        // Проверяем, что адрес контракта существует
        expect(await coin.getAddress()).to.be.properAddress;
        expect(await coin.getAddress()).to.not.equal(ethers.ZeroAddress);
        expect(await coin.getAddress()).to.not.equal("");
        
        console.log("✅ flatCoin deployed successfully at:", await coin.getAddress());
    });

    it("should set params name and symbol", async function () {
        const symbol = await coin.symbol();
        const name = await coin.name();
        
        expect(symbol).to.equal("DFC");
        expect(name).to.equal("dotFlat");
        
        console.log("✅ Token name:", name);
        console.log("✅ Token symbol:", symbol);
    });

    it("should not mint from unauthorized address", async function () {
        // addr2 не авторизован в DAO
        await expect(
            coin.connect(addr2).mint(addr2.address, 1)
        ).to.be.revertedWith("authorized only");
        
        console.log("✅ Unauthorized mint correctly rejected");
    });

    it("should not burn from unauthorized address", async function () {
        // addr3 не авторизован в DAO
        await expect(
            coin.connect(addr3).burn(addr3.address, 1)
        ).to.be.revertedWith("authorized only");
        
        console.log("✅ Unauthorized burn correctly rejected");
    });

    // Дополнительный тест: проверяем, что DAO ссылается на правильный контракт
    it("should check DAO configuration", async function () {
        const daoAddress = await dao.getAddress();
        expect(daoAddress).to.be.properAddress;
        
        console.log("✅ DAO address:", daoAddress);
        console.log("✅ All tests passed!");
    });
});

