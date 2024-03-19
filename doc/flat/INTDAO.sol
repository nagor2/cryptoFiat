// File: @openzeppelin\contracts\token\ERC20\IERC20.sol

// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// File: @openzeppelin\contracts\security\ReentrancyGuard.sol

// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}

// File: contracts\INTDAO.sol

// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
contract INTDAO is ReentrancyGuard{
    IERC20 ruleToken;
    mapping (uint32 => mapping(address => uint256)) votes;

    mapping (uint32=>Voting) public votings;
    uint32 public votingID;

    struct Voting {
        uint256 totalPositive;
        uint8 votingType;
        string name;
        uint256 value;
        address addr;
        uint256 startTime;
        bool decision;
    }

    bool public activeVoting;

    mapping (string => uint256) public params;
    mapping (string => address) public addresses;
    mapping (address => bool) public paused;
    mapping (address => bool) public isAuthorized;

    mapping (address => uint256) public pooled;
    uint256 public totalPooled;

    event NewVoting (uint32 indexed id, string name, string indexed indexedName);
    event VotingSucceed (uint32 indexed id);
    event VotingFailed (uint32 indexed id);

    constructor (address[] memory _addresses) {
        params["interestRate"] = 9;
        params["depositRate"]=8;
        params["liquidationFee"] = 13;
        params["collateralDiscount"] = 30;
        params["stabilizationFundPercent"] = 5;
        params["quorum"] = 60;
        params["majority"] = 50;
        params["minCDPBalanceToInitBuyOut"] = 10**19;
        params["absoluteMajority"] = 80;
        params["minRuleTokensToInitVotingPercent"] = 1;
        params["votingDuration"] = 1 days;
        params["auctionTurnDuration"] = 15 minutes;
        params["minAuctionPriceMove"] = 5;
        params["minColleteral"] = 1*10^16; // minColleteral is 0.01 ETH
        params["marginCallTimeLimit"] = 1 days;
        params["annualInflationPercent"] = 1;
        params["defaultDepositPeriod"] = 91 days;
        params["maxCoinsForStabilization"] = 50*10**18;
        params["maxRuleEmissionPercent"] = 1;
        params["highVolatilityEventBarrierPercent"] = 5;
        params["minCoinsToMint"] = 1;

        addresses["weth"] = _addresses[0];
        addresses["cdp"] = _addresses[1];
        addresses["auction"] = _addresses[2];
        addresses["deposit"] = _addresses[3];
        addresses["oracle"] = _addresses[4];
        addresses["inflationFund"] = _addresses[5];
        addresses["rule"] = _addresses[6];
        addresses["stableCoin"] = _addresses[7];
        addresses["cart"] = _addresses[8];

        addresses["inflationSpender"] = _addresses[1];
        isAuthorized[_addresses[3]]=true;
        isAuthorized[_addresses[5]]=true;

        addresses["dao"] = address(this);
        renewContracts();
    }

    function renewContracts() public {
        ruleToken = IERC20(addresses["rule"]);
    }

    function addVoting(uint8 votingType, string memory name, uint value, address addr, bool decision) external{
        require(!activeVoting, "There is an active voting");
        require(votingType>0&&votingType<5, "Incorrect voteing type");
        require(isEnoughTokensPooledToInitVoting(msg.sender), "Too little tokens to init voting");
        votingID++;
        votings[votingID] = Voting(0, votingType, name, value, addr, block.timestamp, decision);
        activeVoting = true;
        emit NewVoting(votingID, name, name);
    }

    function poolTokens() nonReentrant external returns (bool success) {
        uint256 amount = ruleToken.allowance(msg.sender, address(this));
        require (amount>0, "allow tokens first");
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "Could not pool tokens for some reason");
        pooled[msg.sender] += amount;
        totalPooled += amount;
        return true;
    }

    function returnTokens() nonReentrant external returns (bool) {
        require(pooled[msg.sender] > 0, "You must have pooled tokens");
        if (activeVoting && votes[votingID][msg.sender]>0){
            votings[votingID].totalPositive -= votes[votingID][msg.sender];
        }
        ruleToken.transfer(msg.sender, pooled[msg.sender]);
        totalPooled -= pooled[msg.sender];
        pooled[msg.sender] = 0;
        return true;
    }

    function vote(bool _vote) nonReentrant external{
        require(activeVoting, "No active voting found");
        require(votings[votingID].startTime + params["votingDuration"] >= block.timestamp, "Voting is already inactive");
        require(pooled[msg.sender]>0, "You dont have pooled tokens to vote");

        if (_vote) {
            uint256 _votesToAdd = pooled[msg.sender] - votes[votingID][msg.sender];
            votes[votingID][msg.sender] = pooled[msg.sender];
            votings[votingID].totalPositive += _votesToAdd;
        }
        else {
            if (votes[votingID][msg.sender] > 0){
                votings[votingID].totalPositive -= votes[votingID][msg.sender];
                votes[votingID][msg.sender] = 0;
            }
        }
    }

    function claimToFinalizeCurrentVoting() nonReentrant external{
        require (activeVoting, "There is no active voting");
        if (votings[votingID].totalPositive >= ruleToken.totalSupply() * params["absoluteMajority"] / 100) {
            finalizeCurrentVoting();
            return;
        }
        else if (votings[votingID].startTime + params["votingDuration"] <= block.timestamp) {
            if (totalPooled >= params["quorum"] * ruleToken.totalSupply() / 100 && votings[votingID].totalPositive > (totalPooled - votings[votingID].totalPositive)) {
                finalizeCurrentVoting();
                return;
            }
            activeVoting = false;
            emit VotingFailed(votingID);
            return;
        }
    }

    function finalizeCurrentVoting() internal{
        if (votings[votingID].votingType == 1)
            params[votings[votingID].name] = votings[votingID].value;
        if (votings[votingID].votingType == 2)
            addresses[votings[votingID].name] = votings[votingID].addr;
        if (votings[votingID].votingType == 3)
            paused[votings[votingID].addr] = votings[votingID].decision;
        if (votings[votingID].votingType == 4)
            isAuthorized[votings[votingID].addr] = votings[votingID].decision;
        activeVoting = false;
        emit VotingSucceed(votingID);
    }

    function isEnoughTokensPooledToInitVoting(address initiator) internal view returns (bool enough){
        return pooled[initiator]>=ruleToken.totalSupply()*params["minRuleTokensToInitVotingPercent"]/100;
    }
}
