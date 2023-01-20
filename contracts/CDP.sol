// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./exchangeRateContract.sol";
import "./Rule.sol";
import "./stableCoin.sol";
import "./Auction.sol";
import "./weth.sol";



contract CDP {
    uint256 public numPositions;
    address INTDAOaddress = address(0);

    INTDAO dao;
    exchangeRateContract oracle;
    stableCoin coin;
    Auction auction;
    Rule rule;
    ERC20 weth;

    mapping(uint => Position) public positions;
    event PositionOpened (address owner, uint256 posId);
    event PositionUpdated (uint256 posID, uint256 newStableCoinsAmount);
    event markedOnLiquidation (uint256 posID, uint256 timestamp);
    event OnLiquidation (uint256 posID, uint256 timestamp);

    struct Position {
        bool onLiquidation;
        bool liquidated;
        address owner;
        uint256 coinsMinted;
        uint256 wethAmountLocked;
        uint256 feeGeneratedRecorded;
        uint256 timeOpened;
        uint256 lastTimeUpdated;
        uint256 feeRate;
        uint256 markedOnLiquidation;
    }

    constructor(address _INTDAOaddress) {
        INTDAOaddress = _INTDAOaddress;
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('cdp',payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracle = exchangeRateContract(dao.addresses('oracle'));
        auction = Auction(dao.addresses('auction'));
        rule = Rule(dao.addresses('rule'));
        weth = ERC20(dao.addresses('weth'));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracle = exchangeRateContract(dao.addresses('oracle'));
        auction = Auction(dao.addresses('auction'));
        weth = ERC20(dao.addresses('weth'));
    }

    function openCDP (uint StableCoinsToMint) external payable returns (uint256 posID){
        posID = numPositions++;
        Position storage p = positions[posID];

        uint coinsToMint = getMaxStableCoinsToMint(msg.value);

        if (StableCoinsToMint <= coinsToMint)
            coinsToMint = StableCoinsToMint;

        p.coinsMinted = coinsToMint;
        p.wethAmountLocked = msg.value;
        dao.addresses('weth').call{value: msg.value}("");
        p.owner = msg.sender;
        p.timeOpened = block.timestamp;
        p.lastTimeUpdated = block.timestamp;
        p.feeGeneratedRecorded = 0;
        p.feeRate = dao.params('interestRate');
        p.onLiquidation = false;

        coin.mint(msg.sender, coinsToMint);

        emit PositionOpened(p.owner, posID);

        return posID;
    }

    function generatedFeeUnrecorded(uint256 posID) public view returns (uint256 fee) {
        Position storage p = positions[posID];
        return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.feeRate / 31536000 / 100;
    }

    function totalCurrentFee(uint256 posID) public view returns (uint256 fee){
        Position storage p = positions[posID];
        return p.feeGeneratedRecorded + generatedFeeUnrecorded(posID);
    }

    function getMaxStableCoinsToMint(uint256 ethValue) public view returns (uint256 amount) {
        uint256 etherPrice = oracle.getPrice('eth');
        uint256 etherDecimals = oracle.getDecimals('eth');
        return ethValue * etherPrice * (100 - dao.params('collateralDiscount'))/(10**etherDecimals)/100;
    }

    function getMaxStableCoinsToMintForPos(uint256 posID) public view returns (uint256 maxAmount){
        Position storage p = positions[posID];
        uint256 etherPrice = oracle.getPrice('eth');
        return p.wethAmountLocked * etherPrice * (100 - dao.params('collateralDiscount'))/100/100 - totalCurrentFee(posID);
    }

    function closeCDP(uint posID) public returns (bool success){
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        //shows minimum amount of INT you have to own
        // Rule allowed to which address? )
        //burnFromCollateral from wich addressAllowed?
        //sendEtherToOwner
        //checkAllowance of RuleTokens
        //if allowed, transfer on balance, then burn
    }

    function transferFee(uint posID) public returns (bool success){
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        uint256 fee = p.feeGeneratedRecorded + generatedFeeUnrecorded(posID);
        require(fee > 10**18, 'No or little fee generated');
        require(coin.balanceOf(p.owner) >= fee, 'insufficient funds on owners balance');
        require(coin.allowance(p.owner, address(this)) >= fee, 'allow spending first');
        require(coin.transferFrom(p.owner, address(this), fee), 'Was not able to transfer fee');
        return true;
    }

    function allowSurplusToAuction() public returns (bool success) {
        uint256 stabilizationFundAmount = dao.params('stabilizationFundPercent')*coin.totalSupply()/100;
        require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
        uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
        require (surplus >= dao.params('minAuctionBalanceToInitBuyOut'), "not enough surplus to start buyOut");
        require (coin.approve(dao.addresses('auction'), surplus));
        return true;
    }

    function claimMarginCall(uint posID) public returns (bool success) {
        Position storage p = positions[posID];
        require (p.markedOnLiquidation>0 && block.timestamp - p.markedOnLiquidation > dao.params('marginCallTimeLimit'), "Position is not marked to be opened or owner still has time");
        require(!p.onLiquidation, "Position is already on liquidation");
        uint256 maxCoinsForPos = getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
        if (maxCoinsForPos < p.coinsMinted) {
            p.onLiquidation = true;

            weth.approve(dao.addresses('auction'), p.wethAmountLocked);

            //Отправляем на аукцион. Если выкупаем нужное количество монет - ок, разницу отправляем владельцу. Если не выкупаем - берем из стабфонда. Если в стабфонде нет - выпускаем Рул.

            emit OnLiquidation (posID, block.timestamp);
            return true;
        }
        else {
            p.markedOnLiquidation = 0;
            return false;
        }
    }

    function finishMarginCall(uint256 posID, uint256 auctionID) public {

    }

    function markToLiquidate(uint posID) public returns (bool success){
        Position storage p = positions[posID];
        require (p.markedOnLiquidation==0 && !p.onLiquidation, "This position is on liquidation or already marked");
        uint256 maxCoinsForPos = getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
        if (maxCoinsForPos < p.coinsMinted) {
            p.markedOnLiquidation = block.timestamp;
            emit markedOnLiquidation (posID, block.timestamp);
            return true;
        }
        return false;
    }

    function eraseMarkToLiquidate(uint posID) public{
        Position storage p = positions[posID];
        require (p.markedOnLiquidation>0 && !p.onLiquidation && !p.liquidated, "This position is not marked or locked/liquidated");
        uint256 maxCoinsForPos = getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
        if (maxCoinsForPos > p.coinsMinted) {
            p.markedOnLiquidation = 0;
        }
    }

    function updateCDP(uint posID, uint newStableCoinsAmount) public payable returns (bool success){
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        require(p.owner == msg.sender, 'Only owner may update the position');
        uint256 maxCoinsToMint;

        p.feeGeneratedRecorded = generatedFeeUnrecorded(posID);
        p.lastTimeUpdated = block.timestamp;

        if (msg.value>0) {
            p.wethAmountLocked += msg.value;
            dao.addresses('weth').call{value: msg.value}("");
        }

        maxCoinsToMint = getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
        require(maxCoinsToMint>0 && maxCoinsToMint >= newStableCoinsAmount, 'not enough collateral to mint amount');

        if (newStableCoinsAmount > p.coinsMinted) {
            uint256 difference = newStableCoinsAmount - p.coinsMinted;
            coin.mint(p.owner, difference);
            emit PositionUpdated(posID, newStableCoinsAmount);
            return true;
        }

        if (newStableCoinsAmount < p.coinsMinted) {
            uint256 difference = p.coinsMinted - newStableCoinsAmount;
            require(coin.balanceOf(p.owner)>=difference);
            coin.burn(p.owner, difference);
            emit PositionUpdated(posID, newStableCoinsAmount);
            return true;
        }
    }

    function withdrawEther (uint256 posID, uint256 etherToWithdraw) public{
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        //open Auction in the same contract
    }

    function recieveInterestAfterAuction() public {
        //INT.mintForCDP();
    }

    function burnRule() public{
        rule.burn(address(this), rule.balanceOf(address(this)));
    }

    function mintRule(address to, uint256 amount) public returns (bool success){
        require (msg.sender == dao.addresses('auction'), "Only auction is allowed to claim mint");
        rule.mint(to, amount);
        return true;
    }
}
