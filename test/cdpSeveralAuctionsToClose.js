const {getContractAddress} = require("@ethersproject/address");
const truffleAssert = require("truffle-assertions");
const {time, expectEvent} = require("@openzeppelin/test-helpers");
const assert = require("assert");

contract('CDP several auctions to close position', (accounts) => {
    let dao;
    let cdp;
    let weth;
    let oracle;
    let stableCoin;
    let auction;
    const posId = 0;
    let rule;

    const owner = accounts[5];
    const bidder = accounts[8];

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var StableCoin = artifacts.require("./stableCoin.sol");
    var Auction = artifacts.require("./Auction.sol");
    var Weth = artifacts.require("./WETH9.sol");
    var Rule = artifacts.require("./Rule.sol");

    before('should setup the contracts instance', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        weth = await Weth.deployed();

        rule = await Rule.deployed(futureDaoAddress);
        oracle = await Oracle.deployed(futureDaoAddress, {from:accounts[5]});
        stableCoin = await StableCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        auction = await Auction.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([weth.address, cdp.address, auction.address, 0x0, oracle.address, 0x0, rule.address, stableCoin.address, 0x0]);

        await cdp.renewContracts();
        await auction.renewContracts();
    });

    it("should open a cdp", async () => {
        await cdp.openCDP(web3.utils.toWei('1000'), {from:owner, value: web3.utils.toWei('1')})
        assert.equal(await stableCoin.totalSupply(), web3.utils.toWei('1000'), "wrong totalSupply");
        assert.equal(await stableCoin.balanceOf(owner), web3.utils.toWei('1000'), "wrong balanceOf owner");
    });

    it("should change a quote and mark to liquidate position", async () => {
        await oracle.updateSinglePrice(1, 1100000000, {from: accounts[5]});
        assert.equal(await oracle.getPrice('etc'), '1100000000', "wrong price");

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

        await expectEvent.inTransaction(tx.tx, auction, 'newAuction', { auctionID:web3.utils.toBN(1), lotAmount:web3.utils.toWei('1'), lotAddress:await dao.addresses('weth'), paymentAmount:web3.utils.toBN(0)});

        assert.equal((await cdp.positions(posId)).liquidationAuctionID, 1, "wrong auction id");
    });

    it("should bid and finish auction", async () => {
        await oracle.updateSinglePrice(1, 3100000000, {from: accounts[5]});
        await cdp.openCDP(web3.utils.toWei('2000'), {from:bidder, value: web3.utils.toWei('1')})
        await stableCoin.transfer(await dao.addresses('cdp'), web3.utils.toWei('100'), {from:bidder});

        await stableCoin.approve(await dao.addresses('auction'), web3.utils.toWei('500'), {from:bidder});
        await auction.makeBid(1,web3.utils.toWei('500'), {from:bidder});
        await time.increase(await dao.params("auctionTurnDuration"));

        await truffleAssert.fails(
            auction.claimToFinalizeAuction(1),
            truffleAssert.ErrorType.REVERT,
            "Only CDP contract may finish this auction. Please, use finishMarginCall method");

        let tx = await cdp.finishMarginCall(0);

        await expectEvent.inTransaction(tx.tx, auction, 'newAuction', { auctionID:web3.utils.toBN(2), lotAmount:web3.utils.toBN(0), lotAddress:await dao.addresses('rule'), paymentAmount:web3.utils.toBN(web3.utils.toWei('400'))});

    });

});