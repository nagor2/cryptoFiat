// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract INTDAO {
    IERC20 ruleToken;
    mapping (uint256 => mapping(address => uint256)) votes;

    mapping (uint256=>Voting) public votings;
    uint256 public votingID;

    struct Voting {
        uint256 totalPositive;
        uint256 votingType;
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

    event NewVoting (uint256 id, string name);
    event VotingSucceed (uint256 id);
    event VotingFailed (uint256 id);

    constructor (address WETH) {
        params['interestRate'] = 9;
        params['depositRate']=8;
        params['liquidationFee'] = 13;
        params['collateralDiscount'] = 30;
        params['stabilizationFundPercent'] = 5;
        params['quorum'] = 60;
        params['majority'] = 50;
        params['minCDPBalanceToInitBuyOut'] = 10**19;
        params['absoluteMajority'] = 80;
        params['minRuleTokensToInitVotingPercent'] = 1;
        params['votingDuration'] = 1 days;
        params['auctionTurnDuration'] = 15 minutes;
        params['minAuctionPriceMove'] = 5;
        params['minColleteral'] = 1*10^16; // minColleteral is 0.01 ETH
        params['marginCallTimeLimit'] = 1 days;
        params['annualInflationPercent'] = 1;
        params['defaultDepositPeriod'] = 91 days;
        params['maxCoinsForStabilization'] = 50*10**18;
        params['maxRuleEmissionPercent'] = 1;
        params['highVolatilityEventBarrierPercent'] = 5;
        params['minCoinsToMint'] = 1;

        addresses['weth'] = WETH;
        addresses['dao'] = address(this);
    }

    function renewContracts() public {
        ruleToken = IERC20(addresses['rule']);
    }

    function setAddressOnce(string memory addressName, address addr) external {
        require (addresses[addressName] == address(0), "address was already set");
        addresses[addressName] = addr;
        //a certain pool of names, check not to expand addresses
        bytes32 hash = keccak256(bytes(addressName));
        if (hash == keccak256(bytes("deposit")) ||
            hash == keccak256(bytes("inflationFund"))) {
            isAuthorized[addr] = true;
        }
    }

    function addVoting(uint256 votingType, string memory name, uint value, address addr, bool decision) external{
        require(!activeVoting, "There is an active voting");
        require(votingType>0&&votingType<5, "Incorrect voteing type");
        require(isEnoughTokensPooledToInitVoting(msg.sender), "Too little tokens to init voting");
        votingID++;
        votings[votingID] = Voting(0, votingType, name, value, addr, block.timestamp, decision);
        activeVoting = true;
        emit NewVoting(votingID, name);
    }

    function poolTokens() external returns (bool success){
        uint256 amount = ruleToken.allowance(msg.sender, address(this));
        require (amount>0, "allow tokens first");
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "Could not pool tokens for some reason");
        pooled[msg.sender] += amount;
        totalPooled += amount;
        return true;
    }

    function returnTokens() external returns (bool) {
        require(pooled[msg.sender] > 0, 'You must have pooled tokens');
        if (activeVoting && votes[votingID][msg.sender]>0){
            votings[votingID].totalPositive -= votes[votingID][msg.sender];
        }
        ruleToken.transfer(msg.sender, pooled[msg.sender]);
        totalPooled -= pooled[msg.sender];
        pooled[msg.sender] = 0;
        return true;
    }

    function vote(bool _vote) external{
        require(activeVoting, "No active voting found");
        require(votings[votingID].startTime + params['votingDuration'] >= block.timestamp, "Voting is already inactive");
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

    function claimToFinalizeCurrentVoting() external{
        require (activeVoting, "There is no active voting");
        if (votings[votingID].totalPositive >= ruleToken.totalSupply() * params['absoluteMajority'] / 100) {
            finalizeCurrentVoting();
            return;
        }
        else if (votings[votingID].startTime + params['votingDuration'] <= block.timestamp) {
            if (totalPooled >= params['quorum'] * ruleToken.totalSupply() / 100 && votings[votingID].totalPositive > (totalPooled - votings[votingID].totalPositive)) {
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
        return pooled[initiator]>=ruleToken.totalSupply()*params['minRuleTokensToInitVotingPercent']/100;
    }
}
