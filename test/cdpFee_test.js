const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');
const { getContractAddress } = require('@ethersproject/address')

contract('CDP transfer interest fee', (accounts) => {

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Auction = artifacts.require("./Auction.sol");

let posId;


before('should setup the contracts instance', async () => {
    const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})

    rule = await Rule.deployed(futureDaoAddress);
    stableCoin = await StableCoin.deployed(futureDaoAddress);
    cdp = await CDP.deployed(futureDaoAddress);
    auction = await Auction.deployed(futureDaoAddress);

    dao = await INTDAO.deployed([0x0, cdp.address, auction.address, 0x0, 0x0, 0x0, rule.address, stableCoin.address, 0x0]);

    await cdp.renewContracts();
    await auction.renewContracts();
});


    it("should properly increase fee", async () => {
        let owner = accounts[9];
        let coinsMintAmount = 1000;
        let posTx = await cdp.openCDP(web3.utils.toWei(String(coinsMintAmount)), {from: owner,value: web3.utils.toWei('1')});

        await truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
            posId = ev.posID.toNumber();
        });

        assert.equal(await cdp.totalCurrentFee(posId), '0', "wrong total fee");

        await time.increase(time.duration.years(1));

        assert.equal(parseFloat(await cdp.totalCurrentFee(posId) / 10**18).toFixed(4), 90.0000, "wrong total fee");

        await cdp.updateCDP(posId, web3.utils.toWei('100'), {from: owner});

        let position = await cdp.positions(posId);

        assert.equal(parseFloat(position.interestAmountRecorded/10**18).toFixed(4), 90.0000, "wrong total fee");

        await time.increase(time.duration.years(1));

        assert.equal(parseFloat(await cdp.totalCurrentFee(posId)/10**18).toFixed(4), 99.0000, "wrong total fee");
    });

    it("should set restricted", async () => {
        let position = await cdp.positions(posId);

        assert.isFalse(position.restrictInterestWithdrawal, "wrong restrictInterestWithdrawal value");

        await truffleAssert.fails(
            cdp.switchRestrictInterestWithdrawal(posId),
            truffleAssert.ErrorType.REVERT,//for some reason it returns out of gas, though should revert
            "Only owner may set this property"
        );

        await truffleAssert.passes(
            cdp.switchRestrictInterestWithdrawal(posId, {from:position.owner}), "switch should pass");

        position = await cdp.positions(posId);

        assert.isTrue(position.restrictInterestWithdrawal, "wrong restrictInterestWithdrawal value");
    });


    it("should transfer interest to CDP and decease recorded fee if not restricted", async () => {
        let position = await cdp.positions(posId);

        assert.equal(parseFloat(await cdp.totalCurrentFee(posId)/10**18).toFixed(4), 99.0000, "wrong total fee");
        await stableCoin.approve (cdp.address, web3.utils.toWei('99.01'), {from: position.owner});

        await truffleAssert.fails(
            cdp.transferInterest(posId),
            truffleAssert.ErrorType.REVERT,//for some reason it returns out of gas, though should revert
            "Only owner may transfer interest"
        );

        assert.equal(await stableCoin.balanceOf(cdp.address), web3.utils.toWei('0'), "wrong cdp balance");

        await cdp.transferInterest(posId, {from: position.owner});

        assert.equal(parseFloat(await stableCoin.balanceOf(cdp.address)/10**18).toFixed(4), 99.0000, "wrong cdp balance");
        assert.equal(parseFloat(await stableCoin.balanceOf(position.owner)/10**18).toFixed(4), 1.0000, "wrong owner balance");

        position = await cdp.positions(posId);

        assert.equal(parseFloat(await cdp.totalCurrentFee(posId)), 0, "wrong totalCurrentFee");
        assert.equal(parseFloat(position.interestAmountRecorded), 0, "wrong interestAmountRecorded");
    });




it("should generate additional fee", async () => {
    let owner = accounts[5];
    let recipient = accounts[8];
    let coinsMintAmount = 1000;
    let posTx = await cdp.openCDP(web3.utils.toWei(String(coinsMintAmount), 'ether'), {from: owner,value: web3.utils.toWei('1', 'ether')});

    await truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
        posId = ev.posID.toNumber();
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
        cdp.transferInterest(posId),
        truffleAssert.ErrorType.REVERT,
        "insufficient allowance"
    );

    await stableCoin.transfer(owner, web3.utils.toWei('50', 'ether'), {from:recipient});
    await stableCoin.approve(cdp.address, web3.utils.toWei('100', 'ether'), {from:owner})
    await cdp.transferInterest(posId);
    const feeAfter = await cdp.totalCurrentFee(posId);

    let cdpBalance = await stableCoin.balanceOf(cdp.address);
    //let auctionBalance = await stableCoin.balanceOf(auction.address);
    assert.equal(parseFloat(cdpBalance/10**18).toFixed(2),189.00,"smth wrong");
    //assert.equal(parseFloat(auctionBalance/10**18).toFixed(4),parseFloat('40').toFixed(4),"smth wrong");
    assert.equal(feeAfter, 0);
    });

    it("should allow and transfer surplus to auction and create RuleBuyOut", async () => {

        let cdpBalance = parseFloat(await stableCoin.balanceOf(cdp.address)/10**18).toFixed();

        let surplus = (cdpBalance - parseFloat(await stableCoin.totalSupply()/10**18)*(parseFloat(await dao.params('stabilizationFundPercent')))/100);

        assert.equal(surplus, 134, 'wrong surplus');

        await cdp.allowSurplusToAuction();

        let buyOutInitTx = await auction.initRuleBuyOut({from:accounts[7]});

        truffleAssert.eventEmitted(buyOutInitTx, 'newAuction', async (ev) => {
            assert.equal(ev.auctionID, 1, "Should be the first auction");
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 134, "Should be correct amount");
            assert.equal(ev.lotAddress, stableCoin.address, "Should be correct address");
            assert.equal(ev.paymentAmount, 0, "Should be correct address");
        });
    });
});