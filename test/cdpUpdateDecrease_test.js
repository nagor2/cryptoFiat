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
    let position;
    let positionID;
    let positionUpdate;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        positionID = await cdp.openCDP(web3.utils.toWei('2000', 'ether'), {
            from: accounts[2],
            value: web3.utils.toWei('1', 'ether')
        });

        posId = 0;

        expectedOwner = accounts[2];

        position = await cdp.positions(posId);

        console.log(expectedOwner);
        console.log(position.owner);

        positionUpdate = await cdp.updateCDP(posId, web3.utils.toWei('2100', 'ether'), {from: accounts[2],value: web3.utils.toWei('1', 'ether')});
    });

    it("should emit PositionUpdated", async () => {
        truffleAssert.eventEmitted(positionUpdate, 'PositionUpdated', async (ev) => {
            //expect(ev.posID).to.eql(0,"positionID is wrong");
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('2100', 'ether'), 'amount is wrong');
        });
    });

    it("should increase ethAmount locked", async () => {
        position = await cdp.positions(posId);
        assert.equal(position.ethAmountLocked, web3.utils.toWei('2','ether'), "ethAmountLocked should be 2 ethers");
    });

    it("should put 1 ether on contract's balance", async () => {
        const contractBalance = await web3.eth.getBalance(cdp.address);
        assert.equal(contractBalance, web3.utils.toWei('2','ether'), "contract's balance should be 2 ethers");
    });

    it("should increase owner balance", async () => {
        const balance = await stableCoin.balanceOf(position.owner);
        assert.equal(balance, web3.utils.toWei('2100', 'ether'), "owner's balance should be 2100 stableCoin");
    });

    it("burn coins if needed", async () => {
        //const contractBalance = await web3.eth.getBalance(cdp.address);
        //assert.equal(contractBalance, web3.utils.toWei('1','ether'), "contract's balance should be 1 ether");
    });
});