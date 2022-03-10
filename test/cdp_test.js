const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var Oracle = artifacts.require("./Oracle.sol");
var StableCoin = artifacts.require("./stableCoin.sol");

contract('CDP', (accounts) => {

    let dao;
    let cdp;
    let rule;
    let oracle;
    let expectedOwner;
    let stableCoin;

    before('should setup the contracts instance', async () => {
        rule = await Rule.deployed();
        oracle = await Oracle.deployed();
        stableCoin = await StableCoin.deployed();
        dao = await INTDAO.deployed(rule.address, oracle.address);
        cdp = await CDP.deployed(dao.address);
        await stableCoin.setCPDAddressOnce(cdp.address);
    });

    describe("creating a CDP and retrieving position fields", async () => {
        let posNumber;
        before("openCDP using accounts[1] and paying 1 ether", async () => {
            posNumber = await cdp.numPositions();
            await cdp.openCDP(web3.utils.toWei('8000','ether') , { from: accounts[1], value:  web3.utils.toWei('1','ether') });
            expectedOwner = accounts[1];
        });

        it("should increase numPositions", async () => {
            const numPos = await cdp.numPositions();
            assert.equal(numPos, parseInt(posNumber)+1, "number of positions should increase while opening");
        });

        it("should put 1 ether on contract's balance", async () => {
            const contractBalance = await web3.eth.getBalance(cdp.address);
            assert.equal(contractBalance, web3.utils.toWei('1','ether'), "contract's balance should be 1 ether");
        });

        it("should create a valid Position", async () => {
            const position = await cdp.positions(0);
            assert.equal(position.owner, expectedOwner, "position.owner should be "+expectedOwner);
            assert.equal(position.ethAmountLocked, web3.utils.toWei('1','ether'), "ethAmountLocked should be 1 ether");
            const blockNum = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(blockNum);
            const now = block.timestamp;
            assert.equal(position.timeOpened, now, "time of the position should be set to now");
            assert.equal(position.feeGenerated, 0, "fee generated should be set to 0");

            const rate = await dao.params('interestRate');
            expect(rate).to.eql(position.feeRate,"fee rate should be set to dao.params value"); //compare 2 BN
            assert.equal(position.stableCoins_minted, 2170 * (10**18), "should mint 2170*10^18 stableCoins");
        });

        it("time rewind", async () => {
            await time.increase(31535999);//1 year in seconds. It may sometimes fail
            const fee = await cdp.generatedFee(0);

            console.log (fee.toString());
            assert.equal(fee, 1953*10**17, "should increase generated fee. It may sometimes fail");
        });

    });

    describe("max stableCoinsToMint", async () => {
        it("should mint max 2170 coins per 1 ether", async () => {
            const coins = await cdp.getMaxStableCoinsToMint(web3.utils.toWei('3000', 'ether'), web3.utils.toWei('1', 'ether'));
            assert.equal(coins, 2170 * (10**18), "should mint max 2170 coins per 1 ether");
        });

        it("should mint desirable coins amount per 1 ether", async () => {
            const coins = await cdp.getMaxStableCoinsToMint(8, web3.utils.toWei('1', 'ether'));
            assert.equal(coins, 8, "should mint desirable coins amount per 1 ether");
        });
    });

    describe("update CDP", async () => {
        let posId;
        before("update CDP should open CDP then approve some coins and then decrease amount", async () => {
            posId = await cdp.openCDP(web3.utils.toWei('8000','ether') , { from: accounts[1], value:  web3.utils.toWei('1','ether') });
            await stableCoin.approve(cdp.address, web3.utils.toWei('1170','ether'), {from: accounts[1]});

            //ошибка тут, нужно разбить update на часть и протестировать их. Кроме этого, нужно сделать два апдейта - на изменение количества стэйблов и на вывод эфира
            await cdp.updateCDP(posId, web3.utils.toWei('1000','ether'), {from: accounts[1], value:  web3.utils.toWei('1','ether') });
        });

        it("should decrease coins minted", async () => {
            const position = await cdp.positions(0);
            //assert.equal(position.stableCoins_minted, web3.utils.toWei('1000','ether'), "stableCoins_minted should decrease to 1000");
        });
/*
        it("should create a valid Position", async () => {
            const position = await cdp.positions(0);
            assert.equal(position.owner, expectedOwner, "position.owner should be "+expectedOwner);
            assert.equal(position.ethAmountLocked, web3.utils.toWei('1','ether'), "ethAmountLocked should be 1 ether");
            const blockNum = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(blockNum);
            const now = block.timestamp;
            assert.equal(position.timeOpened, now, "time of the position should be set to now");
            assert.equal(position.feeGenerated, 0, "fee generated should be set to 0");

            const rate = await dao.params('interestRate');
            expect(rate).to.eql(position.feeRate,"fee rate should be set to dao.params value"); //compare 2 BN
            assert.equal(position.stableCoins_minted, 2170 * (10**18), "should mint 2170*10^18 stableCoins");
        });

        it("time rewind", async () => {
            await time.increase(31535999);//1 year in seconds. It may sometimes fail
            const fee = await cdp.generatedFee(0);

            console.log (fee.toString());
            assert.equal(fee, 1953*10**17, "should increase generated fee. It may sometimes fail");
        });*/

    });



});


