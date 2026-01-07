// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.10 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IDAO.sol";
import "./ICDP.sol";

struct auctionEntity {
        uint8 auctionType;  // 1 - Rule buyout, 2 -  flatcoins buyout, 3 - collateral liquidation
        bool initialized;
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint256 paymentAmount;
        uint256 initTime;
        uint256 lastTimeUpdated;
        uint32 bestBidID;
        // Commit-Reveal additions
        uint256 commitPhaseEnd;
        uint256 revealPhaseEnd;
        bool inCommitPhase;
        bool inRevealPhase;
    }

struct Bid {
        address owner;
        uint32 auctionID;
        uint256 amount;
        uint256 time;
        bool canceled;
    }
    
struct CommittedBid {
        bytes32 commitHash;
        uint256 deposit;
        uint256 commitTime;
        bool revealed;
        bool refunded;
    }

/// @title A Contract for Different Types of Auctions with Commit-Reveal Pattern
/// @notice This version implements commit-reveal to prevent front-running
contract AuctionCommitReveal is ReentrancyGuard{
    /// @notice contract address
    address public immutable address_this;

    /// @notice Auctions counter
    uint32 public auctionNum;
    /// @notice Bids counter
    uint32 public bidsNum;

    /// @notice flatcoin interface
    IERC20 coin;

    /// @notice DAO contract interface
    IDAO immutable dao;
    /// @notice CDP contract interface
    ICDP cdp;
    /// @notice Governance token interface
    IERC20 rule;
    /// @notice Flag indicating that there is an active auction to top up the stabilization fund.
    bool isCoinsBuyOutForStabilization;
    /// @notice Flag indicating that there is an active auction for governance token buyout.
    bool ruleBuyOut;
    /// @notice Mapping storing all existing auctions.
    mapping(uint32 => auctionEntity) public auctions;
    /// @notice Mapping storing all existing bids.
    mapping (uint32 => Bid) public bids;
    /// @notice Mapping storing committed bids: auctionID => bidder => CommittedBid
    mapping (uint32 => mapping(address => CommittedBid)) public committedBids;

    /// @notice Minimum deposit required for commit (to prevent spam)
    uint256 public constant MIN_COMMIT_DEPOSIT = 0.001 ether;
    
    /// @notice This event is emitted when a new auction is created.
    event newAuction(uint8 auctionType, uint32 indexed auctionID, uint256 lotAmount, address lotAddress, uint256 paymentAmount, uint256 commitPhaseEnd, uint256 revealPhaseEnd);

    /// @notice This event is emitted when an auction finishes.
    event auctionFinished(uint32 indexed auctionID, uint256 lotAmount, uint32 bestBidID);

    /// @notice This event is emitted when a bid is committed (hidden)
    event bidCommitted(uint32 indexed auctionID, address indexed bidder, bytes32 commitHash);
    
    /// @notice This event is emitted when a bid is revealed
    event bidRevealed(uint32 indexed auctionID, address indexed bidder, uint32 indexed bidID, uint256 bidAmount);

    /// @notice This event is emitted when a bid is canceled.
    event bidCanceled(uint256 indexed bidID);
    
    /// @notice This event is emitted when a commit deposit is refunded
    event commitDepositRefunded(uint32 indexed auctionID, address indexed bidder, uint256 amount);

    /// @notice Constructor for the auction contract.
    /// @param _INTDAOaddress The address of the main DAO contract.
    constructor(address _INTDAOaddress) payable{
        dao = IDAO(_INTDAOaddress);
        address_this = address(this);
    }

    /// @notice Reinitialize the needed interfaces when the addresses of contracts are changed by voting or initialize interfaces after deployment.
    function renewContracts() external{
        cdp = ICDP(dao.addresses("cdp"));
        coin = IERC20(dao.addresses("flatCoin"));
        rule = IERC20(dao.addresses("rule"));
    }

    /// @notice Initiates an auction for Rule buyout when the stabilization fund on the CDP contract exceeds its limit.
    /// @return auctionID New auction ID.
    function initRuleBuyOut() nonReentrant external returns (uint32 auctionID){
        require (!ruleBuyOut, "Rule buyOut exists");
        require ((rule.balanceOf(msg.sender)>=rule.totalSupply()/100*dao.params("minRuleTokensToInitVotingPercent")), "not enough rule");

        uint256 allowed = coin.allowance(dao.addresses("cdp"), address_this);
        require (allowed>0, "nothing allowed");

        require (coin.transferFrom(dao.addresses("cdp"), address_this, allowed), "transfer failed");

        auctionID = createNewAuction(1, allowed, 0);
        ruleBuyOut = true;
    }

    /// @notice Initiates a flatcoin buyout for the stabilization fund if it is low.
    /// @param coinsAmountNeeded The amount of flatcoins needed.
    /// @return auctionID New auction ID.
    function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) nonReentrant external returns (uint32 auctionID){
        require (!isCoinsBuyOutForStabilization, "already exists");
        uint256 actualStabilizationFund = coin.balanceOf(address(cdp));
        uint256 preferableStabilizationFund = coin.totalSupply() * dao.params("stabilizationFundPercent")/100;
        require (actualStabilizationFund<preferableStabilizationFund, "low to init emission");

        if (coinsAmountNeeded > preferableStabilizationFund - actualStabilizationFund)
            coinsAmountNeeded = preferableStabilizationFund - actualStabilizationFund;
        if (coinsAmountNeeded>=dao.params("maxCoinsForStabilization"))
            coinsAmountNeeded = dao.params("maxCoinsForStabilization");

        auctionID = createNewAuction(2, 0, coinsAmountNeeded);
        isCoinsBuyOutForStabilization = true;
    }

    /// @notice Initiates an auction if a margin call occurs and the system needs to sell the collateral.
    /// @return auctionID New auction ID.
    function initCoinsBuyOut() nonReentrant payable external returns (uint32 auctionID){
        require (msg.sender == dao.addresses("cdp"), "for CDP only");
        auctionID = createNewAuction(3, msg.value, 0);
    }

    function createNewAuction(uint8 auctionType, uint256 lotAmount, uint256 paymentAmount) internal returns (uint32 auctionID){
        auctionID = ++auctionNum;
        auctionEntity storage a = auctions[auctionID];

        if (auctionType == 1) {
            a.lotToken = dao.addresses("flatCoin");
            a.paymentToken = dao.addresses("rule");
        }
        if (auctionType == 2) {
            a.lotToken = dao.addresses("rule");
            a.paymentToken = dao.addresses("flatCoin");
        }
        if (auctionType == 3) {
            a.lotToken = address(0);
            a.paymentToken = dao.addresses("flatCoin");
        }

        a.auctionType = auctionType;
        a.initialized = true;
        a.finalized = false;
        a.lotAmount = lotAmount;
        a.paymentAmount = paymentAmount;
        a.initTime = block.timestamp;
        a.lastTimeUpdated = block.timestamp;
        a.bestBidID = 0;
        
        // Set commit-reveal phases
        uint256 commitDuration = dao.params("auctionCommitDuration"); // e.g., 15 minutes
        uint256 revealDuration = dao.params("auctionRevealDuration"); // e.g., 15 minutes
        
        a.commitPhaseEnd = block.timestamp + commitDuration;
        a.revealPhaseEnd = a.commitPhaseEnd + revealDuration;
        a.inCommitPhase = true;
        a.inRevealPhase = false;

        emit newAuction(auctionType, auctionID, lotAmount, a.lotToken, paymentAmount, a.commitPhaseEnd, a.revealPhaseEnd);
    }

    /// @notice Commit a bid (hidden) during commit phase
    /// @param auctionID The ID of the auction to participate in
    /// @param commitHash Hash of (bidAmount, salt, bidder address)
    function commitBid(uint32 auctionID, bytes32 commitHash) nonReentrant external payable {
        auctionEntity storage a = auctions[auctionID];
        require(a.initialized && !a.finalized, "wrong ID");
        require(a.inCommitPhase, "not in commit phase");
        require(block.timestamp < a.commitPhaseEnd, "commit phase ended");
        require(msg.value >= MIN_COMMIT_DEPOSIT, "insufficient deposit");
        require(committedBids[auctionID][msg.sender].commitHash == bytes32(0), "already committed");
        
        committedBids[auctionID][msg.sender] = CommittedBid({
            commitHash: commitHash,
            deposit: msg.value,
            commitTime: block.timestamp,
            revealed: false,
            refunded: false
        });
        
        emit bidCommitted(auctionID, msg.sender, commitHash);
    }
    
    /// @notice Reveal a committed bid during reveal phase
    /// @param auctionID The ID of the auction
    /// @param bidAmount The actual bid amount
    /// @param salt The secret salt used in commit
    function revealBid(uint32 auctionID, uint256 bidAmount, bytes32 salt) nonReentrant external {
        auctionEntity storage a = auctions[auctionID];
        require(a.initialized && !a.finalized, "wrong ID");
        
        // Transition to reveal phase if commit phase ended
        if (block.timestamp >= a.commitPhaseEnd && a.inCommitPhase) {
            a.inCommitPhase = false;
            a.inRevealPhase = true;
        }
        
        require(a.inRevealPhase, "not in reveal phase");
        require(block.timestamp < a.revealPhaseEnd, "reveal phase ended");
        
        CommittedBid storage commit = committedBids[auctionID][msg.sender];
        require(commit.commitHash != bytes32(0), "no commit found");
        require(!commit.revealed, "already revealed");
        
        // Verify commitment
        bytes32 computedHash = keccak256(abi.encodePacked(bidAmount, salt, msg.sender));
        require(computedHash == commit.commitHash, "invalid reveal");
        
        // Validate bid amount based on auction type and current best bid
        if (a.bestBidID != 0) {
            Bid storage bestBid = bids[a.bestBidID];
            if (a.auctionType == 2)
                require(bidAmount > 0 && bestBid.amount*(100-dao.params("minAuctionPriceMove"))/100>=bidAmount, "not low enough");
            else
                require(bidAmount > 0 && bestBid.amount*(100+dao.params("minAuctionPriceMove"))/100<=bidAmount, "not high enough");
        }
        require(bidAmount > 0, "not enough");
        
        // Transfer payment tokens
        IERC20 paymentToken = IERC20(address(a.paymentToken));
        if (a.auctionType == 2){
            require(bidAmount<=rule.totalSupply()*dao.params("maxRuleEmissionPercent")/100, "too many rules");
            require(paymentToken.transferFrom(msg.sender, address_this, a.paymentAmount), "approve first");
        }
        else
            require(paymentToken.transferFrom(msg.sender, address_this, bidAmount), "approve first");

        // Create the actual bid
        uint32 bidID = ++bidsNum;
        Bid storage b = bids[bidID];
        b.owner = msg.sender;
        b.auctionID = auctionID;
        b.amount = bidAmount;
        b.time = commit.commitTime; // Use commit time for fairness
        b.canceled = false;

        // Update best bid
        a.bestBidID = bidID;
        a.lastTimeUpdated = block.timestamp;
        
        // Mark as revealed
        commit.revealed = true;
        
        emit bidRevealed(auctionID, msg.sender, bidID, bidAmount);
    }
    
    /// @notice Refund commit deposit after revealing or if auction ends
    /// @param auctionID The ID of the auction
    function refundCommitDeposit(uint32 auctionID) nonReentrant external {
        auctionEntity storage a = auctions[auctionID];
        CommittedBid storage commit = committedBids[auctionID][msg.sender];
        
        require(commit.commitHash != bytes32(0), "no commit found");
        require(!commit.refunded, "already refunded");
        
        // Can refund if:
        // 1. Revealed successfully (deposit returned)
        // 2. Auction finalized and didn't reveal (penalty - no refund)
        // 3. Reveal phase ended and revealed (deposit returned)
        
        if (commit.revealed || block.timestamp >= a.revealPhaseEnd) {
            if (commit.revealed) {
                // Full refund for revealed bids
                commit.refunded = true;
                payable(msg.sender).transfer(commit.deposit);
                emit commitDepositRefunded(auctionID, msg.sender, commit.deposit);
            } else {
                // Penalty: No refund for unrevealed bids
                commit.refunded = true;
                // Deposit goes to contract (could be sent to DAO or burned)
                emit commitDepositRefunded(auctionID, msg.sender, 0);
            }
        } else {
            revert("cannot refund yet");
        }
    }

    /// @notice Cancel your own bid (after reveal, same as before)
    /// @param bidID The ID of your bid.
    function cancelBid(uint32 bidID) nonReentrant external{
        Bid storage b = bids[bidID];
        require (b.owner==msg.sender && !b.canceled, "not owner");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "wrong auction");
        require(a.bestBidID != bidID, "cancel failed - best bid");
        IERC20 paymentToken = IERC20(address(a.paymentToken));
        if (a.auctionType == 2)
            require(paymentToken.transfer(b.owner, a.paymentAmount), "transfer failed");
        else
            require(paymentToken.transfer(b.owner, b.amount), "transfer failed");
        emit bidCanceled(bidID);
        b.canceled = true;
    }

    /// @notice Finalize auction after reveal phase ends
    /// @param auctionID The ID of the auction to finalize.
    function claimToFinalizeAuction(uint32 auctionID) nonReentrant external returns (bool success){
        auctionEntity storage a = auctions[auctionID];
        if (a.auctionType == 3)
            require (msg.sender == dao.addresses("cdp"), "CDP only");

        require(a.initialized && !a.finalized, "wrong auction");
        require(block.timestamp >= a.revealPhaseEnd, "reveal phase not ended");
        require(a.bestBidID != 0, "no bids");

        finalizeAuction(auctionID);
        return true;
    }

    function finalizeAuction(uint32 auctionID) internal {
        auctionEntity storage a = auctions[auctionID];
        Bid storage bestBid = bids[a.bestBidID];

        if (a.auctionType == 1){
            require(IERC20(address(a.lotToken)).transfer(bestBid.owner, a.lotAmount), "lotToken transfer failed");
            require(IERC20(address(a.paymentToken)).transfer(dao.addresses("cdp"), bestBid.amount), "paymentToken transfer failed");
            ruleBuyOut = false;
        }
        if (a.auctionType == 2){
            require(cdp.mintRule(bestBid.owner, bestBid.amount), "mint failed");
            require(coin.transfer(dao.addresses("cdp"), a.paymentAmount), "transfer failed");
            isCoinsBuyOutForStabilization = false;
        }
        if (a.auctionType == 3){
            require(payable(bestBid.owner).send(a.lotAmount), "collateral transfer failed");
            require(IERC20(address(a.paymentToken)).transfer(dao.addresses("cdp"), bestBid.amount), "transfer failed");
        }
        a.finalized = true;
        emit auctionFinished(auctionID, a.lotAmount, a.bestBidID);
    }

    /// @notice Shows whether a certain auction is finished or not.
    /// @param auctionID The ID of the auction.
    function isFinalized(uint32 auctionID) external view returns (bool finalized){
        return auctions[auctionID].finalized;
    }

    /// @notice Shows the payment amount required for an auction.
    /// @param auctionID The ID of the auction.
    function getPaymentAmount(uint32 auctionID) external view returns (uint256){
        return auctions[auctionID].paymentAmount;
    }

    /// @notice Shows the current best bid amount for an auction.
    /// @param auctionID The ID of the auction.
    function getBestBidAmount(uint32 auctionID) external view returns (uint256){
        return bids[auctions[auctionID].bestBidID].amount;
    }
    
    /// @notice Get auction phase info
    /// @param auctionID The ID of the auction
    function getAuctionPhase(uint32 auctionID) external view returns (bool inCommit, bool inReveal, uint256 phaseEndTime) {
        auctionEntity storage a = auctions[auctionID];
        if (block.timestamp < a.commitPhaseEnd) {
            return (true, false, a.commitPhaseEnd);
        } else if (block.timestamp < a.revealPhaseEnd) {
            return (false, true, a.revealPhaseEnd);
        } else {
            return (false, false, 0);
        }
    }
}

