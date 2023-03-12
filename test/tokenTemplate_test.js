var INTDAO = artifacts.require("./INTDAO.sol");
var Platform = artifacts.require("./Platform.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var CDP = artifacts.require("./CDP.sol");
var Token = artifacts.require("./tokenTemplate.sol");
const { time } = require('@openzeppelin/test-helpers');
const truffleAssert = require("truffle-assertions");
const assert = require("assert");

contract('Token template', (accounts) => {
    let dao;
    let platform;
    let coin;
    let token;
    let cdp;
    const buyer = accounts[3];
    const buyer2 = accounts[6];
    const author = accounts[2];
    const teamAddress = accounts[7];

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed(0x0);
        coin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
        platform = await Platform.deployed(dao.address, {from: author});

        let addresses = [teamAddress, coin.address, platform.address]; //teamAddress, coin, platform
        let params = [10, 1000, 5, 6, 70, 5184000, 604800, 600]; /*initialPrice, initialSupply, platformFeePercent,
                                             number of stages, percentOfTokensToTeam,
                                             crowdsaleDuration in seconds (30 days)
                                             holdDuration (7 days), softCap*/
        let budgetPercent = [5, 10, 10, 10, 15, 20, 30];
        let extraChargePercent = [0, 10, 20, 30, 40, 50, 100];
        let stagesDuration = [2592000,2592000,2592000,2592000,2592000,2592000];
        let stagesShortDescription = ["first stage bla-bla-bla", "second stage bla-bla-bla",
            "third stage bla-bla-bla", "fourth stage bla-bla-bla", "fifth stage bla-bla-bla",
            "sixth stage bla-bla-bla"];
        token = await Token.deployed(addresses, params, "start", "Startup token",
            budgetPercent, extraChargePercent, stagesDuration, stagesShortDescription, {from: author});

        await platform.addMintedToken(token.address, {from: author});
    });

    it("should deploy token", async () => {
        assert.equal("start", await token.symbol(),"wrong initial balance");
        assert.equal("Startup token", await token.name(),"wrong initial balance");
    });

    it("should put initial supply on contracts balance", async () => {
        let balance = await token.balanceOf(token.address);
        let supply = await token.totalSupply();
        assert.equal(balance.toString(), supply.toString(),"wrong initial balance");
    });

    it("should buyTokens", async () => {
        await cdp.openCDP(web3.utils.toWei('10000', 'ether'), {
            from: buyer,
            value: web3.utils.toWei('5', 'ether')
        });

        await coin.approve(token.address, web3.utils.toWei('1000'),{from:buyer});
        await token.buyTokens({from:buyer});

        let buyerBalance = await coin.balanceOf(buyer);
        assert.equal(buyerBalance.toString(), web3.utils.toWei('9000'),"should transfer stableCoins");

        let tokenBalance = await coin.balanceOf(token.address);
        assert.equal(tokenBalance.toString(), web3.utils.toWei('1000'),"should transfer stableCoins");

        let buyerTokenBalance = await token.balanceOf(buyer);
        assert.equal(buyerTokenBalance.toString(), web3.utils.toWei('100'),"should transfer tokens");
    });

    it("should return money and increase interest", async () => {
        time.increase(time.duration.days(30));

        await token.approve(token.address, web3.utils.toWei('100'), {from:buyer});
        await token.returnTokens({from:buyer});

        let buyerBalance = await coin.balanceOf(buyer);
        assert.equal(buyerBalance.toString(), web3.utils.toWei('10000'),"should transfer stableCoins back");

        let tokenBalance = await coin.balanceOf(token.address);
        assert.equal(tokenBalance.toString(), web3.utils.toWei('0'),"should transfer stableCoins back");

        let buyerTokenBalance = await token.balanceOf(buyer);
        assert.equal(buyerTokenBalance.toString(), web3.utils.toWei('0'),"should transfer tokens back");

        let contractTokenBalance = await token.balanceOf(token.address);
        assert.equal(contractTokenBalance.toString(), web3.utils.toWei('1000'),"should transfer tokens back");

        let interest = await coin.allowance(cdp.address, buyer);
        assert.equal(parseFloat(web3.utils.fromWei(interest)).toFixed(3), 6.575 ,"should increase interest");
    });

    it("should not allow to finalize PO", async () => {
        await truffleAssert.fails(
            token.finalizePublicOffer({from: teamAddress}),
            truffleAssert.ErrorType.REVERT,
            "too early to finalize crowdsale"
        );
    });

    it("should finalize public offer", async () => {
        await coin.approve(token.address, web3.utils.toWei('9000'),{from:buyer});
        await token.buyTokens({from:buyer});
        time.increase(time.duration.days(31));
        await token.finalizePublicOffer({from:teamAddress});

        assert.equal(await token.crowdSaleIsActive(), false, "crowdSaleIsActive should be set to false");
        let actualSupply = await token.totalSupply();
        assert.equal(parseFloat(web3.utils.fromWei(actualSupply)).toFixed(2), 3000.00, "supply should change correctly");

        let contractTokenBalance = await token.balanceOf(token.address);
        assert.equal(contractTokenBalance.toString(), web3.utils.toWei('2100'), "extra tokens should be placed on contract's balance");
    });

    it("should pass funds to team", async () => {
        await token.passFundsToTeam({from:teamAddress});
        let budgetSpentPercent = await token.totalBudgetSpent();
        assert.equal(budgetSpentPercent.toString(), '5', "wrong budget spent");
        let teamBalance = await coin.balanceOf(teamAddress);
        assert.equal(teamBalance.toString(), web3.utils.toWei('450'), "wrong teamBalance");
    });

    it("should fail to submit next stage because of time", async () => {
        await truffleAssert.fails(
            token.submitStage({from: teamAddress}),
            truffleAssert.ErrorType.REVERT,
            "too early to submit the stage"
        );
    });

    it("should submit next stage", async () => {
        time.increase(time.duration.days(30))
        await token.submitStage({from:teamAddress});
    });

    it("should not allow to pass fund to team due to holdDuration", async () => {
        await truffleAssert.fails(
            token.passFundsToTeam({from: teamAddress}),
            truffleAssert.ErrorType.REVERT,
            "Hold period is not finished yet"
        );
    });

    it("should let return funds from sold tokens, but freeze some", async () => {
        await token.transfer(buyer2, web3.utils.toWei('300'), {from:buyer});
        await token.returnTokens({from:buyer2});
        let tokensToSell = await token.tokensToSell();
        assert(tokensToSell.toString(), web3.utils.toWei('285'));
        let balance = await coin.balanceOf(buyer2);
        assert(balance.toString(), web3.utils.toWei('2850'));
        let tokenBalance = await token.balanceOf(buyer2);
        assert(tokenBalance.toString(), web3.utils.toWei('15'));
        let frozen = await token.frozen(buyer2);
        assert(frozen.toString(), web3.utils.toWei('15'));
        console.log(tokenBalance+' '+frozen);
    });

    it("should not let transfer frozen tokens", async () => {

        let balance = await token.balanceOf(buyer2);
        let frozen = await token.frozen(buyer2);
        console.log(balance+' '+frozen);

        await truffleAssert.fails(
            token.transfer(buyer, web3.utils.toWei('15'),{from: buyer2}),
            truffleAssert.ErrorType.REVERT,
            "You can not transfer frozen tokens"
        );
    });

    it("should let transfer unfrozen tokens", async () => {
        await token.transfer(buyer2, web3.utils.toWei('15'),{from: buyer});
        let balance = await token.balanceOf(buyer2);
        assert(balance.toString(), web3.utils.toWei('30'), "wrong balance");
        token.transfer(buyer, web3.utils.toWei('15'),{from: buyer2});
    });
});

