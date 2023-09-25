const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Weth = artifacts.require("./WETH9.sol");

const truffleAssert = require('truffle-assertions');

contract('CDP Update Increase', (accounts) => {
    let dao;
    let cdp;
    let oracle;
    let stableCoin;
    let positionBefore;
    let positionAfter;
    let positionTx;
    let positionUpdate;
    let pos;
    let fee;
    let weth;
    let id;
    let posId;
    const owner = accounts[2];

    before('should setup the contracts instance', async () => {
        weth = await Weth.deployed();
        dao = await INTDAO.deployed(weth.address);
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        positionTx = await cdp.openCDP(web3.utils.toWei('2000', 'ether'), {
            from: owner,
            value: web3.utils.toWei('1', 'ether')
        });

        await truffleAssert.eventEmitted(positionTx, 'PositionOpened', async (ev) => {
            posId = ev.posID;
        });

        expectedOwner = owner;
        positionBefore = await cdp.positions(posId);
        await time.increase(time.duration.years(1));
        fee = await cdp.interestAmountUnrecorded(posId);

        positionUpdate = await cdp.updateCDP(posId, web3.utils.toWei('2100', 'ether'), {from: owner,value: web3.utils.toWei('1', 'ether')});
        await time.increase(time.duration.seconds(1));
        await cdp.updateCDP(posId, web3.utils.toWei('2100', 'ether'), {from: owner});
        positionAfter = await cdp.positions(posId);
    });

    it("should emit PositionUpdated with right parameters", async () => {
        await truffleAssert.eventEmitted(positionUpdate, 'PositionUpdated', async (ev) => {
            assert.equal(ev.posID, posId.toNumber(), 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('2100', 'ether'), 'amount is wrong');
        });
    });

    it("should properly calculate maxCoins to mint", async () => {
        const coins = await cdp.getMaxStableCoinsToMintForPos(posId);
        assert.equal(parseFloat(coins/10**18).toFixed(3), parseFloat(4160).toFixed(3), "should decrease amount as fee is growing");
    });

    it("should increase overall fee", async () => {
        let recordedFee = positionAfter.interestAmountRecorded;
        assert.equal(parseFloat(recordedFee/10**18).toFixed(3), 180.000, "should increase overall fee");

        let overallFee = await cdp.totalCurrentFee(posId);
        assert.equal(parseFloat(overallFee/10**18).toFixed(3), 180.000, "should increase overall fee");
    });

    it("should increase owner balance", async () => {
        const balance = await stableCoin.balanceOf(positionBefore.owner);
        assert.equal(balance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoin");
    });

    it("should transfer fee to CDP, increase stability fund and decrease owners balance", async () => {
        const balanceBefore = await stableCoin.balanceOf(cdp.address);
        var ownerBalance = await stableCoin.balanceOf(positionBefore.owner);
        assert.equal(ownerBalance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoins before");
        await stableCoin.approve(cdp.address, fee+1000, {from: owner});
        await cdp.transferInterest(posId);
        ownerBalance = await stableCoin.balanceOf(positionBefore.owner);

        assert.equal(parseFloat(ownerBalance/10**18).toFixed(3), parseFloat(1920).toFixed(3), "owner's balance should be 1920 stableCoins after");

        const balanceAfter = await stableCoin.balanceOf(cdp.address);
        assert.equal(parseFloat(balanceBefore/10**18).toFixed(3), parseFloat(0).toFixed(3), "should be empty CDP contract balance");
        assert.equal(parseFloat(balanceAfter/10**18).toFixed(3), parseFloat(fee/10**18).toFixed(3), "should put fee on CDP contract balance");
    });

    it("should increase ethAmount locked", async () => {
        assert.equal(positionAfter.wethAmountLocked, web3.utils.toWei('2','ether'), "ethAmountLocked should be 2 ethers");
    });

    it("should put 1 ether on contract's balance", async () => {
        const contractBalance = await weth.balanceOf(cdp.address);
        assert.equal(contractBalance, web3.utils.toWei('2','ether'), "contract's balance should be 2 ethers");
    });

    it("should increase generated fee", async () => {
        assert.equal(parseFloat(positionAfter.interestAmountRecorded/10**18).toFixed(3), parseFloat(180).toFixed(3), "should increase generated fee");
        assert.equal(parseFloat(positionAfter.interestAmountRecorded/10**18).toFixed(3), parseFloat(fee/10**18).toFixed(3), "should increase generated fee");
    });

    it("should not allow to mint coins due to feeGenerated", async () => {
        let account = accounts[3];

        pos = await cdp.openCDP(web3.utils.toWei('1000', 'ether'), {
            from: account,
            value: web3.utils.toWei('1', 'ether')
        });

        truffleAssert.eventEmitted(pos, 'PositionOpened', async (ev) => {
            assert.equal(ev.owner, accounts[3], 'position owner is wrong');
            assert.equal(ev.posID, 1, 'id is wrong');
            id = ev.posID;
        });

        await time.increase(time.duration.years(1));//1 year in seconds. It may sometimes fail

        await truffleAssert.fails(
            cdp.updateCDP(id, web3.utils.toWei('2100', 'ether'), {from: account}),
            truffleAssert.ErrorType.REVERT,
            "not enough collateral to mint amount");

        truffleAssert.eventEmitted(
            await cdp.updateCDP(id, web3.utils.toWei('2079'), {from: account}),
            'PositionUpdated', async (ev) => {
            assert.equal(ev.posID.toString(), id.toString(), 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('2079'), 'amount is wrong');
        });
    });

    it("should increase coinsMinted", async () => {
        const posAft = await cdp.positions(id);
        assert.equal(posAft.coinsMinted, web3.utils.toWei('2079'), "increase coinsMinted");
    });

});
