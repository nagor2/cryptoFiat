// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "./IDAO.sol";

/// @title exchange rate - the contract to receive quotes from oracle.
contract exchangeRateContract{

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice counter for instruments
    uint16 public instrumentsCount;

    /// @notice gas prices to pay if someone wants oracle to send quotes update out of schedule for one instrument.
    uint256 constant public updOnePriceGasCost = 84928;

    /// @notice gas prices to pay if someone wants oracle to send quotes update out of schedule for several instruments.
    uint256 constant public updSeveralPricesCost = 87742;

    /// @notice gas prices to pay if someone wants oracle to send quotes update out of schedule for every additional instrument in a bundle.
    uint256 constant public updAdditionalPrice = 22700;

    /// @notice author of this contract address
    address public author;

    /// @notice Address to receive profit, gained by this contract for out of schedule updates.
    address public beneficiary;

    /// @notice Authorized address to send updates.
    address public updater;

    /// @notice The contract may be finalized, which means, that beneficiary address can not be changed anymore.
    bool public finalized;

    struct Instrument {
        uint256 price;
        uint128 timeStamp;
    }

    struct InstrumentDescription {
        uint16 id;
        string name;
        uint8 decimals;
    }

    /// @notice Instrument storage
    mapping(uint16 => Instrument) public instruments;

    /// @notice InstrumentDescription dictionary
    mapping(string => InstrumentDescription) public dictionary;

    /// @notice Constructor for exchangeRateContract contract.
    /// @param _INTDAOaddress - the address of main DAO contract.
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

    /// @notice Emitted when someone requested to update a single quote
    /// @param id Id of the instrument
    event priceUpdateRequest (uint16 id);

    /// @notice Emitted when someone requested to update a several quotes
    /// @param ids Array of ids.
    event severalPricesUpdateRequest (uint16[] ids);

    /// @notice Emitted when price of the certain instrument is updated
    /// @param id Id of the instrument
    event priceUpdated (uint16 id);

    /// @notice Event for transferring the profit of the contract
    /// @param profit Amount of profit obtained
    event profit (uint256 profit);

    /// @notice Event emitted when the price of given instrument changes more than highVolatilityEventBarrierPercent from DAO
    /// @param id Id of the instrument
    event highVolatility(uint16 id);

    /// @notice Change the address to receive profit
    /// @param newAddress New address
    function changeBeneficiaryAddress(address payable newAddress) external onlyAuthor{
        require(!finalized, "finalized");
        beneficiary = newAddress;
    }

    /// @notice Make the change of beneficiary address impossible
    function finalize() external  onlyAuthor{
        require(!finalized, "finalized");
        finalized = true;
    }

    /// @notice Change the address to get transactions with quotes from
    /// @param newAddress New address
    function changeUpdaterAddress (address payable newAddress) external onlyAuthor{
        updater = newAddress;
    }

    /// @notice Request of price update. A payable function.
    /// @param id Id of the instrument
    function requestPriceUpdate(uint16 id) external payable {
        require (msg.value>=2*updOnePriceGasCost*tx.gasprice, "You need to pass more ether to request new price.");
        emit priceUpdateRequest(id);
    }

    /// @notice Request of several prices update
    /// @param ids Array of ids
    function requestMultiplePricesUpdate(uint16[] memory ids) external payable {
        require (msg.value>= 2 * (ids.length * updAdditionalPrice + updSeveralPricesCost) * tx.gasprice, "You need to pass more ether to request new price.");
        emit severalPricesUpdateRequest(ids);
    }

    /// @notice Updating several prices. Only updater address may invoke it.
    /// @param ids Array of ids
    /// @param ids Array of prices
    function updateSeveralPrices(uint16[] memory ids, uint256[] memory prices) external onlyUpdater{
        uint length = ids.length;
        require(length==prices.length, "arrays length");
        for (uint16 i = 0; i < length;) {
            updPrice(ids[i], prices[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Method to transfer profit
    function transferProfit() external{
        payable(beneficiary).transfer(address(this).balance);
        emit profit(address(this).balance);
    }

    /// @notice Method to update single price
    /// @param id ID of the instrument
    /// @param newPrice New price
    function updateSinglePrice(uint16 id, uint256 newPrice) external onlyUpdater{
        updPrice (id, newPrice);
    }

    function updPrice(uint16 id, uint256 newPrice) internal {
        instruments[id].timeStamp = uint128(block.timestamp);
        uint256 prevPrice = instruments[id].price;
        uint256 move;
        if (prevPrice!=0){
            if (prevPrice >= newPrice)
                move = prevPrice - newPrice;
            else
                move = newPrice - prevPrice;
            if ((move * 100) / prevPrice > dao.params("highVolatilityEventBarrierPercent"))
                emit highVolatility(id);
        }
        instruments[id].price = newPrice;
        emit priceUpdated(id);
    }

    /// @notice Method to add an instrument to storage. It is for updater only.
    /// @param symbol Symbol of the instrument
    /// @param name Name of the instrument
    /// @param decimals Number of decimals in price.
    /// @return id ID of new instrument.
    function addInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater returns (uint16 id){
        InstrumentDescription storage newInstrumentDescription = dictionary[symbol];
        require (bytes(newInstrumentDescription.name).length == 0, "Symbol already exist, use updateInstrument");
        newInstrumentDescription.id = ++instrumentsCount;
        newInstrumentDescription.name = name;
        newInstrumentDescription.decimals = decimals;
        instruments[newInstrumentDescription.id].timeStamp = uint128(block.timestamp);
        return newInstrumentDescription.id;
    }

    /// @notice Method to update name and decimals of the instrument. For updater only.
    /// @param symbol Symbol of the instrument
    /// @param name Name of the instrument
    /// @param decimals Number of decimals in price.
    function updateInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater{
        InstrumentDescription storage newInstrumentDescription = dictionary[symbol];
        require(bytes(newInstrumentDescription.name).length != 0,
            "Symbol doesn't exist, use addInstrument");
        newInstrumentDescription.name = name;
        newInstrumentDescription.decimals = decimals;
    }

    /// @notice Getter of the current price of the instrument
    /// @param symbol Symbol of the instrument
    /// @return Price
    function getPrice(string memory symbol) external view returns (uint256) {
        return instruments[dictionary[symbol].id].price;
    }

    /// @notice Getter of the last time the price was updated for the given instrument
    /// @param symbol Symbol of the instrument
    /// @return timeStamp
    function timeStamp(string memory symbol) external view returns (uint256) {
        return instruments[dictionary[symbol].id].timeStamp;
    }

    /// @notice Getter of decimals for the given instrument
    /// @param symbol Symbol of the instrument
    /// @return decimals
    function getDecimals(string memory symbol) external view returns (uint8) {
        return dictionary[symbol].decimals;
    }
}
