// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

    struct Instrument {
        uint256 price;
        uint256 timeStamp;
    }

    struct instrumentDescription {
        uint256 id;
        string name;
        uint256 decimals;
    }
import "./INTDAO.sol";

contract exchangeRateContract {
    INTDAO dao;

    constructor(address payable _INTDAOaddress) payable{
        dao = INTDAO(_INTDAOaddress);
        dao.setAddressOnce("oracle", payable(address(this)));
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

    function changeBeneficiaryAddress(address payable newAddress) public onlyAuthor{
        if (!finalized)
            beneficiary = newAddress;
    }

    function finalize() public onlyAuthor{
        if (!finalized)
            finalized = true;
    }

    function changeUpdaterAddress (address payable newAddress) public onlyAuthor{
        updater = newAddress;
    }

    function requestPriceUpdate(uint256 id) public payable {
        require (msg.value>=2*updOnePriceGasCost*tx.gasprice, "You need to pass more ether to request new price.");
        emit priceUpdateRequest(id);
    }

    function requestMultiplePricesUpdate(uint256[] memory ids) public payable {
        require (msg.value>= 2 * (ids.length * updAdditionalPrice + updSeveralPricesCost) * tx.gasprice, "You need to pass more ether to request new price.");
        emit severalPricesUpdateRequest(ids);
    }

    function updateSeveralPrices(uint256[] memory ids, uint256[] memory prices) public onlyUpdater{
        for (uint i=0; i<ids.length; i++)
            updPrice (ids[i], prices[i]);
    }

    function transferProfit() public onlyAuthor{
        beneficiary.transfer(address(this).balance);
        emit profit(address(this).balance);
    }

    function updateSinglePrice(uint256 id, uint256 newPrice) public onlyUpdater{
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

    function addInstrument(string memory symbol, string memory name, uint256 decimals) public onlyUpdater returns (uint256 id){
        require (bytes (dictionary[symbol].name).length == 0, "Symbol already exist, use updateInstrument");
        id = instrumentsCount;
        dictionary[symbol].id = id;
        dictionary[symbol].name = name;
        dictionary[symbol].decimals = decimals;
        instruments[id].timeStamp = block.timestamp;
        instrumentsCount++;
        return id;
    }

    function updateInstrument(string memory symbol, string memory name, uint decimals) public onlyUpdater{
        dictionary[symbol].name = name;
        dictionary[symbol].decimals = decimals;
    }

    function getPrice(string memory symbol) public view returns (uint256) {
        return instruments[dictionary[symbol].id].price;
    }

    function timeStamp(string memory symbol) public view returns (uint256) {
        return instruments[dictionary[symbol].id].timeStamp;
    }

    function getDecimals(string memory symbol) public view returns (uint256) {
        return dictionary[symbol].decimals;
    }

    receive() external payable {}
}
