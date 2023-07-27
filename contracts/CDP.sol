// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./cart.sol";
import "./Rule.sol";
import "./stableCoin.sol";
import "./Auction.sol";
import "./weth.sol";

    struct Position {
        address owner;
        uint256 coinsMinted;
        uint256 wethAmountLocked;
        uint256 interestAmountRecorded;
        uint256 timeOpened;
        uint256 lastTimeUpdated;
        uint256 interestRate;
        uint256 markedOnLiquidationTimestamp;
        bool onLiquidation;
        bool liquidated;
        uint256 liquidationAuctionID;
        bool restrictInterestWithdrawal;
    }

contract CDP {
    uint256 public numPositions;
    INTDAO dao;
    cartContract oracleCart;
    stableCoin coin;
    Auction auction;
    Rule rule;
    ERC20 weth;

    mapping(uint256 => Position) public positions;
    event PositionOpened (address owner, uint256 posId);
    event PositionUpdated (uint256 posID, uint256 newStableCoinsAmount, uint256 wethLocked);
    event markedOnLiquidation (uint256 posID, uint256 timestamp);
    event markOnLiquidationErased (uint256 posID, uint256 timestamp);
    event OnLiquidation (uint256 posID, uint256 timestamp);

    constructor(address payable INTDAOaddress) {
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('cdp',payable(address(this)));
        dao.setAddressOnce('inflationSpender',payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracleCart = cartContract(dao.addresses('cart'));
        auction = Auction(dao.addresses('auction'));
        rule = Rule(dao.addresses('rule'));
        weth = ERC20(dao.addresses('weth'));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracleCart = cartContract(dao.addresses('cart'));
        auction = Auction(dao.addresses('auction'));
        weth = ERC20(dao.addresses('weth'));
    }

    function openCDP(uint256 stableCoinsToMint) external payable returns (uint256 posID){
        stableCoinsToMint = (stableCoinsToMint > getMaxStableCoinsToMint(msg.value))
                            ?getMaxStableCoinsToMint(msg.value):stableCoinsToMint;

        require (stableCoinsToMint >= dao.params('minCoinsToMint')*10**coin.decimals(), "you can not mint less than 1 coin");

        posID = numPositions++;
        Position storage p = positions[posID];

        p.coinsMinted = stableCoinsToMint;
        p.wethAmountLocked = msg.value;
        (bool successTransfer, ) = dao.addresses('weth').call{value: msg.value}("");
        require(successTransfer, 'Could not pass funds to weth contract for some reason');
        p.owner = msg.sender;
        p.timeOpened = block.timestamp;
        p.lastTimeUpdated = block.timestamp;
        p.interestAmountRecorded = 0;
        p.interestRate = dao.params('interestRate');

        coin.mint(msg.sender, stableCoinsToMint);

        emit PositionOpened(p.owner, posID);

        return posID;
    }

    function interestAmountUnrecorded(uint256 posID) public view returns (uint256 interestAmount) {
        Position storage p = positions[posID];
        return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 31536000 / 100;
    }

    function totalCurrentFee(uint256 posID) public view returns (uint256 fee){
        return positions[posID].interestAmountRecorded + interestAmountUnrecorded(posID);
    }

    function getMaxStableCoinsToMint(uint256 ethValue) public view returns (uint256 amount) {
        uint256 price = oracleCart.getPrice('stb');
        uint256 decimals = oracleCart.getDecimals('etc');
        return ethValue * price * (100 - dao.params('collateralDiscount'))/(10**decimals)/100;
    }

    function getMaxStableCoinsToMintForPos(uint256 posID) public view returns (uint256 maxAmount){
        return getMaxStableCoinsToMint(positions[posID].wethAmountLocked) - totalCurrentFee(posID);
    }

    function claimInterest(uint256 amount, address beneficiary) external{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        if (coin.balanceOf(address(this))>amount)
            coin.transfer(beneficiary, amount);
        else {
            uint256 difference = amount - coin.balanceOf(address(this));
            coin.transfer(beneficiary, coin.balanceOf(address(this)));
            coin.approve(beneficiary, difference+coin.allowance(address(this), beneficiary));
        }
    }

    function claimEmission(uint256 amount, address beneficiary) external{
        require(dao.authorized(msg.sender), "only authorized address may do this");
        coin.mint(beneficiary,amount);
    }

    function closeCDP(uint256 posID) external{
        Position storage p = positions[posID];
        require(p.owner == msg.sender, "Only owner may close his position");
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

    function transferInterest(uint256 posID) external{
        Position storage p = positions[posID];
        if (p.restrictInterestWithdrawal)
            require(p.owner == msg.sender, "Only owner may transfer interest");
        require(!p.onLiquidation, "This position is on liquidation");
        require(coin.transferFrom(p.owner, address(this), totalCurrentFee(posID)), 'Was not able to transfer fee. Insufficient balance or allowance. Try to allow spending first');
        p.interestAmountRecorded = 0;
        p.lastTimeUpdated = block.timestamp;
    }

    function switchRestrictInterestWithdrawal(uint256 posID) external {
        Position storage p = positions[posID];
        require (p.owner == msg.sender, "Only owner may set this property");
        p.restrictInterestWithdrawal = !p.restrictInterestWithdrawal;
    }

    function allowSurplusToAuction() external{
        uint256 stabilizationFundAmount = dao.params('stabilizationFundPercent')*coin.totalSupply()/100;
        require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
        uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
        require (surplus >= dao.params('minCDPBalanceToInitBuyOut'), "not enough surplus to start buyOut");
        require (coin.approve(dao.addresses('auction'), surplus), "could not approve coins for some reason");
    }

    function claimMarginCall(uint256 posID) external returns (bool success) {
        Position storage p = positions[posID];
            require (p.markedOnLiquidationTimestamp >0 && block.timestamp - p.markedOnLiquidationTimestamp > dao.params('marginCallTimeLimit'), "Position is not marked on liquidation or owner still has time");
        require(!p.onLiquidation && !p.liquidated, "Position is already on liquidation or already liquidated");
        if (getMaxStableCoinsToMintForPos(posID) < p.coinsMinted) {
            p.onLiquidation = true;
            uint256 currentAllowance = weth.allowance(dao.addresses('cdp'), dao.addresses('auction'));
            require(weth.approve(dao.addresses('auction'), currentAllowance+p.wethAmountLocked), "could not approve weth for some reason");
            emit OnLiquidation(posID, block.timestamp);
            return true;
        }
        else {
            p.markedOnLiquidationTimestamp = 0;
            return false;
        }
    }

    function startCoinsBuyOut(uint256 posID) external{
        Position storage p = positions[posID];
        require (p.onLiquidation && !p.liquidated && p.liquidationAuctionID == 0, "Position is not on liquidation or already liquidated, or auction was already started");
        p.liquidationAuctionID = auction.initCoinsBuyOut(posID, p.wethAmountLocked);
        p.wethAmountLocked = 0;
    }

    function finishMarginCall(uint256 posID) external {
        Position storage p = positions[posID];
        require(p.onLiquidation && !p.liquidated && p.liquidationAuctionID !=0, "Position is not on liquidation or was already liquidated or auction was not started");
        if (!auction.isFinalized(p.liquidationAuctionID))
            require(auction.claimToFinalizeAuction(p.liquidationAuctionID), "could not finalize auction");

        uint256 paymentAmount = auction.getPaymentAmount(p.liquidationAuctionID);

        if (paymentAmount >=p.coinsMinted){
            uint256 overallDebt = p.coinsMinted + totalCurrentFee(posID) + p.coinsMinted * dao.params('liquidationFee') / 100;
            if (paymentAmount > overallDebt)
                coin.transfer(p.owner, paymentAmount - overallDebt);
            coin.burn(address(this), p.coinsMinted);
            p.liquidated = true;
            return;
        }
        else {
            if (coin.balanceOf(address(this)) >= p.coinsMinted){
                coin.burn(address(this), p.coinsMinted);
                p.liquidated = true;
                return;
            }
            else {
                uint256 toBurn = coin.balanceOf(address(this));
                coin.burn(address(this), toBurn);
                p.coinsMinted -= toBurn;
                auction.initCoinsBuyOutForStabilization(p.coinsMinted);
            }
        }
    }

    function markToLiquidate(uint256 posID) external {
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp == 0 && !p.onLiquidation, "This position is on liquidation or already marked");
        if (getMaxStableCoinsToMintForPos(posID) < p.coinsMinted) {
            p.markedOnLiquidationTimestamp = block.timestamp;
            emit markedOnLiquidation (posID, block.timestamp);
        }
    }

    function eraseMarkToLiquidate(uint posID) external{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp >0 && !p.onLiquidation && !p.liquidated, "This position is not marked or locked/liquidated");
        if (getMaxStableCoinsToMintForPos(posID) > p.coinsMinted) {
            p.markedOnLiquidationTimestamp = 0;
            emit markOnLiquidationErased (posID, block.timestamp);
        }
    }

    function updateCDP(uint posID, uint newStableCoinsAmount) external payable returns (bool success){
        Position storage p = positions[posID];
        require(!p.onLiquidation, "This position is on liquidation");
        require(p.owner == msg.sender, "Only owner may update the position");
        require (newStableCoinsAmount >= dao.params('minCoinsToMint')*10**coin.decimals(), "you can not mint less than 1 coin");

        p.interestAmountRecorded += interestAmountUnrecorded(posID);
        p.lastTimeUpdated = block.timestamp;

        if (msg.value>0) {
            p.wethAmountLocked += msg.value;
            (bool successTransfer, ) = dao.addresses('weth').call{value: msg.value}("");
            require(successTransfer, 'Could not pass funds to weth contract for some reason');
        }

        require(getMaxStableCoinsToMintForPos(posID) >= newStableCoinsAmount, 'not enough collateral to mint amount');

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

    function withdrawEther (uint256 posID, uint256 etherToWithdraw) external{
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

    function burnRule() external{
        rule.burn(address(this), rule.balanceOf(address(this)));
    }

    function mintRule(address to, uint256 amount) external returns (bool success){
        require (msg.sender == dao.addresses('auction'), "Only auction is allowed to claim mint");
        rule.mint(to, amount);
        return true;
    }

    receive() external payable {}

    function withdraw() external {
        dao.addresses('oracle').transfer(address(this).balance);
    }
}
