const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');

contract('CDP transfer fee', (accounts) => {

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Auction = artifacts.require("./Auction.sol");

before('should setup the contracts instance', async () => {
    dao = await INTDAO.deployed();
    rule = await Rule.deployed(dao.address);
    oracle = await Oracle.deployed(dao.address);
    stableCoin = await StableCoin.deployed(dao.address);
    cdp = await CDP.deployed(dao.address);
    auction = await Auction.deployed(dao.address);
});

it("should transfer fee to the auction to create buyOut", async () => {
    let owner = accounts[5];
    let recipient = accounts[8];
    let coinsMintAmount = 1000;
    let posTx = await cdp.openCDP(web3.utils.toWei(String(coinsMintAmount), 'ether'), {from: owner,value: web3.utils.toWei('1', 'ether')});
    let posId;
    await truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
        posId = ev.posId.toNumber();
        });

    const position = await cdp.positions(posId);
    let actualBalance = await stableCoin.balanceOf(position.owner);
    assert.equal(actualBalance.toString(),web3.utils.toWei(String(coinsMintAmount), 'ether'),"smth wrong");

    await time.increase(time.duration.years(1));

    await stableCoin.transfer(recipient, web3.utils.toWei('950', 'ether'), {from:owner});

    actualBalance = await stableCoin.balanceOf(position.owner);

    let recipientBalance = await stableCoin.balanceOf(recipient);

    assert.equal(recipientBalance.toString(),web3.utils.toWei('950', 'ether'),"smth wrong");
    assert.equal(actualBalance.toString(),web3.utils.toWei('50', 'ether'),"smth wrong");

    await cdp.updateCDP(posId, web3.utils.toWei(String(coinsMintAmount), 'ether'), {from: owner});

    await truffleAssert.fails(
        cdp.transferFee(posId),
        truffleAssert.ErrorType.REVERT,
        "insufficient funds on owners balance"
    );

    await stableCoin.transfer(owner, web3.utils.toWei('50', 'ether'), {from:recipient});
    await stableCoin.approve(cdp.address, web3.utils.toWei('100', 'ether'), {from:owner})
    await cdp.transferFee(posId);

    let cdpBalance = await stableCoin.balanceOf(cdp.address);
    //let auctionBalance = await stableCoin.balanceOf(auction.address);
    assert.equal(parseFloat(cdpBalance/10**18).toFixed(4),parseFloat('90').toFixed(4),"smth wrong");
    //assert.equal(parseFloat(auctionBalance/10**18).toFixed(4),parseFloat('40').toFixed(4),"smth wrong");
    });

});