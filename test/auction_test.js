const { time } = require('@openzeppelin/test-helpers');

var INTDAO = artifacts.require("./INTDAO.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Auction = artifacts.require("./Auction.sol");
var CDP = artifacts.require("./CDP.sol");

const truffleAssert = require('truffle-assertions');


contract('Auction', (accounts) => {
    let dao;
    let stableCoin;
    let auction;
    let cdp;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
        stableCoin = await StableCoin.deployed(dao.address);
        auction = await Auction.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
    });

    it("should throw if little money on balance", async () => {
        await truffleAssert.fails(
            auction.initRuleBuyOut(),
            truffleAssert.ErrorType.REVERT,
            "Should be enough stableCoins to initAuction");
    });

    it("should initAuction", async () => {
        await cdp.openCDP(web3.utils.toWei('2100', 'ether'), {
            from: accounts[2],
            value: web3.utils.toWei('1', 'ether')
        });

        await time.increase(31536000);//1 year in seconds. It may sometimes fail

        await cdp.transferFee(0);

        let initTx = await auction.initRuleBuyOut();

        truffleAssert.eventEmitted(initTx, 'buyOutInit', async (ev) => {
            assert.equal(ev.auctionID, 0, "Should be the first auction");
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 84, "Should be correct amount");
            assert.equal(ev.lotAddress, stableCoin.address, "Should be correct amount");
        });
    });
});

