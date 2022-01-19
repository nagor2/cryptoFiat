var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");

contract('CDP', (accounts) => {

    let dao;
    let cdp;
    let rule;
    let expectedOwner;

    before('should setup the contracts instance', async () => {
        rule = await Rule.deployed();
        dao = await INTDAO.deployed(rule.address);
        cdp = await CDP.deployed(dao.address);
    });

    describe("creating a CDP and retrieving position fields", async () => {
        before("openCDP using accounts[1] and paying 1 ether", async () => {
            await cdp.openCDP(8, { from: accounts[1], value:  web3.utils.toWei('1','ether') });
            expectedOwner = accounts[1];
        });

        it("should increase numPositions", async () => {
            const numPos = await cdp.numPositions();
            assert.equal(numPos, 1, "number of positions should increase while opening");
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

            assert.equal(position.stableCoins_minted, 1, "should mint only 1 stableCoin");
        });

    });
});


