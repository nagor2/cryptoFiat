const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');
const { getContractAddress } = require('@ethersproject/address')


contract('CDP withdraw and close position', (accounts) => {

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var FlatCoin = artifacts.require("./flatCoin.sol");

    let posId;
    const owner = accounts[6];

    let flatCoin;

    before('should setup the contracts and open pos', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})

        oracle = await Oracle.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        flatCoin = await FlatCoin.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([cdp.address, 0x0, 0x0, oracle.address, 0x0, flatCoin.address, 0x0]);

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
        assert.equal(position.ethAmountLocked, web3.utils.toWei('1', 'ether'), "ethLocked is wrong");
        assert.equal(await web3.eth.getBalance(cdp.address), web3.utils.toWei('1', 'ether'), "ethLocked is wrong");
    });

    it("should withdrawEther", async () => {
        let toWithdraw = web3.utils.toWei('0.1', 'ether');
        let ownerBalanceBefore = await web3.eth.getBalance(owner);
        let tx = await cdp.withdrawEther(posId, toWithdraw, {from:owner});
        //console.dir (tx);
        assert.equal(await web3.eth.getBalance(owner), web3.utils.toBN(ownerBalanceBefore).sub(web3.utils.toBN(tx.receipt.gasUsed*tx.receipt.effectiveGasPrice)).add(web3.utils.toBN(toWithdraw)).toString(), "eth balance of owner is wrong");
        assert.equal(await web3.eth.getBalance(cdp.address), web3.utils.toWei('0.9', 'ether'), "cdp.address balance is wrong");
    });

    it("should fail if claimed amount is too big", async () => {
        await truffleAssert.fails(
            cdp.withdrawEther(posId, web3.utils.toWei('0.91', 'ether'), {from:owner}),
            truffleAssert.ErrorType.REVERT,
            "too many eth claimed"
        );

        await time.increase(time.duration.years(1));

        await truffleAssert.fails(
            cdp.withdrawEther(posId, web3.utils.toWei('0.4', 'ether'), {from:owner}),
            truffleAssert.ErrorType.REVERT,
            "not enough eth"
        );

        await oracle.updateSinglePrice(1, 5100000000, {from: accounts[5]});
        let ownerBalanceBefore = await web3.eth.getBalance(owner);
        let posTx = await cdp.withdrawEther(posId, web3.utils.toWei('0.4', 'ether'), {from:owner});

        truffleAssert.eventEmitted(posTx, 'PositionUpdated', async (ev) => {
            assert.equal(posId, ev.posID.toNumber(), "id is wrong");
            assert.equal(web3.utils.toWei('1000', 'ether'), ev.newFlatCoinsAmount, "newFlatCoinsAmount is wrong");
            assert.equal(web3.utils.toWei('0.5', 'ether'), ev.ethLocked, "ethLocked is wrong");
        });

        assert.equal(await web3.eth.getBalance(owner), web3.utils.toBN(ownerBalanceBefore).sub(web3.utils.toBN(posTx.receipt.gasUsed*posTx.receipt.effectiveGasPrice)).add(web3.utils.toBN(web3.utils.toWei('0.4', 'ether'))).toString(), "ethLocked is wrong");
    });

    it("should close position", async () => {

        await cdp.openCDP(web3.utils.toWei('200', 'ether'), {
            from: accounts[3],
            value: web3.utils.toWei('0.2', 'ether')
        });

        await flatCoin.transfer(owner, web3.utils.toWei('100', 'ether'), {from:accounts[3]});

        await flatCoin.approve(cdp.address, web3.utils.toWei('1100', 'ether'),{from:owner});

        assert.equal(await flatCoin.totalSupply(), web3.utils.toWei('1200', 'ether'), "wrong totalSupply");

        let currentFee = await cdp.totalCurrentFee(posId);

        assert.equal(parseFloat(currentFee/10**18).toFixed(3),parseFloat('90').toFixed(3), "wrong fee");


        await truffleAssert.fails(
            cdp.closeCDP(posId),
            truffleAssert.ErrorType.REVERT,
            "only owner"
        );
        let ownerBalanceBefore = await web3.eth.getBalance(owner);
        let tx = await cdp.closeCDP(posId,{from:owner});

        assert.equal(await web3.eth.getBalance(owner), web3.utils.toBN(ownerBalanceBefore).sub(web3.utils.toBN(tx.receipt.gasUsed*tx.receipt.effectiveGasPrice)).add(web3.utils.toBN(web3.utils.toWei('0.5', 'ether'))).toString(), "weth on balance is wrong");

        assert.equal(parseFloat(await flatCoin.totalSupply()/10**18).toFixed(4), 200.0000, "wrong totalSupply");

        assert.equal(parseFloat(await flatCoin.balanceOf(owner)/10**18).toFixed(3), 10.000, "wrong totalSupply");
        assert.equal(parseFloat(await flatCoin.balanceOf(await dao.addresses('cdp'))/10**18).toFixed(3), 90.000, "wrong totalSupply");
        assert.equal(parseFloat(await flatCoin.balanceOf(accounts[3])/10**18).toFixed(4), 100.0000, "wrong totalSupply");
    });
});