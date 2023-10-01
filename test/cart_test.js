const { getContractAddress } = require('@ethersproject/address')

var INTDAO = artifacts.require("./INTDAO.sol");
var cartContract = artifacts.require("./cartContract.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");

contract('Cart', (accounts) => {
    let dao;
    let cart;
    let eRC;
    const exRAuthour = accounts[5];

    before('should setup the contracts instance', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})

        cart = await cartContract.deployed(futureDaoAddress);
        eRC = await Oracle.deployed(futureDaoAddress);
        dao = await INTDAO.deployed([0x0, 0x0, 0x0, 0x0, eRC.address, 0x0, 0x0, 0x0, cart.address], {from: accounts[0]});

        await cart.renewContracts();
        // weth, cdp, auction, deposit, exchangeRateContract, InflationFund, Rule, stableCoin, cart

        assert.equal (await cart.sharesCount(),15,"wrong sharesCount");
        assert.equal (await cart.itemsCount(),2,"wrong sharesCount");
    });

    it("should return valid share price", async () => {
        let sharePrice = await cart.getCurrentSharePrice();
        assert.equal (parseInt(sharePrice),1*10**6,"wrong sharePrice");
    });

    it("should return valid share price if price changed", async () => {
        await eRC.updateSinglePrice(3, 455510000, {from: exRAuthour}); //+10%
        await eRC.updateSinglePrice(2, 2241180000, {from: exRAuthour}); //+20%
        let sharePrice = await cart.getCurrentSharePrice();
        assert.equal (parseInt(sharePrice),1.166666*10**6,"wrong sharePrice");
    });


    it("should return valid share price if share changed", async () => {
        let itemBefore = await cart.items(2);
        assert.equal (itemBefore.share,5,"wrong share");
        await cart.setShare(2, 10,{from:exRAuthour});
        let itemAfter= await cart.items(2);
        assert.equal (itemAfter.share,10,"wrong share");
        assert.equal (await cart.sharesCount(),20,"wrong share");
        let sharePrice = await cart.getCurrentSharePrice();
        assert.equal (parseInt(sharePrice),1.150000*10**6,"wrong sharePrice");
    });

    before('should setup the contracts instance', async () => {
        await eRC.updateSinglePrice(2, 1867650000, {from: exRAuthour}); //gold
        await eRC.updateSinglePrice(3, 414100000, {from: exRAuthour}); //lumber
    });


    //TODO: add several tests

});

