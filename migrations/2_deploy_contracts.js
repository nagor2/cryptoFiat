var Rule = artifacts.require("Rule");
var stableCoin = artifacts.require ("stableCoin");
var exchangeRateContract = artifacts.require("exchangeRateContract");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");
var weth = artifacts.require("WETH9");
var deposit = artifacts.require("DepositContract");
var InflationFund = artifacts.require("inflationFund.sol");
var cartContract = artifacts.require("cartContract");

module.exports = async function(deployer, network, accounts) {
    if (network == "dashboard") {
        let daoAddress ="0x578A8A64D614eBAaAc2d0ADEb998dF2cfE7B8131"; //INTDAO.address;

        /*
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address);
        let daoAddress = INTDAO.address;*/
        //await deployer.deploy(exchangeRateContract, daoAddress, {value:"100000000000000"});

        //const eRC = await exchangeRateContract.deployed();
        //eRC.addInstrument("eth", "Ethereum", 6);
        await deployer.deploy(cartContract, daoAddress);
        //const cart = await cartContract.deployed();
        /*
        let instruments = [
            'Gold',            'XAU/USD',
            'Silver',          'XAG/USD',
            'Copper',          'Platinum',
            'Palladium',       'Crude Oil WTI',
            'Brent Oil',       'Natural Gas',
            'Heating Oil',     'Gasoline RBOB',
            'London Gas Oil',  'Aluminium',
            'Zinc',            'Nickel',
            'Copper London',   'US Wheat',
            'Rough Rice',      'US Corn',
            'US Soybeans',     'US Soybean Oil',
            'US Soybean Meal', 'US Cotton',
            'US Cocoa',        'US Coffee C',
            'London Coffee',   'US Sugar',
            'Orange Juice',    'Live Cattle',
            'Lean Hogs',       'Feeder Cattle',
            'Lumber',          'Oats'
        ];
        let prices = [1828850000,1820240000,21255000,21285000,4099000,918050000,1450250000,77080000,83750000,2330000,2749300,2376900,799250000,2400000000,3012000000,26151500000,8949000000,764500000,17605000,675400000,1525120000,61350000,493500000,80880000,2781500000,180630000,2065000000,21460000,227680000,162820000,85800000,186320000,388500000,352700000];

        for (var i=0; i<instruments.length; i++){
            await eRC.addInstrument(instruments[i], instruments[i], 6);
            await cart.addItem(instruments[i], 10, prices[i]);
        }

        await deployer.deploy(stableCoin, daoAddress);
        await deployer.deploy(Rule, daoAddress);
        await deployer.deploy(auction, daoAddress);
        await deployer.deploy(cdp, daoAddress);
        await deployer.deploy(deposit, daoAddress);
        await deployer.deploy(InflationFund, daoAddress);*/
    }
    else{
        const exRAuthour = accounts[5];
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address, {from: accounts[1]});
        await deployer.deploy(exchangeRateContract, INTDAO.address, {from: exRAuthour, value:"1000000000000000000"});
        const eRC = await exchangeRateContract.deployed();

        await eRC.addInstrument("eth", "Ethereum", 6, {from: exRAuthour});

        await eRC.updateSinglePrice(exRAuthour, "eth", 0, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(exRAuthour, "Gold", 0, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(exRAuthour, "Lumber", 0, 414100000, {from: exRAuthour});

        await deployer.deploy(cartContract, INTDAO.address);

        const cart = await cartContract.deployed();

        await cart.addItem("Gold", 10, 1867650000, {from: accounts[1]});
        await cart.addItem("Lumber", 5, 414100000, {from: accounts[1]});

        await deployer.deploy(stableCoin, INTDAO.address);
        await deployer.deploy(Rule, INTDAO.address, {from: accounts[7]});
        await deployer.deploy(auction, INTDAO.address);
        await deployer.deploy(cdp, INTDAO.address);
        await deployer.deploy(deposit, INTDAO.address);
        await deployer.deploy(InflationFund, INTDAO.address);
    }
};
