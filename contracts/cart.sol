// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

import "./INTDAO.sol";
import "./exchangeRateContract.sol";

contract cartContract{

    struct cartItem {
        string symbol;
        uint256 share;
        uint256 initialPrice;
    }

    INTDAO dao;
    exchangeRateContract oracle;

    uint256 public itemsCount;
    uint256 public sharesCount;
    uint256 public decimals = 6;
    mapping(uint256 => cartItem) public items;
    mapping (string => uint256) public dictionary;

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

    function addItem(string memory symbol, uint256 share, uint256 initialPrice) public{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        cartItem storage prevItem = items[dictionary['symbol']];
        require (prevItem.initialPrice == 0, "instrument already exists, please, use setShare")
        uint256 itemId = itemsCount++;
        cartItem storage c = items[itemId];
        c.share = share;
        c.symbol = symbol;
        c.initialPrice = initialPrice;
        sharesCount += share;
        emit instrumentAdded(itemId);
    }

    function setShare(uint256 id, uint256 share) public{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        cartItem storage c = items[id];
        sharesCount -= c.share;
        sharesCount += share;
        c.share = share;
        emit shareChanged(id);
    }

    function getCurrentSharePrice() public view returns (uint256 price){
        uint256 overallCartPrice = 0;
        for (uint256 j = 0; j < itemsCount; j ++) {
            cartItem storage c = items[j];
            overallCartPrice += c.share * 10**6 * oracle.getPrice(c.symbol) * (10**(decimals-oracle.getDecimals(c.symbol)))/c.initialPrice;
        }
        return overallCartPrice/sharesCount;
    }

    //TODO: написать функцию, которая читает из оракла только значение индекса

    function getPrice(string memory symbol) public view returns (uint256) {
        //TODO: переписать целиком! Нельзя возвращать 0
        if (keccak256(bytes(symbol)) == keccak256(bytes('stb')))
            return oracle.getPrice('eth') * 10**6 / getCurrentSharePrice();
        return 0;
    }

    function getDecimals(string memory symbol) public view returns (uint256 _decimals) {
        return 6;
    }
}
