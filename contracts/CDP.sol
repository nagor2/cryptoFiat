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
    function initCoinsBuyOut() external payable returns (uint32 auctionID);
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
        uint128 ethAmountLocked;
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

    /// @notice Struct to store all the positions
    mapping(uint32 => Position) public positions;

    /// @notice This event is emitted when a new position is opened.
    /// @param owner Address of the owner of the position.
    /// @param posID ID of the position.
    event PositionOpened (address indexed owner, uint256 indexed posID);

    /// @notice This event is emitted when a position is updated.
    /// @param posID ID of the position.
    /// @param newStableCoinsAmount New amount of stablecoins borrowed.
    /// @param ethLocked Current collateral amount.
    event PositionUpdated (uint32 indexed posID, uint256 newStableCoinsAmount, uint256 ethLocked);

    /// @notice This event is emitted when the position’s liquidation status is updated.
    /// @param posID ID of the position.
    /// @param liquidationStatus Current status.
    event liquidationStatusChanged (uint32 indexed posID, uint24 liquidationStatus);

    /// @notice This event is emitted when a position is set for liquidation.
    /// @param auctionID ID of the corresponding auction.
    /// @param posID ID of the position.
    /// @param collateral Amount of collateral to sell.
    event liquidateCollateral(uint32 indexed auctionID, uint32 indexed posID, uint256 collateral);

    /// @notice Constructor for the CDP contract.
    /// @param _INTDAOaddress Address of the main DAO contract.
    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice This method is used to reinitialize the needed interfaces when the addresses of contracts are changed by voting or to initialize interfaces just after deployment.
    function renewContracts() external{
        coin = IERC20MintableAndBurnable(dao.addresses("stableCoin"));
        rule = IERC20MintableAndBurnable(dao.addresses("rule"));
        basket = IBasket(dao.addresses("basket"));
        auction = IAuction(dao.addresses("auction"));
    }

    /// @notice Use this method to borrow stablecoins. To use it, you must provide sufficient collateral in Ether. The collateral is converted to WETH (wrapped ether) and stored as a wrapped Ether token in the contract address. The newly minted stablecoins will be sent to the caller's account.
    /// @param stableCoinsToMint Number of stablecoins to mint.
    /// @return The ID of your collateral debt position is returned.
    function openCDP(uint256 stableCoinsToMint) nonReentrant external payable returns (uint256){
        stableCoinsToMint = (stableCoinsToMint > getMaxStableCoinsToMint(msg.value))
            ?getMaxStableCoinsToMint(msg.value)
            :stableCoinsToMint;

        require (stableCoinsToMint >= dao.params("minCoinsToMint")*10**18, "you can not mint less than 1 coin");

        Position storage p = positions[numPositions];

        p.coinsMinted = uint128(stableCoinsToMint);
        p.ethAmountLocked = uint128(msg.value);
        p.owner = msg.sender;
        p.timeOpened = uint32(block.timestamp);
        p.lastTimeUpdated = uint32(block.timestamp);
        p.interestRate = uint24(dao.params("interestRate"));
        coin.mint(msg.sender, stableCoinsToMint);

        emit PositionOpened(p.owner, numPositions);
        return numPositions++;
    }

    /// @notice  Interest that has not yet been recorded for the debt position. It depends on the debt, the rate, and the time since the last position update.
    /// @param posID ID of the position.
    /// @return interestAmount The amount of unrecorded interest.
    function interestAmountUnrecorded(uint32 posID) public view returns (uint256 interestAmount) {
        Position storage p = positions[posID];
        return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 365 days / 100;
    }

    /// @notice Shows the overall interest of the debt position (both stored and unrecorded).
    /// @param posID ID of the position.
    /// @return fee The total interest to pay.
    function totalCurrentFee(uint32 posID) public view returns (uint256 fee){
        return positions[posID].interestAmountRecorded + interestAmountUnrecorded(posID);
    }

    /// @notice Shows how many coins can be minted with a given Ether collateral according to the current prices and collateral discount.
    /// @param ethValue Amount of collateral.
    /// @return amount The maximum amount of stablecoins one can mint with a given collateral.
    function getMaxStableCoinsToMint(uint256 ethValue) public view returns (uint256 amount) {
        uint256 price = basket.getEthereumVSCommoditiesPriceChange();
        uint256 decimals = basket.getDecimals("eth");
        return ethValue * price * (100 - dao.params("collateralDiscount"))/(10**decimals)/100;
    }

    /// @notice Shows how many coins can be minted for a specific position considering changes in collateral amount or price. It accounts for the accumulated fee for the debt.
    /// @param posID ID of the position.
    /// @return maxAmount The maximum amount of stablecoins one can mint for this position.
    function getMaxStableCoinsToMintForPos(uint32 posID) public view returns (uint256 maxAmount){
        return getMaxStableCoinsToMint(positions[posID].ethAmountLocked) - totalCurrentFee(posID);
    }

    /// @notice This method is for contracts authorized by the DAO only. For example, a Deposit contract may claim interest for the deposit owner, and the interest will be transferred from the stabilization fund.
    /// If there are not enough funds, all available funds are transferred, and an allowance is given for the remaining amount for future spending.
    /// @param amount Amount of interest to transfer.
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

    /// @notice This method is for authorized contracts by the DAO only. For example, a new contract may claim emission according to its terms.
    /// @param amount Amount of stablecoins to mint.
    /// @param beneficiary Address of the beneficiary.
    function claimEmission(uint256 amount, address beneficiary) nonReentrant external{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        coin.mint(beneficiary,amount);
    }

    /// @notice This method is used to return collateral to the owner if they return the total debt and interest. It is for the position owner only.
    /// @param posID ID of the position.
    function closeCDP(uint32 posID) nonReentrant external{
        Position storage p = positions[posID];
        require(p.owner == msg.sender, "Only owner may close his position");
        require(p.liquidationStatus < 2, "This position is on liquidation or already liquidated/closed");
        uint256 overallDebt = totalCurrentFee(posID)+p.coinsMinted;
        require(coin.transferFrom(p.owner, address(this), overallDebt), "Could not transfer coins for some reason. You have to allow coins first");
        require (payable(p.owner).send(p.ethAmountLocked), "Could not transfer collateral for some reason");
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

    /// @notice This method allows or disallows paying interest for a position by the owner only. By default, it is set to false, meaning that any user can force the owner to pay the current interest for their debt at any time on call.
    /// @param posID ID of the position.
    function switchRestrictInterestWithdrawal(uint32 posID) external{
        Position storage p = positions[posID];
        require (p.owner == msg.sender, "Only owner may set this property");
            p.restrictInterestWithdrawal = !p.restrictInterestWithdrawal;
    }

    /// @notice If the stabilization fund exceeds a certain percentage (stabilizationFundPercent DAO param) of the total Dotflat stablecoin emission, anyone can allow spending to the Auction contract for further governance token buyouts.
    function allowSurplusToAuction() nonReentrant external{
        uint256 stabilizationFundAmount = dao.params("stabilizationFundPercent")*coin.totalSupply()/100;
        require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
        uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
        require (surplus >= dao.params("minCDPBalanceToInitBuyOut"), "not enough surplus to start buyOut");
        require (coin.approve(dao.addresses("auction"), surplus), "could not approve coins for some reason");
    }

    /// @notice If a debt position lacks collateral and is marked for liquidation, anyone may claim a margin call for it and sell the collateral through the auction.
    /// @param posID ID of the position.
    function claimMarginCall(uint32 posID) nonReentrant external{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp >0 && block.timestamp - p.markedOnLiquidationTimestamp >= dao.params("marginCallTimeLimit"), "Position is not marked on liquidation or owner still has time");
        require(p.liquidationStatus == 1, "Wrong liquidation status");
        require(getMaxStableCoinsToMintForPos(posID) < p.coinsMinted, "Collateral is enough, should erase mark");
        changeStatus(posID, 2);
        p.liquidationAuctionID = auction.initCoinsBuyOut{value: p.ethAmountLocked}();
        emit liquidateCollateral(p.liquidationAuctionID, posID, p.ethAmountLocked);
        p.ethAmountLocked = 0;
    }

    /// @notice If the auction for the margin call has finished, the contract may proceed with the remaining actions.
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

    /// @notice If a debt position lacks collateral, anyone may mark it for liquidation.
    /// @param posID ID of the position.
    function markToLiquidate(uint32 posID) external{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp == 0 && p.liquidationStatus == 0, "wrong liquidationStatus");
        require(getMaxStableCoinsToMintForPos(posID) < p.coinsMinted, "collateral is enough");
        p.markedOnLiquidationTimestamp = uint32(block.timestamp);
        changeStatus(posID, 1);
    }

    /// @notice If a debt position has enough collateral but was previously marked for liquidation, anyone may remove this mark.
    /// @param posID ID of the position.
    function eraseMarkToLiquidate(uint32 posID) public{
        Position storage p = positions[posID];
        require (p.markedOnLiquidationTimestamp >0 && p.liquidationStatus == 1, "This position is not marked or on liquidation/liquidated");
        require(getMaxStableCoinsToMintForPos(posID) > p.coinsMinted);
        p.markedOnLiquidationTimestamp = 0;
        changeStatus(posID, 0);
    }

    /// @notice Change the amount of minted stablecoins or increase the amount of collateral. To withdraw collateral, use the withdrawEther function.
    /// @param posID ID of the position.
    /// @param newStableCoinsAmount New amount of stablecoins.
    /// @return success Whether or not the operation succeeded.
    function updateCDP(uint32 posID, uint newStableCoinsAmount) nonReentrant external payable returns (bool success){
        Position storage p = positions[posID];
        require(p.liquidationStatus<2, "Wrong liquidationStatus");
        require(p.owner == msg.sender, "Only owner may update the position");
        require (newStableCoinsAmount >= dao.params("minCoinsToMint"), "you can not mint less than 1 coin");

        p.interestAmountRecorded += uint128(interestAmountUnrecorded(posID));
        p.lastTimeUpdated = uint32(block.timestamp);

        if (msg.value>0) {
            p.ethAmountLocked += uint128(msg.value);
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
        emit PositionUpdated(posID, newStableCoinsAmount, p.ethAmountLocked);
        return true;
    }

    /// @notice Withdraw Ether from a position if it exceeds the minimum collateral value due to Ether price changes, for example.
    /// @param posID ID of the position.
    /// @param etherToWithdraw Amount of ether to withdraw.
    function withdrawEther(uint32 posID, uint128 etherToWithdraw) nonReentrant external{
        Position storage p = positions[posID];
        require(p.liquidationStatus == 0, "Wrong liquidationStatus");
        require(p.owner == msg.sender, "Only owner may update the position");
        require (etherToWithdraw<p.ethAmountLocked, "You dont have enough eth locked on this pos");
        uint256 ethToLeave = p.ethAmountLocked - etherToWithdraw;
        uint256 maxCoins = getMaxStableCoinsToMint(ethToLeave) - totalCurrentFee(posID);
        require (maxCoins>p.coinsMinted, "you want to keep not enough eth to cover emission and current fee");
        p.ethAmountLocked -= etherToWithdraw;
        require(payable(p.owner).send(etherToWithdraw));
        emit PositionUpdated (posID, p.coinsMinted, p.ethAmountLocked);
    }

    /// @notice Anyone can burn (eliminate) all Rule tokens held by the CDP contract. If not done accidentally,
    ///Rule tokens can only be on the contract's balance after a Rule buyout auction.
    function burnRule() external{
        rule.burn(address(this), rule.balanceOf(address(this)));
    }

    /// @notice If the stabilization fund lacks sufficient funds, one may initiate an auction to top it up with dotflat stablecoins.
    /// The auction winner receives their reward in Rule tokens minted by the CDP contract.
    function mintRule(address to, uint256 amount) external returns (bool success){
        require (msg.sender == dao.addresses("auction"), "Only auction is allowed to claim mint");
        rule.mint(to, amount);
        return true;
    }
}

