const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Rule (Hardhat version)", function () {
    let dao;
    let rule;
    let cdp;
    let owner, addr1, addr2, addr3, ruleHolder;

    before(async function () {
        [owner, addr1, addr2, addr3, , , , ruleHolder] = await ethers.getSigners();
        
        console.log("Deploying Rule token contracts...");
        
        // Деплоим INTDAO с нулевыми адресами
        const INTDAO = await ethers.getContractFactory("INTDAO");
        const CDP = await ethers.getContractFactory("CDP");
        const Rule = await ethers.getContractFactory("Rule");
        
        // Сначала деплоим контракты которые нужны для DAO
        dao = await INTDAO.deploy([
            ethers.ZeroAddress,  // cdp (обновим позже)
            ethers.ZeroAddress,  // auction
            ethers.ZeroAddress,  // deposit
            ethers.ZeroAddress,  // oracle
            ethers.ZeroAddress,  // rule (обновим позже)
            ethers.ZeroAddress,  // flatCoin
            ethers.ZeroAddress   // basket
        ]);
        await dao.waitForDeployment();
        
        // Деплоим Rule с адресом DAO
        rule = await Rule.connect(ruleHolder).deploy(await dao.getAddress());
        await rule.waitForDeployment();
        
        // Деплоим CDP
        cdp = await CDP.deploy(await dao.getAddress());
        await cdp.waitForDeployment();
        
        console.log("✅ Rule deployed to:", await rule.getAddress());
        console.log("✅ DAO deployed to:", await dao.getAddress());
    });

    it('deploys successfully', async function () {
        const address = await rule.getAddress();
        expect(address).to.be.properAddress;
        expect(address).to.not.equal("");
        expect(address).to.not.equal(ethers.ZeroAddress);
        
        console.log("✅ Rule token deployed at:", address);
    });

    it('should not mint from unauthorized address', async function () {
        await expect(
            rule.connect(addr2).mint(addr2.address, 1)
        ).to.be.revertedWith("authorized only");
        
        console.log("✅ Unauthorized mint correctly rejected");
    });

    it('should not burn from unauthorized address', async function () {
        await expect(
            rule.connect(addr3).burn(addr3.address, 1)
        ).to.be.revertedWith("authorized only");
        
        console.log("✅ Unauthorized burn correctly rejected");
    });

    it('should set params name and symbol', async function () {
        const symbol = await rule.symbol();
        const name = await rule.name();
        
        expect(symbol).to.equal("RLE");
        expect(name).to.equal("Rule token");
        
        console.log("✅ Token name:", name);
        console.log("✅ Token symbol:", symbol);
    });

    it('should mint initial supply for creator', async function () {
        const totalSupply = await rule.totalSupply();
        const creatorBalance = await rule.balanceOf(ruleHolder.address);
        
        expect(totalSupply).to.equal(ethers.parseEther('1000000'));
        expect(creatorBalance).to.equal(totalSupply);
        
        console.log("✅ Total supply:", ethers.formatEther(totalSupply));
        console.log("✅ Creator balance:", ethers.formatEther(creatorBalance));
    });
});

