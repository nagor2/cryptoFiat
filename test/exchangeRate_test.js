const { time } = require('@openzeppelin/test-helpers');

var INTDAO = artifacts.require("./INTDAO.sol");
var ExRate = artifacts.require("./exchangeRateContract.sol");

contract('Exchange Rate', (accounts) => {
    let dao;
    let exRate;
    let author;

    before('should setup the contracts instance', async () => {
        author = accounts[5];
        dao = await INTDAO.deployed();
        exRate = await ExRate.deployed(dao.address, {from:author, value:"1000000000000000000"});
    });

    it("should put money on balance", async () => {
        let balance = await web3.eth.getBalance(exRate.address);
        assert.equal (parseFloat(balance/10**18).toFixed(2), 0.10, "wrong balance");
    });

    it("should add and update instrument", async () => {
        let ethInstrument = await exRate.dictionary("eth2");
        assert.equal(ethInstrument.name, "", "there should be no eth instrument");
        await exRate.addInstrument("eth2", "Ethereum", 2, {from: author});
        await exRate.updateSinglePrice(3, 310000, {from: author});
        let ethPrice = await exRate.getPrice('eth2');
        ethInstrument = await exRate.dictionary("eth2");
        ethPrice = ethPrice/ (10**ethInstrument.decimals);
        assert.equal (ethPrice, 3100, "wrong eth price");
    });

    it("should change price", async () => {
        await exRate.updateSinglePrice(3, 110021, {from: author});
        let ethPrice = await exRate.getPrice('eth2');
        ethInstrument = await exRate.dictionary("eth2");
        ethPrice = ethPrice/ (10**ethInstrument.decimals);
        assert.equal (ethPrice, 1100.21, "wrong eth price");
    });

    it("should change several price", async () => {
        await exRate.updateSeveralPrices([2,0,1], [100,101,102], {from: author});
        let price = await exRate.getPrice("Lumber");
        assert.equal (price, 100, "wrong price");
        price = await exRate.getPrice("Gold");
        assert.equal (price, 102, "wrong price");
        price = await exRate.getPrice("eth");
        assert.equal (price, 101, "wrong price");
    });
});

