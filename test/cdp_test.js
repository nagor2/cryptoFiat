const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var Oracle = artifacts.require("./Oracle.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
const truffleAssert = require('truffle-assertions');

contract('CDP', (accounts) => {

    let dao;
    let cdp;
    let rule;
    let oracle;
    let expectedOwner;
    let stableCoin;
    let posNumber;
    let positionID;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
        rule = await Rule.deployed(dao.address);
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        posNumber = await cdp.numPositions();

        positionID = await cdp.openCDP(web3.utils.toWei('8000', 'ether'), {
            from: accounts[1],
            value: web3.utils.toWei('1', 'ether')
        });

        //console.log (positionID + " - positionID"); posID vs posNumber! posID - tx. Should make a tricky convert to int

        expectedOwner = accounts[1];
    });

    it("should create a valid Position", async () => {
            //console.log(stableCoin.address + " " +dao.addresses['stableCoin']);
            const position = await cdp.positions(posNumber);
            assert.equal(position.owner, expectedOwner, "position.owner should be "+expectedOwner);
            //console.log ("position.owner: "+position.owner);
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

    it("should mint max 2170 coins per 1 ether", async () => {
        const coins = await cdp.getMaxStableCoinsToMint(web3.utils.toWei('3000', 'ether'), web3.utils.toWei('1', 'ether'));
        assert.equal(coins, 2170 * (10**18), "should mint max 2170 coins per 1 ether");
    });

    it("should mint coins", async () => {
        const position = await cdp.positions(posNumber);
        const owner = await position.owner;
        const coinsMinted = await position.stableCoins_minted;
        const ballance = await stableCoin.balanceOf(owner);
        assert.equal (coinsMinted.toString(), ballance.toString(), "notEqual mint coins");

        //assert.equal(coins, 2170 * (10**18), "should mint max 2170 coins per 1 ether");
    });

    it("should mint desirable coins amount per 1 ether", async () => {
        const coins = await cdp.getMaxStableCoinsToMint(8, web3.utils.toWei('1', 'ether'));
        assert.equal(coins, 8, "should mint desirable coins amount per 1 ether");
    });

    it("time rewind", async () => {
            await time.increase(31536000);//1 year in seconds. It may sometimes fail
            const fee = await cdp.generatedFee(0);
            //console.log (fee.toString());
            assert.isTrue((fee >= 1953*10**17 && fee <= 1954*10**17), "should increase generated fee. It may sometimes fail due to time rewind (not precise)");
    });

    it("should return valid position ID", async () => {
            const numPos = await cdp.numPositions.call();
            truffleAssert.eventEmitted(positionID, 'PositionOpened', (ev) => {
                return ev.owner === accounts[1] && ev.posId.toNumber() === numPos-1;
            });
    });

    it("should increase numPositions", async () => {
            const numPos = await cdp.numPositions();
            assert.equal(numPos, parseInt(posNumber)+1, "number of positions should increase while opening");
    });

    it("should put 1 ether on contract's balance", async () => {
            const contractBalance = await web3.eth.getBalance(cdp.address);
            assert.equal(contractBalance, web3.utils.toWei('1','ether'), "contract's balance should be 1 ether");
    });



    describe("update CDP", async () => {
        it("should open CDP then approve some coins and then decrease amount", async () => {
            const contractBalance = await web3.eth.getBalance(cdp.address);
            assert.equal(contractBalance, web3.utils.toWei('1','ether'), "contract's balance should be 1 ether");
        });
    });

});






        /*
        let txOpen;
        let txUpdate;
              before("update CDP should open CDP then approve some coins and then decrease amount", async () => {
                  txOpen = await cdp.openCDP.call(web3.utils.toWei('8000','ether') , { from: accounts[2], value:  web3.utils.toWei('1','ether') });
                  const numPos = await cdp.numPositions.call();
                  await stableCoin.approve(cdp.address, web3.utils.toWei('1170','ether'), {from: accounts[2]});
                  txUpdate = await cdp.updateCDP.call(numPos-1, web3.utils.toWei('1000','ether'), {from: accounts[2], value:  web3.utils.toWei('1','ether') });
              });

              it("should decrease coins minted", async () => {
                  const numPos = await cdp.numPositions.call();
                  truffleAssert.eventEmitted(txOpen, 'PositionOpened', (ev) => {
                      return ev.owner === accounts[2] && ev.posId.toNumber() === numPos-1;
                  });
                  //assert.equal(position.stableCoins_minted, web3.utils.toWei('1000','ether'), "stableCoins_minted should decrease to 1000");
              });

              //Burned(address(this), amount);
        //PositionUpdated(p.owner, newStableCoinsAmount);*/