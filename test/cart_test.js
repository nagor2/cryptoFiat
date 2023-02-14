var INTDAO = artifacts.require("./INTDAO.sol");
var cartContract = artifacts.require("./cartContract.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");

const truffleAssert = require('truffle-assertions');

contract('Cart', (accounts) => {
    let dao;
    let cart;
    let eRC;
    const exRAuthour = accounts[5];

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed(0x0);
        cart = await cartContract.deployed(dao.address);
        eRC = await Oracle.deployed(dao.address);
        assert.equal (await cart.sharesCount(),15,"wrong sharesCount");
        assert.equal (await cart.itemsCount(),2,"wrong sharesCount");
    });

    it("should return valid share price", async () => {
        let sharePrice = await cart.getCurrentSharePrice();
        assert.equal (sharePrice,1*10**await cart.getDecimals('any'),"wrong sharePrice");
    });

    it("should return valid share price if price changed", async () => {
        await eRC.updateSinglePrice(exRAuthour, "Lumber", 0, 455510000, {from: exRAuthour}); //+10%
        await eRC.updateSinglePrice(exRAuthour, "Gold", 0, 2241180000, {from: exRAuthour}); //+20%
        let sharePrice = await cart.getCurrentSharePrice();
        assert.equal (sharePrice,1.166666*10**await cart.getDecimals('any'),"wrong sharePrice");
    });


    it("should return valid share price if share changed", async () => {
        let itemBefore = await cart.items(1);
        assert.equal (itemBefore.share,5,"wrong share");
        await cart.setShare(1, 10,{from:accounts[1]});
        let itemAfter= await cart.items(1);
        assert.equal (itemAfter.share,10,"wrong share");
        assert.equal (await cart.sharesCount(),20,"wrong share");
        let sharePrice = await cart.getCurrentSharePrice();
        assert.equal (sharePrice,1.150000*10**await cart.getDecimals('any'),"wrong sharePrice");
    });

    before('should setup the contracts instance', async () => {
        await eRC.updateSinglePrice(exRAuthour, "Gold", 0, 1867650000, {from: exRAuthour});
        await eRC.updateSinglePrice(exRAuthour, "Lumber", 0, 414100000, {from: exRAuthour});
    });

});

