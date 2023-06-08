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
    let positionID;
    let positionUpdate;
    let fee;
    let weth;
    const ownerId = 2;

    before('should setup the contracts instance', async () => {
        weth = await Weth.deployed();
        dao = await INTDAO.deployed(weth.address);
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        positionID = await cdp.openCDP(web3.utils.toWei('2000', 'ether'), {
            from: accounts[2],
            value: web3.utils.toWei('1', 'ether')
        });

        posId = 0; // Костыль, хотя, если clean room...
        expectedOwner = accounts[ownerId];
        positionBefore = await cdp.positions(posId);
        await time.increase(time.duration.years(1));
        fee = await cdp.generatedFeeUnrecorded(posId);

        positionUpdate = await cdp.updateCDP(posId, web3.utils.toWei('2100', 'ether'), {from: accounts[ownerId],value: web3.utils.toWei('1', 'ether')});
        await time.increase(time.duration.seconds(1));
        await cdp.updateCDP(posId, web3.utils.toWei('2100', 'ether'), {from: accounts[ownerId]});
        positionAfter = await cdp.positions(posId);
    });

    it("should emit PositionUpdated with right parameters", async () => {
        truffleAssert.eventEmitted(positionUpdate, 'PositionUpdated', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('2100', 'ether'), 'amount is wrong');
        });
    });

    it("should properly calculate maxCoins to mint", async () => {
        const coins = await cdp.getMaxStableCoinsToMintForPos(posId);
        assert.equal(parseFloat(coins/10**18).toFixed(3), parseFloat(4160).toFixed(3), "should decrease amount as fee is growing");
    });

    it("should increase overall fee", async () => {
        //totalCurrentFee
        //const balance = await stableCoin.balanceOf(positionBefore.owner);
        //assert.equal(balance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoin");
    });

    it("should increase owner balance", async () => {
        const balance = await stableCoin.balanceOf(positionBefore.owner);
        assert.equal(balance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoin");
    });

    it("should transfer fee to CDP, increase stability fund and decrease owners balance", async () => {
        const balanceBefore = await stableCoin.balanceOf(cdp.address);
        var ownerBalance = await stableCoin.balanceOf(positionBefore.owner);
        assert.equal(ownerBalance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoins before");
        await stableCoin.approve(cdp.address, fee+1000, {from: accounts[ownerId]});
        await cdp.transferFee(posId);
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
        assert.equal(parseFloat(positionAfter.feeGeneratedRecorded/10**18).toFixed(3), parseFloat(180).toFixed(3), "should increase generated fee");
        assert.equal(parseFloat(positionAfter.feeGeneratedRecorded/10**18).toFixed(3), parseFloat(fee/10**18).toFixed(3), "should increase generated fee");
    });

    it("should not allow to mint coins due to feeGenerated", async () => {
        let account = accounts[3];

        let pos = await cdp.openCDP(web3.utils.toWei('1000', 'ether'), {
            from: account,
            value: web3.utils.toWei('1', 'ether')
        });

        let id;

        truffleAssert.eventEmitted(pos, 'PositionOpened', async (ev) => {
            assert.equal(ev.owner, accounts[3], 'position owner is wrong');
            assert.equal(ev.posId, 1, 'id is wrong');
            id = ev.posId;
        });

        await time.increase(time.duration.years(1));//1 year in seconds. It may sometimes fail

        await truffleAssert.fails(
            cdp.updateCDP(id, web3.utils.toWei('2100', 'ether'), {from: account}),
            truffleAssert.ErrorType.REVERT,
            "not enough collateral to mint amount");

        truffleAssert.eventEmitted(
            await cdp.updateCDP(id, web3.utils.toWei('2079', 'ether'), {from: account}),
            'PositionUpdated', async (ev) => {
            assert.equal(ev.posID.toString(), id.toString(), 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('2079', 'ether'), 'amount is wrong');
        });
    });
});

//TODO: check coinsMinted update