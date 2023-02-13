// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

import "./INTDAO.sol";
import "./exchangeRateContract.sol";

contract cartContract{

    struct cartItem {
        string symbol;
        uint256 share;
    }

    INTDAO dao;
    exchangeRateContract oracle;

    uint256 public initialPriceOfCartSharePerStableCoin;
    uint256 public itemsCount;
    uint256 public sharesCount;
    uint256 public decimals = 6;
    mapping(uint256 => cartItem) public items;

    event instrumentAdded(uint256 id);
    event shareChanged(uint256 id);


    constructor(address INTDAOaddress){
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('cart',payable(address(this)));
        oracle = exchangeRateContract(dao.addresses('oracle'));
    }

    function renewContracts() public {
        oracle = exchangeRateContract(dao.addresses('oracle'));
    }

    function addItem(string memory symbol, uint256 share) public{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        uint256 itemId = itemsCount++;
        cartItem storage c = items[itemId];
        c.share = share;
        c.symbol = symbol;
        sharesCount += share;
        initialPriceOfCartSharePerStableCoin += c.share * oracle.getPrice(c.symbol) * (10**(decimals-oracle.getDecimals(c.symbol)))/sharesCount;
        emit instrumentAdded(itemId);
    }

    function setShare(uint256 id, uint256 share) public{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        cartItem storage c = items[id];
        c.share = share;
        emit shareChanged(id);
    }

    function setInitialPriceOnce() public{
        if (initialPriceOfCartSharePerStableCoin == 0)
            initialPriceOfCartSharePerStableCoin = getCurrentSharePrice();
    }

    function getCurrentSharePrice() public view returns (uint256 price){
        uint256 totalShares;
        uint256 overallCartPrice;
        for (uint256 j = 0; j <= itemsCount; j ++) {
            cartItem storage c = items[j];
            totalShares += c.share;
            overallCartPrice += c.share * oracle.getPrice(c.symbol) * (10**(decimals-oracle.getDecimals(c.symbol)));
        }
        return overallCartPrice/totalShares;
    }


    function getPrice(string memory symbol) public view returns (uint256) {
        if (keccak256(bytes(symbol)) == keccak256(bytes('stb')))
            return oracle.getPrice('eth') * 10**4;
        return 0;
    }

    function getDecimals(string memory symbol) public view returns (uint256 _decimals) {
        if (keccak256(bytes(symbol)) == keccak256(bytes('stb')))
            return decimals;
        return 0;
    }
}
