const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Deposit = artifacts.require("./DepositContract.sol");
const truffleAssert = require('truffle-assertions');

contract('Deposit', (accounts) => {

    let dao;
    let cdp;
    let coin;
    let deposit;
    let owner = accounts[0];
    let amount;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed(0x0);
        coin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
        deposit = await Deposit.deployed(dao.address);
        amount = web3.utils.toWei('100', "ether");
        await cdp.openCDP(web3.utils.toWei('1000', 'ether'), {
            from: accounts[1],
            value: web3.utils.toWei('1', 'ether')});

        await coin.transfer(cdp.address, web3.utils.toWei('10', 'ether'), {from: accounts[1]}); //topUp stabFund
    });

    it("should fail, because nothing to deposit", async () => {
        await truffleAssert.fails(
            deposit.deposit({from: owner}),
            truffleAssert.ErrorType.REVERT,
            "you have to approve coins first");

        await coin.approve(deposit.address, 100, {from: owner});

        await truffleAssert.fails(
            deposit.deposit({from: owner}),
            truffleAssert.ErrorType.REVERT,
            "Could not transfer coins for some reason");

        await coin.transfer(owner, 50, {from: accounts[1]});

        await truffleAssert.fails(
            deposit.deposit({from: owner}),
            truffleAssert.ErrorType.REVERT,
            "Could not transfer coins for some reason");

        await coin.transfer(accounts[1], 50, {from: owner});
        await coin.approve(deposit.address, 0, {from: owner});
    });

    it("should deposit", async () => {

        await coin.transfer(owner, amount, {from: accounts[1]});
        await coin.approve(deposit.address, amount, {from: owner});

        assert.equal((await coin.balanceOf(deposit.address)).toString(), web3.utils.toWei('0'), "initial balance should be 0");
        assert.equal(await coin.balanceOf(owner), amount, "initial balance should be 100 coins");

        let tx = await deposit.deposit({from: owner});
        let expectedRate = await dao.params("depositRate");

        truffleAssert.eventEmitted(tx, 'DepositOpened', async (ev) => {
            assert.equal(ev.id, 1, "id should be set to 1");
            assert.equal(ev.amount, amount, "amount should be 100 coins");
            expect(ev.rate).to.eql(expectedRate, "rate should be " + expectedRate);
        });

        let contractBallance = await coin.balanceOf(deposit.address);

        assert.equal(contractBallance, amount, "contract balance should increase");
        assert.equal(await coin.balanceOf(owner), web3.utils.toWei('0'), "balance should decrease");
    });

    it("should create valid deposit", async () => {
        let d = await deposit.deposits(1);

        assert.equal(d.owner, owner, "incorrect owner");
        assert.equal(d.coinsDeposited, amount, "incorrect amount");
        assert.equal(d.currentInterestRate, 8, "incorrect rate");
    });


    it("should pay interest", async () => {
        await time.increase(time.duration.years(1));
        let interest = await deposit.overallInterest(1);
        assert.equal(parseFloat(interest/10**18).toFixed(5), parseFloat("8").toFixed(5), "interest should increase");
        await deposit.claimInterest(1);
        let balance = await coin.balanceOf(owner);
        assert.equal(parseFloat(balance/10**18).toFixed(5), parseFloat("8").toFixed(5), "balance should decrease");
    });

    it("should pay some interest and increase allowance", async () => {
        await time.increase(time.duration.years(1));
        let interest = await deposit.overallInterest(1);
        assert.equal(parseFloat(interest/10**18).toFixed(5), parseFloat("8").toFixed(5), "interest should increase");

        await deposit.claimInterest(1);
        let balance = await coin.balanceOf(owner);
        assert.equal(parseFloat(balance/10**18).toFixed(5), parseFloat("10").toFixed(5), "balance should decrease");
        let allowance = await coin.allowance(cdp.address, owner);
        assert.equal(parseFloat(allowance/10**18).toFixed(5), parseFloat("6").toFixed(5), "balance should decrease");
    });

    it("should topUp deposit", async () => {
        await coin.approve(deposit.address, web3.utils.toWei('10', 'ether'), {from: owner});
        await deposit.topUp(1);
        let d = await deposit.deposits(1);
        assert.equal(d.coinsDeposited, web3.utils.toWei('110', "ether"), "incorrect coinsDeposited");
        let balance = await coin.balanceOf(deposit.address);
        assert.equal(parseFloat(balance/10**18).toFixed(5), parseFloat("110").toFixed(5), "balance should increase");
        await time.increase(time.duration.years(1));
        await deposit.claimInterest(1);
        let allowance = await coin.allowance(cdp.address, owner);
        assert.equal(parseFloat(allowance/10**18).toFixed(5), parseFloat("14.8").toFixed(5), "allowance should increase");
    });

    it("should withdraw funds", async () => {
        await deposit.withdraw(1, web3.utils.toWei('110', "ether"), {from:owner});
        let d = await deposit.deposits(1);
        assert.equal(d.coinsDeposited, web3.utils.toWei('0', "ether"), "incorrect coinsDeposited");
        let balance = await coin.balanceOf(deposit.address);
        assert.equal(parseFloat(balance/10**18), parseFloat("0"), "balance should decrease");
        balance = await coin.balanceOf(owner);
        assert.equal(parseFloat(balance/10**18).toFixed(5), parseFloat("110").toFixed(5), "balance should increase");
    });

    //TODO: Тут возникают вопросы! Периодичность выплат, как быть со сложным процентом? – пока что решил не углубляться
    //TODO: Смена «ключевой ставки»
    //TODO: Пока что ставка фиксируется на первые 91 день. А что потом?
});
