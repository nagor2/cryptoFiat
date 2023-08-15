// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
import "./IDAO.sol";

    struct Instrument {
        uint256 price;
        uint256 timeStamp;
    }

    struct instrumentDescription {
        uint256 id;
        string name;
        uint8 decimals;
    }

contract exchangeRateContract {
    IDAO dao;

    constructor(address _INTDAOaddress) payable{
        dao = IDAO(_INTDAOaddress);
        dao.setAddressOnce("oracle", address(this));
        author = payable(msg.sender);
        updater = payable(msg.sender);
        beneficiary = payable(msg.sender);
    }

    uint256 public subscriptionsCount;
    uint256 public instrumentsCount;

    uint256 constant public updOnePriceGasCost = 84928;
    uint256 constant public updSeveralPricesCost = 87742;
    uint256 constant public updAdditionalPrice = 22700;

    address payable public author;
    address payable public beneficiary;
    address payable public updater;

    bool public finalized;

    mapping(uint256 => Instrument) public instruments;
    mapping(string => instrumentDescription) public dictionary;

    modifier onlyAuthor{
        require(msg.sender == author, "This function is for author only");
        _;
    }

    modifier onlyUpdater{
        require(msg.sender == updater, "This function is for updater only");
        _;
    }

    event priceUpdateRequest (uint256 id);
    event severalPricesUpdateRequest (uint256[] ids);
    event priceUpdated (uint256 id);
    event profit (uint256 profit);
    event highVolatility(uint256 id);

    function changeBeneficiaryAddress(address payable newAddress) external onlyAuthor{
        if (!finalized)
            beneficiary = newAddress;
    }

    function finalize() public onlyAuthor{
        if (!finalized)
            finalized = true;
    }

    function changeUpdaterAddress (address payable newAddress) external onlyAuthor{
        updater = newAddress;
    }

    function requestPriceUpdate(uint256 id) external payable {
        require (msg.value>=2*updOnePriceGasCost*tx.gasprice, "You need to pass more ether to request new price.");
        emit priceUpdateRequest(id);
    }

    function requestMultiplePricesUpdate(uint256[] memory ids) external payable {
        require (msg.value>= 2 * (ids.length * updAdditionalPrice + updSeveralPricesCost) * tx.gasprice, "You need to pass more ether to request new price.");
        emit severalPricesUpdateRequest(ids);
    }

    function updateSeveralPrices(uint256[] memory ids, uint256[] memory prices) external onlyUpdater{
        for (uint i=0; i<ids.length; i++)
            updPrice (ids[i], prices[i]);
    }

    function transferProfit() external onlyAuthor{
        beneficiary.transfer(address(this).balance);
        emit profit(address(this).balance);
    }

    function updateSinglePrice(uint256 id, uint256 newPrice) external onlyUpdater{
        updPrice (id, newPrice);
    }

    function updPrice(uint256 id, uint256 newPrice) internal {
        instruments[id].timeStamp = block.timestamp;
        uint256 prevPrice = instruments[id].price;
        uint256 move = 0;
        if (prevPrice!=0){
            if (prevPrice >= newPrice)
                move = prevPrice - newPrice;
            else
                move = newPrice - prevPrice;
            if (move * 100 / prevPrice > dao.params('highVolatilityEventBarrierPercent'))
                emit highVolatility(id);
        }
        instruments[id].price = newPrice;
        emit priceUpdated (id);
    }

    function addInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater returns (uint256 id){
        require (bytes (dictionary[symbol].name).length == 0, "Symbol already exist, use updateInstrument");
        id = instrumentsCount;
        dictionary[symbol].id = id;
        dictionary[symbol].name = name;
        dictionary[symbol].decimals = decimals;
        instruments[id].timeStamp = block.timestamp;
        instrumentsCount++;
        return id;
    }

    function updateInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater{
        dictionary[symbol].name = name;
        dictionary[symbol].decimals = decimals;
    }

    function getPrice(string memory symbol) external view returns (uint256) {
        return instruments[dictionary[symbol].id].price;
    }

    function timeStamp(string memory symbol) external view returns (uint256) {
        return instruments[dictionary[symbol].id].timeStamp;
    }

    function getDecimals(string memory symbol) external view returns (uint8) {
        return dictionary[symbol].decimals;
    }
}
