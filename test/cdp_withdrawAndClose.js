const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');
const { getContractAddress } = require('@ethersproject/address')


contract('CDP withdraw and close position', (accounts) => {

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var Weth = artifacts.require("./WETH9.sol");
    var StableCoin = artifacts.require("./stableCoin.sol");

    let posId;
    const owner = accounts[6];

    let coin;

    before('should setup the contracts and open pos', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        weth = await Weth.deployed();

        oracle = await Oracle.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        coin = await StableCoin.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([weth.address, cdp.address, 0x0, 0x0, oracle.address, 0x0, 0x0, coin.address, 0x0]);

        await cdp.renewContracts();
        
        let posTx = await cdp.openCDP(web3.utils.toWei('1000', 'ether'), {
            from: owner,
            value: web3.utils.toWei('1', 'ether')
        });

        truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
            posId = ev.posID.toNumber();
        });


    });

    it ("should init position", async ()=>{
        let position = await cdp.positions(posId);
        assert.equal(position.wethAmountLocked, web3.utils.toWei('1', 'ether'), "wethLocked is wrong");
        assert.equal(await weth.balanceOf(cdp.address), web3.utils.toWei('1', 'ether'), "wethLocked is wrong");
    });

    it("should withdrawEther", async () => {
        let toWithdraw = web3.utils.toWei('0.1', 'ether');
        assert.equal(await weth.balanceOf(owner), 0, "weth balance is wrong");
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

        await oracle.updateSinglePrice(0, 5100000000, {from: accounts[5]});

        let posTx = await cdp.withdrawEther(posId, web3.utils.toWei('0.4', 'ether'), {from:owner});

        truffleAssert.eventEmitted(posTx, 'PositionUpdated', async (ev) => {
            assert.equal(posId, ev.posID.toNumber(), "id is wrong");
            assert.equal(web3.utils.toWei('1000', 'ether'), ev.newStableCoinsAmount, "newStableCoinsAmount is wrong");
            assert.equal(web3.utils.toWei('0.5', 'ether'), ev.wethLocked, "wethLocked is wrong");
        });

        assert.equal(await weth.balanceOf(owner), web3.utils.toWei('0.5', 'ether'), "wethLocked is wrong");
    });

    it("should close position", async () => {

        await cdp.openCDP(web3.utils.toWei('200', 'ether'), {
            from: accounts[3],
            value: web3.utils.toWei('0.2', 'ether')
        });

        await coin.transfer(owner, web3.utils.toWei('100', 'ether'), {from:accounts[3]});

        await coin.approve(cdp.address, web3.utils.toWei('1100', 'ether'),{from:owner});

        assert.equal(await coin.totalSupply(), web3.utils.toWei('1200', 'ether'), "wrong totalSupply");

        let currentFee = await cdp.totalCurrentFee(posId);

        assert.equal(parseFloat(currentFee/10**18).toFixed(3),parseFloat('90').toFixed(3), "wrong fee");


        await truffleAssert.fails(
            cdp.closeCDP(posId),
            truffleAssert.ErrorType.REVERT,
            "Only owner may close his position"
        );

        await cdp.closeCDP(posId,{from:owner});

        assert.equal(await weth.balanceOf(owner), web3.utils.toWei('1', 'ether'), "weth on balance is wrong");

        assert.equal(parseFloat(await coin.totalSupply()/10**18).toFixed(4), 200.0000, "wrong totalSupply");

        assert.equal(parseFloat(await coin.balanceOf(owner)/10**18).toFixed(3), 10.000, "wrong totalSupply");
        assert.equal(parseFloat(await coin.balanceOf(await dao.addresses('cdp'))/10**18).toFixed(3), 90.000, "wrong totalSupply");
        assert.equal(parseFloat(await coin.balanceOf(accounts[3])/10**18).toFixed(4), 100.0000, "wrong totalSupply");
    });
});