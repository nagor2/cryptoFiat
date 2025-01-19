const {getContractAddress} = require("@ethersproject/address");
const truffleAssert = require("truffle-assertions");
const {time, expectEvent} = require("@openzeppelin/test-helpers");
const assert = require("assert");

contract('CDP several auctions to close position', (accounts) => {
    let dao;
    let cdp;
    let oracle;
    let flatCoin;
    let auction;
    const posId = 0;
    let rule;

    const owner = accounts[5];
    const bidder = accounts[8];

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var FlatCoin = artifacts.require("./flatCoin.sol");
    var Auction = artifacts.require("./Auction.sol");
    var Rule = artifacts.require("./Rule.sol");

    before('should setup the contracts instance', async () => {

        let futureDaoAddress;
/*
        for (var i=-10; i< 10; i++){
            futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))+i)})
            console.log(i+") "+futureDaoAddress);
        }*/

        futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-5)})
        rule = await Rule.deployed(futureDaoAddress);
        oracle = await Oracle.deployed(futureDaoAddress, {from:accounts[5]});
        flatCoin = await FlatCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        auction = await Auction.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([cdp.address, auction.address, 0x0, oracle.address, rule.address, flatCoin.address, 0x0]);

        //console.log(dao.address)

        await cdp.renewContracts();
        await auction.renewContracts();
    });

    it("should open a cdp", async () => {
        await cdp.openCDP(web3.utils.toWei('1000'), {from:owner, value: web3.utils.toWei('1')})
        assert.equal(await flatCoin.totalSupply(), web3.utils.toWei('1000'), "wrong totalSupply");
        assert.equal(await flatCoin.balanceOf(owner), web3.utils.toWei('1000'), "wrong balanceOf owner");
    });

    it("should change a quote and mark to liquidate position", async () => {
        await oracle.updateSinglePrice(1, 1100000000, {from: accounts[5]});
        assert.equal(await oracle.getPrice('eth'), '1100000000', "wrong price");

        let tx = await cdp.markToLiquidate(posId);

        truffleAssert.eventEmitted(tx, 'liquidationStatusChanged', async (ev) => {
            assert.equal(ev.posID, posId, "id should be set to 0");
            assert.equal(ev.liquidationStatus, 1, "liquidationStatus should be set to 1");
        });
    });

    it("should liquidate position", async () => {
        await time.increase(await dao.params("marginCallTimeLimit"));
        let tx = await cdp.claimMarginCall(posId);

        truffleAssert.eventEmitted(tx, 'liquidationStatusChanged', async (ev) => {
            assert.equal(ev.posID, posId, "id should be set to 1");
            assert.equal(ev.liquidationStatus, 2, "liquidationStatus should be set to 1");
        });

        truffleAssert.eventEmitted(tx, 'liquidateCollateral', async (ev) => {
            assert.equal(ev.auctionID, 1, "wrong auctionID");
            assert.equal(ev.posID, posId, "wrong posID");
            assert.equal(ev.collateral, web3.utils.toWei('1'), "liquidationStatus should be set to 1");
        });

        await expectEvent.inTransaction(tx.tx, auction, 'newAuction', { auctionID:web3.utils.toBN(1), lotAmount:web3.utils.toWei('1'), lotAddress:'0x0000000000000000000000000000000000000000', paymentAmount:web3.utils.toBN(0)});

        assert.equal((await cdp.positions(posId)).liquidationAuctionID, 1, "wrong auction id");
    });

    it("should bid and finish auction", async () => {
        await oracle.updateSinglePrice(1, 3100000000, {from: accounts[5]});
        await cdp.openCDP(web3.utils.toWei('2000'), {from:bidder, value: web3.utils.toWei('1')})
        await flatCoin.transfer(await dao.addresses('cdp'), web3.utils.toWei('10'), {from:bidder});

        await flatCoin.approve(await dao.addresses('auction'), web3.utils.toWei('980'), {from:bidder});
        await auction.makeBid(1,web3.utils.toWei('980'), {from:bidder});
        await time.increase(await dao.params("auctionTurnDuration"));

        await truffleAssert.fails(
            auction.claimToFinalizeAuction(1),
            truffleAssert.ErrorType.REVERT,
            "CDP only");

        let tx = await cdp.finishMarginCall(0);

        await expectEvent.inTransaction(tx.tx, auction, 'newAuction', { auctionID:web3.utils.toBN(2), lotAmount:web3.utils.toBN(0), lotAddress:await dao.addresses('rule'), paymentAmount:web3.utils.toBN(web3.utils.toWei('10'))});

    });

});