// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IDAO.sol";

interface IERC20MintableAndBurnable is IERC20{
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/// @notice Auction interface
interface IAuction{
    function initCoinsBuyOut(uint128 collateral) external returns (uint32 auctionID);
    function isFinalized(uint32 auctionID) external view returns (bool finalized);
    function claimToFinalizeAuction(uint32 auctionID) external returns (bool success);
    function getPaymentAmount(uint32 auctionID) external view returns (uint256);
    function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) external returns (uint256 auctionID);
}

/// @notice Cart interface
interface IBasket {
    function getPrice(string memory symbol) external view returns (uint256);
    function getEthereumVSCommoditiesPriceChange() external view returns(uint256);
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

/// @title Collateral debt position contract
contract CDP is ReentrancyGuard{

    /// @notice Positions counter
    uint32 public numPositions;

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice Cart interface
    IBasket basket;

    /// @notice Stablecoin interface
    IERC20MintableAndBurnable coin;

    /// @notice Auction interface
    IAuction auction;

    /// @notice Governance tokens interface
    IERC20MintableAndBurnable rule;

    /// @notice Wrapped ether interface
    IERC20 weth;

    /// @notice Struct to store all the positions
    mapping(uint32 => Position) public positions;

    /// @notice This event is emitted when the new position is opened.
    /// @param owner Address of the owner of the position.
    /// @param posID ID of the position.
    event PositionOpened (address indexed owner, uint256 indexed posID);

    /// @notice This event is emitted when the new position is updated.
    /// @param posID ID of the position.
    /// @param newStableCoinsAmount New amount of stablecoins borrowed.
    /// @param wethLocked Current collateral amount.
    event PositionUpdated (uint32 indexed posID, uint256 newStableCoinsAmount, uint256 wethLocked);

    /// @notice This event is emitted when the position liquidationStatus is updated.
    /// @param posID ID of the position.
    /// @param liquidationStatus Current status.
    event liquidationStatusChanged (uint32 indexed posID, uint24 liquidationStatus);

    /// @notice This event is emitted when the position set on liquidation.
    /// @param auctionID ID of the corresponding auction.
    /// @param posID ID of the position.
    /// @param collateral Amount the collateral to sell.
    event liquidateCollateral(uint32 indexed auctionID, uint32 indexed posID, uint256 collateral);

    /// @notice Constructor for CDP contract.
    /// @param _INTDAOaddress - the address of main DAO contract.
    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice This method is used to reinit needed interfaces when the addresses of contracts to use are changed by voting or to init interfaces just after deploy.
    function renewContracts() external{
        coin = IERC20MintableAndBurnable(dao.addresses("stableCoin"));
        rule = IERC20MintableAndBurnable(dao.addresses("rule"));
        basket = IBasket(dao.addresses("basket"));
        auction = IAuction(dao.addresses("auction"));
        weth = IERC20(dao.addresses("weth"));
    }

    /// @notice Use this method to borrow stablecoins. To use it, you have to provide sufficient collateral in ether.
    /// Be aware, that collateral is converted to weth (wrapped ether) and stored as a wrapped ether token on the contract address.
    /// The new minted stablecoins will be passed to the caller account.
    /// @param stableCoinsToMint The number of stablecoins to mint
    /// @return The ID of you collateral debt position is returned.
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

    /// @notice Yet not stored interest, of the debt position. It depends on the debt, the rate and time since the last position update.
    /// @param posID ID of the position.
    /// @return interestAmount The amount of not stored interest.
    function interestAmountUnrecorded(uint32 posID) public view returns (uint256 interestAmount) {
        Position storage p = positions[posID];
        return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 365 days / 100;
    }

    /// @notice Shows overall interest of the debt position (stored and not stored).
    /// @param posID ID of the position.
    /// @return fee The amount of overall interest to pay.
    function totalCurrentFee(uint32 posID) public view returns (uint256 fee){
        return positions[posID].interestAmountRecorded + interestAmountUnrecorded(posID);
    }

    /// @notice Shows how many coins can be minted with a certain ether collateral according to the current prices and collateral discount.
    /// @param ethValue Amount of collateral.
    /// @return amount The maximum amount of stablecoins one can mint by providing a certain collateral.
    function getMaxStableCoinsToMint(uint256 ethValue) public view returns (uint256 amount) {
        uint256 price = basket.getEthereumVSCommoditiesPriceChange();
        uint256 decimals = basket.getDecimals("eth");
        return ethValue * price * (100 - dao.params("collateralDiscount"))/(10**decimals)/100;
    }

    /// @notice Shows how many coins can be minted for a certain position as amount of collateral or its price changed. It takes in consideration the amount of accumulated fee for the debt.
    /// @param posID ID of the position.
    /// @return maxAmount The maximum amount of stablecoins one can mint in this position.
    function getMaxStableCoinsToMintForPos(uint32 posID) public view returns (uint256 maxAmount){
        return getMaxStableCoinsToMint(positions[posID].wethAmountLocked) - totalCurrentFee(posID);
    }

    /// @notice This method is for authorized contract by DAO only. For example Deposit contract may claim interest for deposit owner and they will be transferred form stabilization fund.
    /// If there is not enough funds, all available are transferred and allowance is given for the rest of the sum for future spending.
    /// @param amount The amount of interest to transfer.
    /// @param beneficiary Address of the beneficiary.
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

    /// @notice This method is for authorized contract by DAO only. For example, some new contract may claim emission according to its terms.
    /// @param amount The amount stablecoins to mint.
    /// @param beneficiary Address of the beneficiary.
    function claimEmission(uint256 amount, address beneficiary) nonReentrant external{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        coin.mint(beneficiary,amount);
    }

    /// @notice This method is used to return collateral to the owner if he returns the overall debt and interest. It is for the owner of the position only.
    /// @param posID ID of the position.
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

    /// @notice This method is used to pay the interest on the position if restrictInterestWithdrawal is not set by the owner. The earned interest is transferred to the CDP contract.
    /// @param posID ID of the position.
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

    /// @notice This method is used to allow or disallow paying interest for position by the owner only. By default, is set false, which means that any user can force the owner of the position to pay the current interest for his debt anytime on call.
    /// @param posID ID of the position.
    function switchRestrictInterestWithdrawal(uint32 posID) external{
        Position storage p = positions[posID];
        require (p.owner == msg.sender, "Only owner may set this property");
            p.restrictInterestWithdrawal = !p.restrictInterestWithdrawal;
    }

    /// @notice If stabilization fund exceed a certain percent (stabilizationFundPercent DAO param) of total dotflat stablecoins emission, anyone can allow spending to Auction contract for further governance tokens buy out init.
    function allowSurplusToAuction() nonReentrant external{
        uint256 stabilizationFundAmount = dao.params("stabilizationFundPercent")*coin.totalSupply()/100;
        require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
        uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
        require (surplus >= dao.params("minCDPBalanceToInitBuyOut"), "not enough surplus to start buyOut");
        require (coin.approve(dao.addresses("auction"), surplus), "could not approve coins for some reason");
    }

    /// @notice If debt position is lack of collateral and is marked for liquidation, anyone may claim margin call for it and sell collateral through the auction.
    /// @param posID ID of the position.
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

    /// @notice If the auction for margin call finished, the contract may proceed the rest of the actions.
    /// @param posID ID of the position.
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

    /// @notice If debt position is lack of collateral, anyone may point this out by marking it on liquidation.
    /// @param posID ID of the position.
    function markToLiquidate(uint32 posID) external{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp == 0 && p.liquidationStatus == 0, "wrong liquidationStatus");
        require(getMaxStableCoinsToMintForPos(posID) < p.coinsMinted, "collateral is enough");
        p.markedOnLiquidationTimestamp = uint32(block.timestamp);
        changeStatus(posID, 1);
    }

