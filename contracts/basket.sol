// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.10 <0.9.0;
import "./IDAO.sol";

interface IOracle{
    function updater() external view returns (address);
    function getPrice(string memory) external view returns (uint256);
    function getDecimals(string memory) external view returns (uint8);
}

contract basketContract{

    struct basketItem {
        string symbol;
        uint16 share;
        uint256 initialPrice;
    }

    /// @notice DAO interface to interact with (initializes in constructor)
    IDAO immutable dao;

    /// @notice Oracle interface to interact with (initializes in renewContracts).
    IOracle oracle;

    /// @notice Items counter.
    uint16 public itemsCount;

    /// @notice Total shares counter.
    uint16 public sharesCount;

    /// @notice Number of decimals for each item.
    uint8 public constant decimals = 6;

    /// @notice Mapping to store all the items. Each basketItem is a struct of (symbol, share, initialPrice).
    mapping(uint16 => basketItem) public items;

    /// @notice Mapping to store pairs (symbol, itemID).
    mapping (string => uint16) public dictionary;

    /// @notice Emitted when a new instrument is added.
    /// @param id Item ID.
    event instrumentAdded(uint16 id);

    /// @notice Emitted when the share of a certain instrument is changed.
    /// @param id Item ID.
    event shareChanged(uint16 id);

    // @notice Modifier to check that the caller is authorized by the DAO
    modifier updaterOnly() {
        require(msg.sender == oracle.updater(), "updater only");
        _;
    }

    /// @notice Constructor for the basket contract.
    /// @param _INTDAOaddress The address of the main DAO contract.
    constructor(address payable _INTDAOaddress) payable{
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice This method is used when the addresses of contracts to use are changed by voting or just after deployment.
    function renewContracts() external{
        oracle = IOracle(dao.addresses("oracle"));
    }

    /// @notice This method is to add an additional commodity to the basket by the authorized address only. An event with a new item ID is emitted.
    /// @param symbol The symbol of the new item. For example, ‘Copper’.
    /// @param share The share of the new item. The share is used to estimate the weight of a certain item in the basket, so the price change of gold may be more significant for the whole basket than the orange juice price change.
    /// @param initialPrice Initial price of an item. For instance, 2500 USD for gold.
    function addItem(string memory symbol, uint16 share, uint256 initialPrice) external updaterOnly{
        require (dictionary[symbol]==0, "instrument exists");
        uint16 itemId = ++itemsCount;
        basketItem storage c = items[itemId];
        c.share = share;
        c.symbol = symbol;
        c.initialPrice = initialPrice;
        sharesCount += share;
        dictionary[symbol] = itemId;
        emit instrumentAdded(itemId);
    }

    /// @notice This method is used to change the share (or weight) of a particular item in the basket.
    /// @param id Item ID.
    /// @param share New share of the item in the basket. To delete a particular item from the basket, you may set a 0 share.
    function setShare(uint16 id, uint16 share) external updaterOnly{
        basketItem storage c = items[id];
        sharesCount -= c.share;
        sharesCount += share;
        c.share = share;
        emit shareChanged(id);
    }

    /// @notice Method is used to calculate the price change of 1 share of the basket. The total shares of all items are stored in sharesCount. For each item in the basket, the method multiplies the share of an item by its price change (current item price - initial item price) and then sums it to get the overallBasketPrice.
    /// @return priceChange The method returns the overallBasketPrice divided by sharesCount. Thus, we can estimate the change of one basket share price according to the price change of each item in the basket and its share in it.
    function getCurrentSharePriceChange() public view returns (uint256 priceChange){
        uint256 overallBasketPrice;
        for (uint16 j = 1; j <= itemsCount; j ++) {
            basketItem storage c = items[j];
            overallBasketPrice += c.share * 10**6 * oracle.getPrice(c.symbol) * (10**(decimals-oracle.getDecimals(c.symbol)))/c.initialPrice;
        }
        return overallBasketPrice /sharesCount;
    }

    /// @notice Returns the actual price of Ethereum versus basket share price change.
    function getEthereumVSCommoditiesPriceChange() external view returns (uint256){
        return oracle.getPrice("eth") * 10**6 / getCurrentSharePriceChange();
    }

    /// @notice Returns the actual price of the given commodity.
    /// @param symbol The symbol of the item in the basket. For example, ‘GLD’.
    function getPrice(string memory symbol) public view returns (uint256) {
        return oracle.getPrice(symbol);
    }

    /// @notice getDecimals returns the precision (the number of decimals) for each item in the basket as the price is stored as an integer. For example, if a price is 460000 and an item has 5 decimals, it means the price is 4.6 per one quote of an item.
    function getDecimals(string memory symbol) public view returns (uint8 _decimals) {
        return oracle.getDecimals(symbol);
    }
}
