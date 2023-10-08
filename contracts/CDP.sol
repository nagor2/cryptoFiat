// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IDAO.sol";

interface IERC20MintableAndBurnable is IERC20{
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

interface IAuction{
    function initCoinsBuyOut(uint128 collateral) external returns (uint32 auctionID);
    function isFinalized(uint32 auctionID) external view returns (bool finalized);
    function claimToFinalizeAuction(uint32 auctionID) external returns (bool success);
    function getPaymentAmount(uint32 auctionID) external view returns (uint256);
    function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) external returns (uint256 auctionID);
}

interface ICart{
    function getPrice(string memory symbol) external view returns (uint256);
    function getDecimals(string memory symbol) external view returns (uint8);
}

    struct Position {
        uint128 coinsMinted;
        uint128 wethAmountLocked;
        uint128 interestAmountRecorded;
        uint32 timeOpened;
        uint32 lastTimeUpdated;
        uint24 interestRate;
        uint32 markedOnLiquidationTimestamp;
        uint24 liquidationStatus; //0 - ok, 1- markedOnLiquidation, 2 - onLiquidation, 3 - liquidated, 4 - closed;
        uint32 liquidationAuctionID;
        bool restrictInterestWithdrawal;
        address owner;
    }

contract CDP is ReentrancyGuard{
    uint32 public numPositions;
    IDAO immutable dao;
    ICart oracleCart;
    IERC20MintableAndBurnable coin;
    IAuction auction;
    IERC20MintableAndBurnable rule;
    IERC20 weth;

    mapping(uint32 => Position) public positions;
    event PositionOpened (address indexed owner, uint256 indexed posID);
    event PositionUpdated (uint32 indexed posID, uint256 newStableCoinsAmount, uint256 wethLocked);
    event liquidationStatusChanged (uint32 indexed posID, uint24 liquidationStatus);
    event liquidateCollateral(uint32 indexed auctionID, uint32 indexed posID, uint256 collateral);

    constructor(address INTDAOaddress){
        dao = IDAO(INTDAOaddress);
    }

    function renewContracts() external{
        coin = IERC20MintableAndBurnable(dao.addresses("stableCoin"));
        rule = IERC20MintableAndBurnable(dao.addresses("rule"));
        oracleCart = ICart(dao.addresses("cart"));
        auction = IAuction(dao.addresses("auction"));
        weth = IERC20(dao.addresses("weth"));
    }

    function openCDP(uint256 stableCoinsToMint) nonReentrant external payable returns (uint256){
        stableCoinsToMint = (stableCoinsToMint > getMaxStableCoinsToMint(msg.value))
            ?getMaxStableCoinsToMint(msg.value)
            :stableCoinsToMint;

        require (stableCoinsToMint >= dao.params("minCoinsToMint")*10**18, "you can not mint less than 1 coin");

        Position storage p = positions[numPositions];

        p.coinsMinted = uint128(stableCoinsToMint);
        p.wethAmountLocked = uint128(msg.value);
        (bool successTransfer, ) = dao.addresses("weth").call{value: msg.value}("");
        require(successTransfer, "Could not pass funds to weth contract for some reason");
        p.owner = msg.sender;
        p.timeOpened = uint32(block.timestamp);
        p.lastTimeUpdated = uint32(block.timestamp);
        p.interestRate = uint24(dao.params("interestRate"));
        coin.mint(msg.sender, stableCoinsToMint);

        emit PositionOpened(p.owner, numPositions);
        return numPositions++;
    }

    function interestAmountUnrecorded(uint32 posID) public view returns (uint256 interestAmount) {
        Position storage p = positions[posID];
        return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 365 days / 100;
    }

    function totalCurrentFee(uint32 posID) public view returns (uint256 fee){
        return positions[posID].interestAmountRecorded + interestAmountUnrecorded(posID);
    }

    function getMaxStableCoinsToMint(uint256 ethValue) public view returns (uint256 amount) {
        uint256 price = oracleCart.getPrice("stb");
        uint256 decimals = oracleCart.getDecimals("etc");
        return ethValue * price * (100 - dao.params("collateralDiscount"))/(10**decimals)/100;
    }

    function getMaxStableCoinsToMintForPos(uint32 posID) public view returns (uint256 maxAmount){
        return getMaxStableCoinsToMint(positions[posID].wethAmountLocked) - totalCurrentFee(posID);
    }

    function claimInterest(uint256 amount, address beneficiary) nonReentrant external{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        if (coin.balanceOf(address(this))>amount)
            coin.transfer(beneficiary, amount);
        else {
            uint256 difference = amount - coin.balanceOf(address(this));
            coin.transfer(beneficiary, coin.balanceOf(address(this)));
            coin.approve(beneficiary, difference+coin.allowance(address(this), beneficiary));
        }
    }

    function claimEmission(uint256 amount, address beneficiary) nonReentrant external{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        coin.mint(beneficiary,amount);
    }

    function closeCDP(uint32 posID) nonReentrant external{
        Position storage p = positions[posID];
        require(p.owner == msg.sender, "Only owner may close his position");
        require(p.liquidationStatus < 2, "This position is on liquidation or already liquidated/closed");
        uint256 overallDebt = totalCurrentFee(posID)+p.coinsMinted;
        require(coin.transferFrom(p.owner, address(this), overallDebt), "Could not transfer coins for some reason. You have to allow coins first");
        require (weth.transfer(p.owner, p.wethAmountLocked), "Could not transfer collateral for some reason");
        coin.burn(address(this), p.coinsMinted);
        changeStatus(posID, 4);
    }

    function transferInterest(uint32 posID) nonReentrant external{
        Position storage p = positions[posID];
        if (p.restrictInterestWithdrawal){
            require(p.owner == msg.sender, "Only owner may transfer interest");
        }
        require(p.liquidationStatus < 2, "This position is on liquidation or liquidated");
        require(coin.transferFrom(p.owner, address(this), totalCurrentFee(posID)), "Was not able to transfer fee. Insufficient balance or allowance. Try to allow spending first");
        p.interestAmountRecorded = 0;
        p.lastTimeUpdated = uint32(block.timestamp);
    }

    function switchRestrictInterestWithdrawal(uint32 posID) external{
        Position storage p = positions[posID];
        require (p.owner == msg.sender, "Only owner may set this property");
            p.restrictInterestWithdrawal = !p.restrictInterestWithdrawal;
    }

    function allowSurplusToAuction() nonReentrant external{
        uint256 stabilizationFundAmount = dao.params("stabilizationFundPercent")*coin.totalSupply()/100;
        require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
        uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
        require (surplus >= dao.params("minCDPBalanceToInitBuyOut"), "not enough surplus to start buyOut");
        require (coin.approve(dao.addresses("auction"), surplus), "could not approve coins for some reason");
    }

    function claimMarginCall(uint32 posID) nonReentrant external{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp >0 && block.timestamp - p.markedOnLiquidationTimestamp >= dao.params("marginCallTimeLimit"), "Position is not marked on liquidation or owner still has time");
        require(p.liquidationStatus == 1, "Wrong liquidation status");
        require(getMaxStableCoinsToMintForPos(posID) < p.coinsMinted, "Collateral is enough, should erase mark");
        changeStatus(posID, 2);
        require(weth.transfer(dao.addresses("auction"), p.wethAmountLocked), "could not transfer weth for some reason");
        p.liquidationAuctionID = auction.initCoinsBuyOut(p.wethAmountLocked);
        emit liquidateCollateral(p.liquidationAuctionID, posID, p.wethAmountLocked);
        p.wethAmountLocked = 0;
    }

    function finishMarginCall(uint32 posID) nonReentrant external{
        Position storage p = positions[posID];
        require(p.liquidationStatus == 2 && p.liquidationAuctionID !=0, "Position is not on liquidation or was already liquidated or auction was already started");
        if (!auction.isFinalized(p.liquidationAuctionID))
            require(auction.claimToFinalizeAuction(p.liquidationAuctionID), "could not finalize auction");

        uint256 paymentAmount = auction.getPaymentAmount(p.liquidationAuctionID);

        if (paymentAmount >=p.coinsMinted){
            uint256 overallDebt = p.coinsMinted + totalCurrentFee(posID) + p.coinsMinted * dao.params("liquidationFee") / 100;
            if (paymentAmount > overallDebt)
                coin.transfer(p.owner, paymentAmount - overallDebt);
            coin.burn(address(this), p.coinsMinted);
            changeStatus(posID, 3);
            return;
        }
        else {
            uint256 balance = coin.balanceOf(address(this));
            if (balance >= p.coinsMinted){
                coin.burn(address(this), p.coinsMinted);
                changeStatus(posID, 3);
                return;
            }
            else {
                coin.burn(address(this), balance);
                p.coinsMinted -= uint128(balance);
                auction.initCoinsBuyOutForStabilization(p.coinsMinted);
            }
        }
    }

    function changeStatus(uint32 posID, uint24 currentStatus) internal{
        Position storage p = positions[posID];
        p.liquidationStatus = currentStatus;
        p.lastTimeUpdated = uint32(block.timestamp);
        emit liquidationStatusChanged(posID, currentStatus);
    }

    function markToLiquidate(uint32 posID) external{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp == 0 && p.liquidationStatus == 0, "wrong liquidationStatus");
        require(getMaxStableCoinsToMintForPos(posID) < p.coinsMinted, "collateral is enough");
        p.markedOnLiquidationTimestamp = uint32(block.timestamp);
        changeStatus(posID, 1);
    }

    function eraseMarkToLiquidate(uint32 posID) public{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp >0 && p.liquidationStatus == 1, "This position is not marked or on liquidation/liquidated");
        require(getMaxStableCoinsToMintForPos(posID) > p.coinsMinted);
        p.markedOnLiquidationTimestamp = 0;
        changeStatus(posID, 0);
    }

    function updateCDP(uint32 posID, uint newStableCoinsAmount) nonReentrant external payable returns (bool success){
        Position storage p = positions[posID];
        require(p.liquidationStatus<2, "Wrong liquidationStatus");
        require(p.owner == msg.sender, "Only owner may update the position");
        require (newStableCoinsAmount >= dao.params("minCoinsToMint"), "you can not mint less than 1 coin");

        p.interestAmountRecorded += uint128(interestAmountUnrecorded(posID));
        p.lastTimeUpdated = uint32(block.timestamp);

        if (msg.value>0) {
            p.wethAmountLocked += uint128(msg.value);
            (bool successTransfer, ) = dao.addresses("weth").call{value: msg.value}("");
            require(successTransfer, "Could not pass funds to weth contract for some reason");
        }

        require(getMaxStableCoinsToMintForPos(posID) >= newStableCoinsAmount, "not enough collateral to mint amount");

        if (newStableCoinsAmount > p.coinsMinted) {
            uint256 difference = newStableCoinsAmount - p.coinsMinted;
            coin.mint(p.owner, difference);
            p.coinsMinted = uint128(newStableCoinsAmount);
        }
        if (newStableCoinsAmount < p.coinsMinted) {
            uint256 difference = p.coinsMinted - newStableCoinsAmount;
            require(coin.balanceOf(p.owner)>=difference);
            coin.burn(p.owner, difference);
            p.coinsMinted = uint128(newStableCoinsAmount);
        }
        emit PositionUpdated(posID, newStableCoinsAmount, p.wethAmountLocked);
        return true;
    }

    function withdrawEther (uint32 posID, uint128 etherToWithdraw) nonReentrant external{
        Position storage p = positions[posID];
        require(p.liquidationStatus == 0, "Wrong liquidationStatus");
        require(p.owner == msg.sender, "Only owner may update the position");
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
        require (msg.sender == dao.addresses("auction"), "Only auction is allowed to claim mint");
        rule.mint(to, amount);
        return true;
    }
}
