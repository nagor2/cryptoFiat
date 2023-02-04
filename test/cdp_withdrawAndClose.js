const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');

contract('CDP withdraw and close position', (accounts) => {

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var Weth = artifacts.require("./WETH9.sol");

    let posId;
    const owner = accounts[6];

    before('should setup the contracts and open pos', async () => {
        weth = await Weth.deployed();
        dao = await INTDAO.deployed(weth.address);
        oracle = await Oracle.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        let posTx = await cdp.openCDP(web3.utils.toWei('1000', 'ether'), {
            from: owner,
            value: web3.utils.toWei('1', 'ether')
        });

        truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
            posId = ev.posId.toNumber();
        });


    });

    it ("should init position", async ()=>{
        let position = await cdp.positions(posId);
        assert.equal(position.wethAmountLocked, web3.utils.toWei('1', 'ether'), "wethLocked is wrong");
        assert.equal(await weth.balanceOf(cdp.address), web3.utils.toWei('1', 'ether'), "wethLocked is wrong");
    });

    it("should withdrawEther", async () => {
        let toWithdraw = web3.utils.toWei('0.1', 'ether');
        assert.equal(await weth.balanceOf(owner), 0, "wethLocked is wrong");
        await cdp.withdrawEther(posId, toWithdraw, {from:owner});
        assert.equal(await weth.balanceOf(owner), toWithdraw, "wethLocked is wrong");
        assert.equal(await weth.balanceOf(cdp.address), web3.utils.toWei('0.9', 'ether'), "wethLocked is wrong");
    });

    it("should fail if claimed amount is too big", async () => {
        await truffleAssert.fails(
            cdp.withdrawEther(posId, web3.utils.toWei('0.91', 'ether'), {from:owner}),
            truffleAssert.ErrorType.REVERT,
            "You dont have enough weth locked on this pos"
        );

        await time.increase(time.duration.years(1));

        await truffleAssert.fails(
            cdp.withdrawEther(posId, web3.utils.toWei('0.4', 'ether'), {from:owner}),
            truffleAssert.ErrorType.REVERT,
            "you want to keep not enough weth to cover emission and current fee"
        );

        await oracle.updateSinglePrice(accounts[5], "eth", 0, 510000, {from: accounts[5]});

        let posTx = await cdp.withdrawEther(posId, web3.utils.toWei('0.4', 'ether'), {from:owner});

        truffleAssert.eventEmitted(posTx, 'PositionUpdated', async (ev) => {
            //uint256 posID, uint256 newStableCoinsAmount, uint256 wethLocked
            assert.equal(posId, ev.posID.toNumber(), "id is wrong");
            assert.equal(web3.utils.toWei('1000', 'ether'), ev.newStableCoinsAmount, "newStableCoinsAmount is wrong");
            assert.equal(web3.utils.toWei('0.5', 'ether'), ev.wethLocked, "wethLocked is wrong");
        });

        assert.equal(await weth.balanceOf(owner), web3.utils.toWei('0.5', 'ether'), "wethLocked is wrong");

    });


});