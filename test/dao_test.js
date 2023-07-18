var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");

const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');

contract('DAO', (accounts) => {

    let dao;
    let oracle;
    let ruleHolder;
    let ruleToken;


    before(async () => {
        dao = await INTDAO.deployed();
        oracle = await Oracle.deployed();
        ruleHolder = accounts[7];
        ruleToken = await Rule.deployed(dao.address);
        await dao.renewContracts();
    });

    it('deploys successfully', async () => {
        const address = await dao.address;
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
    });

    it('should transfer ether to oracle contract', async()=>{
        let balanceBefore = await web3.eth.getBalance(oracle.address);
        assert.equal(balanceBefore,web3.utils.toWei('0.1', "ether"), 'balance should be 0.1')
        await dao.send(web3.utils.toWei("1", "ether"),{from: accounts[0]});
        await dao.withdraw();
        let balanceAfter = await web3.eth.getBalance(oracle.address);
        assert.equal(balanceAfter,web3.utils.toWei('1.1', "ether"), 'balance should be 1.1 ether')
    });

    it('addresses filled successfully', async () => {
        const address = await dao.address;
        assert.equal(await dao.addresses('dao'),address);
    });

    it('should set address only once', async () => {
        await truffleAssert.fails(
            dao.setAddressOnce('dao', accounts[2]),
            truffleAssert.ErrorType.REVERT,
            "address was already set");
    });

    it('should put rule tokens on balance', async () => {
        const balance = await ruleToken.balanceOf(ruleHolder);
        const totalSupply = await ruleToken.totalSupply();
        assert.equal (parseFloat(balance/10**18),10**6, "wrong balance");
        assert.equal (parseFloat(totalSupply/10**18),10**6, "wrong supply");
    });

    it('should fail because not allowed', async () => {
        await truffleAssert.fails(
            dao.poolTokens({from: ruleHolder}),
            truffleAssert.ErrorType.REVERT,
            "allow tokens first");
    });

    it('should pool tokens', async () => {
        await ruleToken.approve(dao.address, web3.utils.toWei('100', "ether"), {from: ruleHolder});
        await dao.poolTokens({from: ruleHolder});
        const daoBalance = await ruleToken.balanceOf(dao.address);
        const totalPooled = await dao.totalPooled();
        const pooled = await dao.pooled(ruleHolder);
        assert.equal (daoBalance, web3.utils.toWei('100', "ether"), "wrong balance");
        assert.equal (totalPooled, web3.utils.toWei('100', "ether"), "wrong balance");
        assert.equal (pooled, web3.utils.toWei('100', "ether"), "wrong balance");
    });

    it('should not allow to init voting', async () => {
        await truffleAssert.fails(
            dao.addVoting(1, "", 0, accounts[1], false,{from: ruleHolder}),
            truffleAssert.ErrorType.REVERT,
            "Too little tokens to init voting");
    });

    it('should init voting', async () => {
        await ruleToken.approve(dao.address, web3.utils.toWei('10000', "ether"), {from: ruleHolder});
        await dao.poolTokens({from: ruleHolder});
        let tx = await dao.addVoting(1, "some string", 0, accounts[1], false,{from: ruleHolder});
        truffleAssert.eventEmitted(tx, 'NewVoting', async (ev) => {
            assert.equal(ev.id, 1, "wrong id");
            assert.equal(ev.name, "some string", "some string");
        });
        const active = await dao.activeVoting();
        assert.isTrue(active, "activeVoting should be true");
    });

    it('should not be able to finalize voting', async () => {
        let tx = await dao.claimToFinalizeCurrentVoting();

        truffleAssert.eventNotEmitted(tx, 'VotingFailed', async (ev) => {
            assert.equal(ev.id, 1, "wrong id");
        });
    });

    it('should fail if voting duration expired', async () => {
        await time.increase(time.duration.days(2));

        await truffleAssert.fails(
            dao.vote(true,{from: ruleHolder}),
            truffleAssert.ErrorType.REVERT,
            "Voting is already inactive");
    });

    it('should be able to finalize voting', async () => {
        let tx = await dao.claimToFinalizeCurrentVoting();

        truffleAssert.eventEmitted(tx, 'VotingFailed', async (ev) => {
            assert.equal(ev.id, 1, "wrong id");
        });
    });

    it('should be able to get back pooled tokens', async () => {
        let totalPooledBefore = await dao.totalPooled();
        let pooledBefore = await dao.pooled(ruleHolder);
        let balanceBefore = await ruleToken.balanceOf(ruleHolder);
        let contractBalanceBefore = await ruleToken.balanceOf(dao.address);

        expect(totalPooledBefore).to.eql(pooledBefore, "wrong pooled amount");
        assert.equal(web3.utils.fromWei(totalPooledBefore),10100, "wrong pooled amount");

        expect(contractBalanceBefore).to.eql(totalPooledBefore, "wrong pooled amount");

        await dao.returnTokens({from:ruleHolder});

        let totalPooledAfter = await dao.totalPooled();
        let pooledAfter = await dao.pooled(ruleHolder);
        let balanceAfter = await ruleToken.balanceOf(ruleHolder);
        let contractBalanceAfter = await ruleToken.balanceOf(dao.address);

        assert.equal(totalPooledAfter.toString(), totalPooledBefore - pooledBefore, "should decrease totalPooled amount");

        assert.equal(parseFloat(pooledAfter),0, "should empty pooled tokens for user");
        assert.equal(parseFloat(web3.utils.fromWei(balanceAfter)), parseFloat(web3.utils.fromWei(balanceBefore)) + parseFloat(web3.utils.fromWei(pooledBefore)), "should increase balance");
        expect(contractBalanceAfter).to.eql(totalPooledAfter, "should totalPooled amount");
        assert.equal(parseFloat(contractBalanceAfter), 0, "wrong contract balance");
    });

    it('should be able to finalize voting with quorum', async () => {
        let voter = accounts[5];
        await ruleToken.transfer(voter,web3.utils.toWei('400000', "ether"), {from: ruleHolder});

        let tx = await ruleToken.approve(dao.address, web3.utils.toWei('400000', "ether"), {from: voter});

        await truffleAssert.eventEmitted(tx, 'Approval', async (ev) => {
            assert.equal(ev.owner, voter, "wrong owner");
            assert.equal(ev.spender, dao.address, "wrong spender");
            assert.equal(ev.value, web3.utils.toWei('400000'), "wrong value");
        });


        let res = await dao.poolTokens({from: voter});
        //assert.equal(res, true, "wrong to");
        //console.log (tx2);

        /*
        truffleAssert.eventEmitted(tx2, 'Transfer', async (ev) => {
            assert.equal(ev.from, voter, "wrong from");
            assert.equal(ev.to, dao.address, "wrong to");
            assert.equal(ev.value, web3.utils.toWei('400000'), "wrong value");
        });*/

        await ruleToken.approve(dao.address, web3.utils.toWei('200000', "ether"), {from: ruleHolder});

        await dao.poolTokens({from: ruleHolder});

        await dao.addVoting(1, "some string", 10, accounts[1], false,{from: ruleHolder});
        await dao.vote(false,{from: ruleHolder});
        await dao.vote(true,{from: voter});

        tx = await dao.claimToFinalizeCurrentVoting();
        await truffleAssert.eventNotEmitted(tx, 'VotingSucceed');

        await time.increase(time.duration.days(1));

        let valueBefore = await dao.params("some string");

        let tx2 = await dao.claimToFinalizeCurrentVoting();

        assert.equal(valueBefore, 0, "wrong valueBefore");

        await truffleAssert.eventEmitted(tx2, 'VotingSucceed', async (ev) => {
            assert.equal(ev.id, 2, "wrong id");
        });

        let valueAfter = await dao.params("some string");

        assert.equal(valueAfter, 10, "wrong valueAfter");

        await dao.returnTokens({from:voter});
        await ruleToken.transfer(ruleHolder,web3.utils.toWei('400000', "ether"), {from: voter});
    });

    it('should be able to finalize voting with absolute majority', async () => {
        let tx = await ruleToken.approve(dao.address, web3.utils.toWei('600000', "ether"), {from: ruleHolder});

        await truffleAssert.eventEmitted(tx, 'Approval', async (ev) => {
            assert.equal(ev.owner, ruleHolder, "wrong owner");
            assert.equal(ev.spender, dao.address, "wrong spender");
            assert.equal(ev.value, web3.utils.toWei('600000'), "wrong value");
        });


        tx = await dao.poolTokens({from: ruleHolder});
/*
        await truffleAssert.eventEmitted(tx, 'Transfer', async (ev) => {
            assert.equal(ev.from, ruleHolder, "wrong from");
            assert.equal(ev.to, dao.address, "wrong to");
            assert.equal(ev.value, web3.utils.toWei('600000'), "wrong value");
        });
*/
        await dao.addVoting(2, "some address", 0, accounts[1], false,{from: ruleHolder});
        await dao.vote(true,{from: ruleHolder});

        let valueBefore = await dao.addresses("some address");
        assert.equal(valueBefore, 0, "wrong valueBefore");

        tx = await dao.claimToFinalizeCurrentVoting();

        await truffleAssert.eventEmitted(tx, 'VotingSucceed', async (ev) => {
            assert.equal(ev.id, 3, "wrong id");
        });

        let valueAfter = await dao.addresses("some address");

        assert.equal(valueAfter, accounts[1], "wrong valueAfter");
    });

    it('should authorize address', async () => {

        let votingType = 4; // authorize contract
        let addressToAuthorize = accounts[9];
        await dao.addVoting(votingType, "some address", 0, addressToAuthorize, true,{from: ruleHolder});

        let votingId = 4; // incremented id

        await dao.vote(true,{from: ruleHolder});

        let valueBefore = await dao.authorized(addressToAuthorize);
        assert.equal(valueBefore, false, "wrong valueBefore");

        let tx = await dao.claimToFinalizeCurrentVoting();

        truffleAssert.eventEmitted(tx, 'VotingSucceed', async (ev) => {
            assert.equal(ev.id, votingId, "wrong id");
        });

        let valueAfter = await dao.authorized(addressToAuthorize);

        assert.equal(valueAfter, true, "wrong valueAfter");
    });

    it('should unauthorize address', async () => {
        let votingType = 4; // authorize contract
        let addressToAuthorize = accounts[9];
        await dao.addVoting(votingType, "some address", 0, addressToAuthorize, false,{from: ruleHolder});

        let votingId = 5; // incremented id

        await dao.vote(true,{from: ruleHolder});

        let valueBefore = await dao.authorized(addressToAuthorize);
        assert.equal(valueBefore, true, "wrong valueBefore");

        let tx = await dao.claimToFinalizeCurrentVoting();

        truffleAssert.eventEmitted(tx, 'VotingSucceed', async (ev) => {
            assert.equal(ev.id, votingId, "wrong id");
        });

        let valueAfter = await dao.authorized(addressToAuthorize);

        assert.equal(valueAfter, false, "wrong valueAfter");
    });

});

//TODO: Написать тест на паузу контракта (зачем нужен этот функционал, не помню, но пусть будет)
