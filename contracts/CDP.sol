// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./exchangeRateContract.sol";
import "./Rule.sol";
import "./stableCoin.sol";
import "./Auction.sol";
import "./weth.sol";

    struct Position {
        address owner;
        uint256 coinsMinted;
        uint256 wethAmountLocked;
        uint256 feeGeneratedRecorded;
        uint256 timeOpened;
        uint256 lastTimeUpdated;
        uint256 feeRate;
        uint256 markedOnLiquidation;
        bool onLiquidation;
        bool liquidated;
        uint256 liquidationAuctionID;
    }

contract CDP {
    uint256 public numPositions;
    INTDAO dao;
    exchangeRateContract oracle;
    stableCoin coin;
    Auction auction;
    Rule rule;
    ERC20 weth;

    mapping(uint256 => Position) public positions;
    event PositionOpened (address owner, uint256 posId);
    event PositionUpdated (uint256 posID, uint256 newStableCoinsAmount, uint256 wethLocked);
    event markedOnLiquidation (uint256 posID, uint256 timestamp);
    event OnLiquidation (uint256 posID, uint256 timestamp);

    constructor(address payable INTDAOaddress) {
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('cdp',payable(address(this)));
        dao.setAddressOnce('inflationSpender',payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracle = exchangeRateContract(dao.addresses('cart'));
        auction = Auction(dao.addresses('auction'));
        rule = Rule(dao.addresses('rule'));
        weth = ERC20(dao.addresses('weth'));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracle = exchangeRateContract(dao.addresses('cart'));
        auction = Auction(dao.addresses('auction'));
        weth = ERC20(dao.addresses('weth'));
    }

    function openCDP (uint StableCoinsToMint) external payable returns (uint256 posID){
        uint256 coinsToMint = getMaxStableCoinsToMint(msg.value);

        if (StableCoinsToMint <= coinsToMint)
            coinsToMint = StableCoinsToMint;

        require (coinsToMint>1*10**coin.decimals(), "you can not mint less than 1 coin");

        posID = numPositions++;
        Position storage p = positions[posID];

        p.coinsMinted = coinsToMint;
        p.wethAmountLocked = msg.value;
        (bool successTransfer, ) = dao.addresses('weth').call{value: msg.value}("");
        require(successTransfer, 'Could not pass funds to weth contract for some reason');
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
        uint256 price = oracle.getPrice('stb');
        uint256 decimals = oracle.getDecimals('etc');
        return ethValue * price * (100 - dao.params('collateralDiscount'))/(10**decimals)/100;
    }

    function getMaxStableCoinsToMintForPos(uint256 posID) public view returns (uint256 maxAmount){
        Position storage p = positions[posID];
        return getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
    }

    function claimInterest(uint256 amount, address beneficiary) public{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        if (coin.balanceOf(address(this))>amount)
            coin.transfer(beneficiary, amount);
        else {
            uint256 difference = amount - coin.balanceOf(address(this));
            coin.transfer(beneficiary, coin.balanceOf(address(this)));
            coin.approve(beneficiary, difference+coin.allowance(address(this), beneficiary));
        }
    }

    function claimEmission(uint256 amount, address beneficiary) public{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        coin.mint(beneficiary,amount);
    }

    function closeCDP(uint posID) public{
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        uint256 overallDebt = totalCurrentFee(posID)+p.coinsMinted;
        require(coin.transferFrom(p.owner, address(this), overallDebt), "Could not transfer coins for some reason. You have to allow coins first");
        require (weth.transfer(p.owner, p.wethAmountLocked), "Could not transfer collateral for some reason");
        p.wethAmountLocked = 0;
        require (coin.burn(address(this), p.coinsMinted), "Could not burn coins for some reason");
        p.coinsMinted = 0;
        p.lastTimeUpdated = block.timestamp;
        p.liquidated = true;
    }

    function transferFee(uint posID) public returns (bool success){
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        uint256 fee = p.feeGeneratedRecorded + generatedFeeUnrecorded(posID);
        require(coin.transferFrom(p.owner, address(this), fee), 'Was not able to transfer fee. Insufficient balance or allowance. Try to allow spending first');
        p.feeGeneratedRecorded = 0;
        p.lastTimeUpdated = block.timestamp;
        return true;
    }

    function allowSurplusToAuction() public returns (bool success) {
        uint256 stabilizationFundAmount = dao.params('stabilizationFundPercent')*coin.totalSupply()/100;
        require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
        uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
        require (surplus >= dao.params('minCDPBalanceToInitBuyOut'), "not enough surplus to start buyOut");
        require (coin.approve(dao.addresses('auction'), surplus), "could not approve coins for some reason");
        return true;
    }

    function claimMarginCall(uint posID) public returns (bool success) {
        Position storage p = positions[posID];
        require (p.markedOnLiquidation>0 && block.timestamp - p.markedOnLiquidation > dao.params('marginCallTimeLimit'), "Position is not marked to be opened or owner still has time");
        require(!p.onLiquidation, "Position is already on liquidation");
        uint256 maxCoinsForPos = getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
        if (maxCoinsForPos < p.coinsMinted) {
            p.onLiquidation = true;
            uint256 currentAllowance = weth.allowance(dao.addresses('cdp'), dao.addresses('auction'));
            require(weth.approve(dao.addresses('auction'), currentAllowance+p.wethAmountLocked), "could not approve weth for some reason");
            emit OnLiquidation (posID, block.timestamp);
            return true;
        }
        else {
            p.markedOnLiquidation = 0;
            return false;
        }
    }

    function startCoinsBuyOut(uint256 posID) public{
        Position storage p = positions[posID];
        p.liquidationAuctionID = auction.initCoinsBuyOut(posID);
    }

    function finishMarginCall(uint256 posID) public {
        Position storage p = positions[posID];
        require(auction.claimToFinalizeAuction(p.liquidationAuctionID), "could not finalize auction");
        uint256 bidAmount = auction.getBestBidAmount(p.liquidationAuctionID);

        if (bidAmount>p.coinsMinted + p.coinsMinted * dao.params('liquidationFee') / 100){
            uint256 difference = bidAmount - p.coinsMinted - p.coinsMinted * dao.params('liquidationFee') / 100;
            coin.transfer(p.owner, difference);
            coin.burn(address(this), p.coinsMinted);
        }

        if (bidAmount<=p.coinsMinted){
            if (coin.balanceOf(address(this)) >= p.coinsMinted)
                coin.burn(address(this), p.coinsMinted);
            else {
                uint256 difference = p.coinsMinted - coin.balanceOf(address(this));
                auction.initCoinsBuyOutForStabilization(difference);
            }
        }
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

        p.feeGeneratedRecorded += generatedFeeUnrecorded(posID);
        p.lastTimeUpdated = block.timestamp;

        if (msg.value>0) {
            p.wethAmountLocked += msg.value;
            (bool successTransfer, ) = dao.addresses('weth').call{value: msg.value}("");
            require(successTransfer, 'Could not pass funds to weth contract for some reason');
        }

        maxCoinsToMint = getMaxStableCoinsToMint(p.wethAmountLocked) - totalCurrentFee(posID);
        require(maxCoinsToMint>0 && maxCoinsToMint >= newStableCoinsAmount, 'not enough collateral to mint amount');

        if (newStableCoinsAmount > p.coinsMinted) {
            uint256 difference = newStableCoinsAmount - p.coinsMinted;
            coin.mint(p.owner, difference);
            p.coinsMinted = newStableCoinsAmount;
            emit PositionUpdated(posID, newStableCoinsAmount, p.wethAmountLocked);
            return true;
        }

        if (newStableCoinsAmount < p.coinsMinted) {
            uint256 difference = p.coinsMinted - newStableCoinsAmount;
            require(coin.balanceOf(p.owner)>=difference);
            coin.burn(p.owner, difference);
            p.coinsMinted = newStableCoinsAmount;
            emit PositionUpdated(posID, newStableCoinsAmount, p.wethAmountLocked);
            return true;
        }
    }

    function withdrawEther (uint256 posID, uint256 etherToWithdraw) public{
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        require(p.owner == msg.sender, 'Only owner may update the position');
        require (etherToWithdraw<p.wethAmountLocked, "You dont have enough weth locked on this pos");
        uint256 wethToLeave = p.wethAmountLocked - etherToWithdraw;
        uint256 maxCoins = getMaxStableCoinsToMint(wethToLeave) - totalCurrentFee(posID);
        require (maxCoins>p.coinsMinted, "you want to keep not enough weth to cover emission and current fee");
        p.wethAmountLocked -= etherToWithdraw;
        weth.transfer(msg.sender, etherToWithdraw);
        emit PositionUpdated (posID, p.coinsMinted, p.wethAmountLocked);
    }

    function wethLocked(uint256 posID) public view returns (uint256 amount) {
        Position storage p = positions[posID];
        return p.wethAmountLocked;
    }

    function isOnLiquidation(uint256 posID) public view returns (bool result){
        Position storage p = positions[posID];
        return p.onLiquidation;
    }

    function burnRule() public{
        rule.burn(address(this), rule.balanceOf(address(this)));
    }

    function mintRule(address to, uint256 amount) public returns (bool success){
        require (msg.sender == dao.addresses('auction'), "Only auction is allowed to claim mint");
        rule.mint(to, amount);
        return true;
    }

    receive() external payable {
        dao.addresses('oracle').transfer(address(this).balance);
    }
}
