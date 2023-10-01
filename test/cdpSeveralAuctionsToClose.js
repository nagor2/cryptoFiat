const {getContractAddress} = require("@ethersproject/address");
const truffleAssert = require("truffle-assertions");
const {time, expectEvent} = require("@openzeppelin/test-helpers");

contract('CDP several auctions to close position', (accounts) => {
    let dao;
    let cdp;
    let weth;
    let oracle;
    let stableCoin;
    let auction;
    let posId;
    let rule;

    const author = accounts[5];
    const recipient = accounts[8];

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
        oracle = await Oracle.deployed(futureDaoAddress);
        stableCoin = await StableCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        auction = await Auction.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([weth.address, cdp.address, auction.address, 0x0, oracle.address, 0x0, rule.address, stableCoin.address, 0x0]);

        await cdp.renewContracts();
        await auction.renewContracts();
    });

    it("should not fail empty test", async () => {

    });

});