var INTDAO = artifacts.require("./INTDAO.sol");
var Platform = artifacts.require("./Platform.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Token = artifacts.require("./tokenTemplate.sol");

contract('Platform', (accounts) => {
    let dao;
    let platform;
    let coin;
    let token;

    const author = accounts[2];
    const minter = accounts[8];
    const team = accounts[7];

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed(0x0);
        coin = await StableCoin.deployed(dao.address);
        platform = await Platform.deployed(dao.address, {from: author});

    });

    it("should put initialSupply on authors balance", async () => {
        let supply = await platform.balanceOf(author);
        assert.equal (supply,web3.utils.toWei('1000000'),"should put platform tokens on owner's balance");
    });

    it("should change minter", async () => {
        await platform.changeMinter(minter, {from:author});
        let newMinter = await platform.tokenMinter();
        assert.equal (newMinter,minter,"wrong minter");
    });

    it("should deploy token", async () => {
        let addresses = [team, coin.address, platform.address]; //teamAddress, coin, platform
        let params = [10, 1000, 5, 6, 70, 5184000, 604800, 600]; /*initialPrice, initialSupply, platformFeePercent,
                                             number of stages, percentOfTokensToTeam,
                                             crowdsaleDuration in seconds (30 days)
                                             holdDuration (7 days), softCap*/
        let budgetPercent = [5, 10, 10, 10, 15, 20, 30];
        let extraChargePercent = [10, 20, 30, 40, 50, 100];
        let stagesDuration = [2592000,2592000,2592000,2592000,2592000,2592000];
        let stagesShortDescription = ["first stage bla-bla-bla", "second stage bla-bla-bla",
            "third stage bla-bla-bla", "fourth stage bla-bla-bla", "fifth stage bla-bla-bla",
            "sixth stage bla-bla-bla"];

        token = await Token.deployed(addresses, params, "start", "Startup token",
            budgetPercent, extraChargePercent, stagesDuration, stagesShortDescription, {from: minter});
    });

    it("should set minted token address", async () => {
        let before = await platform.mintedTokens(token.address);
        assert.equal(before, false, "no address");
        await platform.addMintedToken(token.address, {from:minter});
        let after = await platform.isMintedByPlatform(token.address);
        assert.equal(after, true, "should set address");
    });

});

