const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');

contract('CDP margin call', (accounts) => {

    let dao;
    let cdp;
    let weth;
    let oracle;
    let stableCoin;
    let auction;
    let posId;
    const author = accounts[5];

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var StableCoin = artifacts.require("./stableCoin.sol");
    var Auction = artifacts.require("./Auction.sol");
    var Weth = artifacts.require("./WETH9.sol");

    before('should setup the contracts instance', async () => {
        weth = await Weth.deployed();
        dao = await INTDAO.deployed(weth.address);
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
        auction = await Auction.deployed(dao.address);
    });

    it("should openCDP", async () => {
        let owner = accounts[5];
        let recipient = accounts[8];
        let coinsMintAmount = 1000;
        let posTx = await cdp.openCDP(web3.utils.toWei(String(coinsMintAmount), 'ether'), {from: owner,value: web3.utils.toWei('1', 'ether')});
        await truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
            posId = ev.posId.toNumber();
        });

        const position = await cdp.positions(posId);
        let actualBalance = await stableCoin.balanceOf(position.owner);
        assert.equal(actualBalance.toString(),web3.utils.toWei(String(coinsMintAmount), 'ether'),"smth wrong");
    });

    it("should not mark pos on liquidation if eth value is still enough and mark if not", async () => {
        await oracle.updateSinglePrice(0, 3000000000, {from: author});
        let markTx = await cdp.markToLiquidate(posId);
        truffleAssert.eventNotEmitted(markTx,'markedOnLiquidation');
        await oracle.updateSinglePrice(0, 1428000000, {from: author});
        markTx = await cdp.markToLiquidate(posId);
        truffleAssert.eventEmitted(markTx, 'markedOnLiquidation', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            let block = await web3.eth.getBlock("latest");
            assert.equal(ev.timestamp, block.timestamp, 'time is wrong');
            let position = await cdp.positions(posId);
            block = await web3.eth.getBlock("latest");
            assert.equal(position.markedOnLiquidationTimestamp.toString(), block.timestamp, "time is wrong 2")
        });
        await oracle.updateSinglePrice(0, 3100000000, {from: author});
    });
});