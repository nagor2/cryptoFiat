// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "./IDAO.sol";

contract exchangeRateContract {
    IDAO immutable dao;

    uint16 public instrumentsCount;

    uint256 constant public updOnePriceGasCost = 84928;
    uint256 constant public updSeveralPricesCost = 87742;
    uint256 constant public updAdditionalPrice = 22700;

    address public author;
    address public beneficiary;
    address public updater;

    bool public finalized;

    struct Instrument {
        uint128 price;
        uint128 timeStamp;
    }

    struct InstrumentDescription {
        uint16 id;
        string name;
        uint8 decimals;
    }

    mapping(uint16 => Instrument) public instruments;
    mapping(string => InstrumentDescription) public dictionary;

    constructor(address _INTDAOaddress) payable{
        dao = IDAO(_INTDAOaddress);
        author = msg.sender;
        updater = msg.sender;
        beneficiary = msg.sender;
    }

    modifier onlyAuthor{
        require(msg.sender == author, "This function is for author only");
        _;
    }

    modifier onlyUpdater{
        require(msg.sender == updater, "This function is for updater only");
        _;
    }

    event priceUpdateRequest (uint16 id);
    event severalPricesUpdateRequest (uint16[] ids);
    event priceUpdated (uint16 id);
    event profit (uint256 profit);
    event highVolatility(uint16 id);

    function changeBeneficiaryAddress(address payable newAddress) external onlyAuthor{
        require(!finalized, "finalized");
        beneficiary = newAddress;
    }

    function finalize() external  onlyAuthor{
        require(!finalized, "finalized");
        finalized = true;
    }

    function changeUpdaterAddress (address payable newAddress) external onlyAuthor{
        updater = newAddress;
    }

    function requestPriceUpdate(uint16 id) external payable {
        require (msg.value>=2*updOnePriceGasCost*tx.gasprice, "You need to pass more ether to request new price.");
        emit priceUpdateRequest(id);
    }

    function requestMultiplePricesUpdate(uint16[] memory ids) external payable {
        require (msg.value>= 2 * (ids.length * updAdditionalPrice + updSeveralPricesCost) * tx.gasprice, "You need to pass more ether to request new price.");
        emit severalPricesUpdateRequest(ids);
    }

    function updateSeveralPrices(uint16[] memory ids, uint128[] memory prices) external onlyUpdater{
        uint length = ids.length;
        require(length==prices.length, "arrays length");
        for (uint16 i = 0; i < length;) {
            updPrice(ids[i], prices[i]);
            unchecked {
                ++i;
            }
        }
    }

    function transferProfit() external onlyAuthor{
        payable(beneficiary).transfer(address(this).balance);
        emit profit(address(this).balance);
    }

    function updateSinglePrice(uint16 id, uint128 newPrice) external onlyUpdater{
        updPrice (id, newPrice);
    }

    function updPrice(uint16 id, uint128 newPrice) internal {
        instruments[id].timeStamp = uint128(block.timestamp);
        uint128 prevPrice = instruments[id].price;
        uint128 move;
        if (prevPrice!=0){
            if (prevPrice >= newPrice)
                move = prevPrice - newPrice;
            else
                move = newPrice - prevPrice;
            if ((move * 100) / prevPrice > dao.params("highVolatilityEventBarrierPercent"))
                emit highVolatility(id);
        }
        instruments[id].price = newPrice;
        emit priceUpdated (id);
    }

    function addInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater returns (uint16 id){
        InstrumentDescription storage newInstrumentDescription = dictionary[symbol];
        require (bytes(newInstrumentDescription.name).length == 0, "Symbol already exist, use updateInstrument");
        newInstrumentDescription.id = instrumentsCount++;
        newInstrumentDescription.name = name;
        newInstrumentDescription.decimals = decimals;
        instruments[newInstrumentDescription.id].timeStamp = uint128(block.timestamp);
        return newInstrumentDescription.id;
    }

    function updateInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater{
        InstrumentDescription storage newInstrumentDescription = dictionary[symbol];
        require(bytes(newInstrumentDescription.name).length != 0,
            "Symbol doesn't exist, use addInstrument");
        newInstrumentDescription.name = name;
        newInstrumentDescription.decimals = decimals;
    }

    function getPrice(string memory symbol) external view returns (uint128) {
        return instruments[dictionary[symbol].id].price;
    }

    function timeStamp(string memory symbol) external view returns (uint128) {
        return instruments[dictionary[symbol].id].timeStamp;
    }

    function getDecimals(string memory symbol) external view returns (uint8) {
        return dictionary[symbol].decimals;
    }
}
