const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Oracle = artifacts.require("./Oracle.sol");
var StableCoin = artifacts.require("./stableCoin.sol");

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
    const ownerId = 2;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
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

        await time.increase(31536000);//1 year in seconds. It may sometimes fail
        fee = await cdp.generatedFee(posId);

        positionUpdate = await cdp.updateCDP(posId, web3.utils.toWei('2100', 'ether'), {from: accounts[ownerId],value: web3.utils.toWei('1', 'ether')});

        positionAfter = await cdp.positions(posId);
    });

    it("should emit PositionUpdated with right parameters", async () => {
        truffleAssert.eventEmitted(positionUpdate, 'PositionUpdated', async (ev) => {
            //expect(ev.posID).to.eql(0,"positionID is wrong");
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('2100', 'ether'), 'amount is wrong');
        });
    });

    it("should increase ethAmount locked", async () => {
        assert.equal(positionAfter.ethAmountLocked, web3.utils.toWei('2','ether'), "ethAmountLocked should be 2 ethers");
    });

    it("should put 1 ether on contract's balance", async () => {
        const contractBalance = await web3.eth.getBalance(cdp.address);
        assert.equal(contractBalance, web3.utils.toWei('2','ether'), "contract's balance should be 2 ethers");
    });

    it("should increase owner balance", async () => {
        const balance = await stableCoin.balanceOf(positionBefore.owner);
        assert.equal(balance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoin");
    });

    it("should increase generated fee", async () => {
        assert.equal(parseFloat(positionAfter.feeGenerated/10**18).toFixed(4), parseFloat(fee/10**18).toFixed(4), "should increase generated fee");
    });
});