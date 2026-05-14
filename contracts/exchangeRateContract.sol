// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "./IDAO.sol";

/// @title exchange rate - the contract to receive quotes from oracle.
contract exchangeRateContract{

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice Counter for instruments.
    uint16 public instrumentsCount;

    /// @notice Gas price to pay if someone wants the oracle to send a quote update out of schedule for one instrument.
    uint256 constant public updOnePriceGasCost = 84928;

    /// @notice Gas price to pay if someone wants the oracle to send a quote update out of schedule for several instruments.
    uint256 constant public updSeveralPricesCost = 87742;

    /// @notice Gas price to pay if someone wants the oracle to send a quote update out of schedule for every additional instrument in a bundle.
    uint256 constant public updAdditionalPrice = 22700;

    /// @notice Address of the author of this contract.
    address public author;

    /// @notice Address to receive profit gained by this contract from out-of-schedule updates.
    address public beneficiary;

    /// @notice Authorized address to send updates.
    address public updater;

    /// @notice The contract may be finalized, which means the beneficiary address cannot be changed anymore.
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

    /// @notice Pending price waiting for time-lock to expire before becoming live.
    struct PendingPrice {
        uint256 price;
        uint256 effectiveAt;
    }

    /// @notice Instrument storage.
    mapping(uint16 => Instrument) public instruments;

    /// @notice InstrumentDescription dictionary.
    mapping(string => InstrumentDescription) public dictionary;

    /// @notice Pending prices submitted by updater but not yet applied.
    mapping(uint16 => PendingPrice) public pending;

    /// @notice Constructor for the exchangeRateContract contract.
    /// @param _INTDAOaddress The address of the main DAO contract.
    constructor(address _INTDAOaddress) payable{
        dao = IDAO(_INTDAOaddress);
        author = msg.sender;
        updater = msg.sender;
        beneficiary = msg.sender;
    }

    modifier onlyAuthor{
        require(msg.sender == author, "author only");
        _;
    }

    modifier onlyUpdater{
        require(msg.sender == updater, "updater only");
        _;
    }

    /// @notice Emitted when someone requests to update a single quote.
    /// @param id ID of the instrument.
    event priceUpdateRequest (uint16 id);

    /// @notice Emitted when someone requests to update several quotes.
    /// @param ids Array of IDs.
    event severalPricesUpdateRequest (uint16[] ids);

    /// @notice Emitted when a price is submitted to the pending queue.
    /// @param id ID of the instrument.
    /// @param price Submitted price value.
    /// @param effectiveAt Timestamp when the price can be applied.
    event PriceSubmitted (uint16 indexed id, uint256 price, uint256 effectiveAt);

    /// @notice Emitted when a pending price is applied and becomes live.
    /// @param id ID of the instrument.
    event priceUpdated (uint16 id);

    /// @notice Event for transferring the profit of the contract.
    /// @param profit Amount of profit obtained.
    event profit (uint256 profit);

    /// @notice Event emitted when the price of a given instrument changes more than the highVolatilityEventBarrierPercent from DAO.
    /// @param id ID of the instrument.
    event highVolatility(uint16 id);

    /// @notice Change the address to receive profit.
    /// @param newAddress New address.
    function changeBeneficiaryAddress(address payable newAddress) external onlyAuthor{
        require(!finalized, "finalized");
        beneficiary = newAddress;
    }

    /// @notice Make the change of the beneficiary address impossible.
    function finalize() external  onlyAuthor{
        require(!finalized, "finalized");
        finalized = true;
    }

    /// @notice Change the address to receive transactions with quotes.
    /// @param newAddress New address
    function changeUpdaterAddress (address payable newAddress) external onlyAuthor{
        updater = newAddress;
    }

    /// @notice Request a price update. A payable function.
    /// @param id ID of the instrument.
    function requestPriceUpdate(uint16 id) external payable {
        require (msg.value>=2*updOnePriceGasCost*tx.gasprice, "need more ether");
        emit priceUpdateRequest(id);
    }

    /// @notice Request multiple prices update.
    /// @param ids Array of IDs.
    function requestMultiplePricesUpdate(uint16[] memory ids) external payable {
        require (msg.value>= 2 * (ids.length * updAdditionalPrice + updSeveralPricesCost) * tx.gasprice, "need more ether");
        emit severalPricesUpdateRequest(ids);
    }

    /// @notice Submit several prices to the pending queue. Only the updater address may invoke it.
    /// @param ids Array of instrument IDs
    /// @param prices Array of prices
    function updateSeveralPrices(uint16[] memory ids, uint256[] memory prices) external onlyUpdater{
        uint length = ids.length;
        require(length==prices.length, "arrays length");
        for (uint16 i = 0; i < length;) {
            _submitPrice(ids[i], prices[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Method to transfer profit.
    function transferProfit() external{
        payable(beneficiary).transfer(address(this).balance);
        emit profit(address(this).balance);
    }

    /// @notice Submit a single price to the pending queue.
    /// @param id ID of the instrument.
    /// @param newPrice New price.
    function updateSinglePrice(uint16 id, uint256 newPrice) external onlyUpdater{
        _submitPrice(id, newPrice);
    }

    /// @notice Validates and stores a new price in the pending queue.
    /// Reverts if the move from the current live price exceeds priceBoundForRevert.
    /// Emits highVolatility if the move exceeds highVolatilityEventBarrierPercent.
    function _submitPrice(uint16 id, uint256 newPrice) internal {
        require(newPrice > 0, "price must be positive");

        uint256 prevPrice = instruments[id].price;

        if (prevPrice != 0) {
            uint256 move = prevPrice >= newPrice
                ? prevPrice - newPrice
                : newPrice - prevPrice;

            uint256 movePct = (move * 100) / prevPrice;

            uint256 bound = dao.params("priceBoundForRevert");
            if (bound == 0) bound = 10;
            require(movePct <= bound, "price move exceeds bound");

            if (movePct > dao.params("highVolatilityEventBarrierPercent"))
                emit highVolatility(id);
        }

        uint256 delay = dao.params("oraclePriceDelay");
        if (delay == 0) delay = 1 hours;

        pending[id] = PendingPrice({
            price: newPrice,
            effectiveAt: block.timestamp + delay
        });

        emit PriceSubmitted(id, newPrice, block.timestamp + delay);
    }

    /// @notice Apply a single pending price once the time-lock has expired. Anyone may call this.
    /// @param id ID of the instrument.
    function applyPendingPrice(uint16 id) external {
        PendingPrice memory p = pending[id];
        require(p.effectiveAt > 0, "no pending price");
        require(block.timestamp >= p.effectiveAt, "time-lock not expired");

        instruments[id].price = p.price;
        instruments[id].timeStamp = uint128(block.timestamp);
        delete pending[id];

        emit priceUpdated(id);
    }

    /// @notice Apply multiple pending prices in one transaction. Silently skips entries
    /// that have no pending price or whose time-lock has not yet expired.
    /// @param ids Array of instrument IDs to apply.
    function applyPendingPrices(uint16[] memory ids) external {
        for (uint16 i = 0; i < ids.length;) {
            PendingPrice memory p = pending[ids[i]];
            if (p.effectiveAt > 0 && block.timestamp >= p.effectiveAt) {
                instruments[ids[i]].price = p.price;
                instruments[ids[i]].timeStamp = uint128(block.timestamp);
                delete pending[ids[i]];
                emit priceUpdated(ids[i]);
            }
            unchecked { ++i; }
        }
    }

    /// @notice Method to add an instrument to storage. It is for updater only.
    /// @param symbol Symbol of the instrument.
    /// @param name Name of the instrument.
    /// @param decimals Number of decimals in the price.
    /// @return id ID of the new instrument.
    function addInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater returns (uint16 id){
        InstrumentDescription storage newInstrumentDescription = dictionary[symbol];
        require (bytes(newInstrumentDescription.name).length == 0, "symbol already exist, use updateInstrument");
        newInstrumentDescription.id = ++instrumentsCount;
        newInstrumentDescription.name = name;
        newInstrumentDescription.decimals = decimals;
        instruments[newInstrumentDescription.id].timeStamp = uint128(block.timestamp);
        return newInstrumentDescription.id;
    }

    /// @notice Method to update the name and decimals of the instrument. For updater only.
    /// @param symbol Symbol of the instrument.
    /// @param name Name of the instrument.
    /// @param decimals Number of decimals in the price.
    function updateInstrument(string memory symbol, string memory name, uint8 decimals) external onlyUpdater{
        InstrumentDescription storage newInstrumentDescription = dictionary[symbol];
        require(bytes(newInstrumentDescription.name).length != 0,
            "Symbol doesn't exist, use addInstrument");
        newInstrumentDescription.name = name;
        newInstrumentDescription.decimals = decimals;
    }

    /// @notice Getter of the current price of the instrument.
    /// @param symbol Symbol of the instrument.
    /// @return Price.
    function getPrice(string memory symbol) external view returns (uint256) {
        return instruments[dictionary[symbol].id].price;
    }

    /// @notice Getter of the last time the price was updated for the given instrument.
    /// @param symbol Symbol of the instrument
    /// @return timeStamp
    function timeStamp(string memory symbol) external view returns (uint256) {
        return instruments[dictionary[symbol].id].timeStamp;
    }

    /// @notice Getter of decimals for the given instrument.
    /// @param symbol Symbol of the instrument
    /// @return decimals
    function getDecimals(string memory symbol) external view returns (uint8) {
        return dictionary[symbol].decimals;
    }
}