    /// @notice If debt position has enough collateral but was earlier marked on liquidation, anyone may erase this mark.
    /// @param posID ID of the position.
    function eraseMarkToLiquidate(uint32 posID) public{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp >0 && p.liquidationStatus == 1, "This position is not marked or on liquidation/liquidated");
        require(getMaxStableCoinsToMintForPos(posID) > p.coinsMinted);
        p.markedOnLiquidationTimestamp = 0;
        changeStatus(posID, 0);
    }

    /// @notice Change the amount of minted stablecoins or top up the amount of collateral. To withdraw collateral use withdrawEther function.
    /// @param posID ID of the position.
    /// @param newStableCoinsAmount ID of the position.
    /// @return success If succeed.
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

    /// @notice Withdraw ether from position if it exceeds the minimum collateral value due to ether price change, for example.
    /// @param posID ID of the position.
    /// @param etherToWithdraw Amount of ether to withdraw.
    function withdrawEther(uint32 posID, uint128 etherToWithdraw) nonReentrant external{
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

    /// @notice Anyone can burn (eliminate) all Rule tokens, placed on the CDP contract's address. If not accidentally,
    /// Rules can be on the balance of the contract only after Rule buy out auction.
    function burnRule() external{
        rule.burn(address(this), rule.balanceOf(address(this)));
    }

    /// @notice If stabilization fund has not enough funds, one may init the auction to top it up with dotflat stablecoins.
    /// The winner of that auction receives his reward in Rule tokens, minted by CDP contract.
    function mintRule(address to, uint256 amount) external returns (bool success){
        require (msg.sender == dao.addresses("auction"), "Only auction is allowed to claim mint");
        rule.mint(to, amount);
        return true;
    }
}

