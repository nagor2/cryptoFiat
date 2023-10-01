// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "./IDAO.sol";

interface IOracle{
    function updater() external view returns (address);
    function getPrice(string memory) external view returns (uint256);
    function getDecimals(string memory) external view returns (uint8);
}

contract cartContract{

    struct cartItem {
        string symbol;
        uint16 share;
        uint256 initialPrice;
    }

    IDAO immutable dao;
    IOracle oracle;

    uint16 public itemsCount;
    uint16 public sharesCount;
    uint8 public constant decimals = 6;
    mapping(uint16 => cartItem) public items;
    mapping (string => uint16) public dictionary;

    event instrumentAdded(uint16 id);
    event shareChanged(uint16 id);


    constructor(address payable _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    function renewContracts() public {
        oracle = IOracle(dao.addresses("oracle"));
    }

    function addItem(string memory symbol, uint16 share, uint256 initialPrice) public{
        require(msg.sender == oracle.updater(), "only authorized address may addItem");
        require (dictionary[symbol]==0, "instrument already exists, please, use setShare");
        uint16 itemId = ++itemsCount;
        cartItem storage c = items[itemId];
        c.share = share;
        c.symbol = symbol;
        c.initialPrice = initialPrice;
        sharesCount += share;
        dictionary[symbol] = itemId;
        emit instrumentAdded(itemId);
    }

    function setShare(uint16 id, uint16 share) public{
        require(msg.sender == oracle.updater(), "only authorized address may setShare");
        cartItem storage c = items[id];
        sharesCount -= c.share;
        sharesCount += share;
        c.share = share;
        emit shareChanged(id);
    }

    function getCurrentSharePrice() public view returns (uint256 price){
        uint256 overallCartPrice;
        for (uint16 j = 1; j <= itemsCount; j ++) {
            cartItem storage c = items[j];
            overallCartPrice += c.share * 10**6 * oracle.getPrice(c.symbol) * (10**(decimals-oracle.getDecimals(c.symbol)))/c.initialPrice;
        }
        return overallCartPrice/sharesCount;
    }

    function getPrice(string memory symbol) public view returns (uint256) {
        if (keccak256(bytes(symbol)) == keccak256(bytes("stb")))
            return oracle.getPrice("etc") * 10**6 / getCurrentSharePrice();
        return oracle.getPrice(symbol);
    }

    function getDecimals(string memory symbol) public view returns (uint8 _decimals) {
        return oracle.getDecimals(symbol);
    }
}
