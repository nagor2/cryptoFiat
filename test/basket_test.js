const { getContractAddress } = require('@ethersproject/address')

var INTDAO = artifacts.require("./INTDAO.sol");
var basketContract = artifacts.require("./basketContract.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");

contract('Basket', (accounts) => {
    let dao;
    let basket;
    let eRC;
    const exRAuthour = accounts[5];

    before('should setup the contracts instance', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})

        basket = await basketContract.deployed(futureDaoAddress);
        eRC = await Oracle.deployed(futureDaoAddress);
        dao = await INTDAO.deployed([0x0, 0x0, 0x0, 0x0, eRC.address, 0x0, 0x0, basket.address], {from: accounts[0]});

        await basket.renewContracts();

        assert.equal (await basket.sharesCount(),15,"wrong sharesCount");
        assert.equal (await basket.itemsCount(),2,"wrong sharesCount");
    });

    it("should return valid share/stb price", async () => {
        let sharePrice = await basket.getCurrentSharePriceChange();
        assert.equal (parseInt(sharePrice),10**6,"wrong sharePrice");
        assert.equal (parseInt(await basket.getEthereumVSCommoditiesPriceChange()),3100*10**6,"wrong sharePrice");
    });

    it("should return valid share/stb price", async () => {
        await eRC.updateSinglePrice(1, 310000000, {from: exRAuthour});
        let sharePrice = await basket.getCurrentSharePriceChange();
        assert.equal (parseInt(sharePrice),10**6,"wrong sharePrice");
        assert.equal (parseInt(await basket.getEthereumVSCommoditiesPriceChange()),310*10**6,"wrong sharePrice");
    });

    it("should return valid share/stb price", async () => {
        await eRC.updateSinglePrice(1, 1550000000, {from: exRAuthour});
        let sharePrice = await basket.getCurrentSharePriceChange();
        assert.equal (parseInt(sharePrice),10**6,"wrong sharePrice");
        assert.equal (parseInt(await basket.getEthereumVSCommoditiesPriceChange()),1550*10**6,"wrong sharePrice");
    });

    it("should return valid share/stb price if price changed", async () => {
        await eRC.updateSinglePrice(3, 455510000, {from: exRAuthour}); //+10%
        await eRC.updateSinglePrice(2, 2241180000, {from: exRAuthour}); //+20%
        let sharePrice = await basket.getCurrentSharePriceChange();
        assert.equal (parseInt(sharePrice),1.166666*10**6,"wrong sharePrice");
        assert.equal (parseInt(await basket.getEthereumVSCommoditiesPriceChange()),1328.572187*10**6,"wrong sharePrice");
    });

    it("should return valid share/stb price if share changed", async () => {
        let itemBefore = await basket.items(2);
        assert.equal (itemBefore.share,5,"wrong share");
        await basket.setShare(2, 10,{from:exRAuthour});
        let itemAfter= await basket.items(2);
        assert.equal (itemAfter.share,10,"wrong share");
        assert.equal (await basket.sharesCount(),20,"wrong share");
        let sharePrice = await basket.getCurrentSharePriceChange();
        assert.equal (parseInt(sharePrice),1.150000*10**6,"wrong sharePrice");
        assert.equal (parseInt(await basket.getEthereumVSCommoditiesPriceChange()),1347.826086*10**6,"wrong sharePrice");
    });

    before('should setup the contracts instance', async () => {
        await eRC.updateSinglePrice(2, 3100000000, {from: exRAuthour}); //etc
        await eRC.updateSinglePrice(2, 1867650000, {from: exRAuthour}); //gold
        await eRC.updateSinglePrice(3, 414100000, {from: exRAuthour}); //lumber
    });
});

