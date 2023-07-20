// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./Rule.sol";

contract INTDAO {
    Rule ruleToken;
    mapping (uint => mapping(address => uint)) votes;

    mapping (uint=>Voting) public votings;
    uint256 public votingID;

    struct Voting {
        uint totalPositive;
        uint256 voteingType;
        string name;
        uint value;
        address payable addr;
        uint256 startTime;
        bool decision;
    }

    bool public activeVoting;

    mapping (string => uint) public params;
    mapping (string => address payable) public addresses;
    mapping (address => bool) public paused;
    mapping (address => bool) public authorized;

    mapping (address => uint) public pooled;
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
        params['marginCallFee'] = 13;
        params['minColleteral'] = 1*10^16; // minColleteral is 0.01 ETH
        params['marginCallTimeLimit'] = 1 days;
        params['annualInflationPercent'] = 1;
        params['defaultDepositPeriod'] = 91 days;
        params['maxCoinsForStabilization'] = 50*10**18;
        params['maxRuleEmissionPercent'] = 1;
        params['highVolatilityEventBarrierPercent'] = 5;


        addresses['weth'] = payable(WETH);
        addresses['cdp'] = payable(0x0);
        addresses['auction'] = payable(0x0);
        addresses['stableCoin'] = payable(0x0);
        addresses['dao'] = payable(address(this));
        addresses['oracle'] = payable(0x0);
        addresses['rule'] = payable(0x0);
        addresses['deposit'] = payable(0x0);
        addresses['inflationFund'] = payable(0x0);
        addresses['inflationSpender'] = payable(0x0);
    }

    function setAddressOnce(string memory addressName, address payable addr) public{ //a certain pool of names, check not to expand addresses
        require (addresses[addressName] == address (0x0), "address was already set");
            addresses[addressName] = addr;
            paused[addr] = false;
            if (keccak256(bytes(addressName)) == keccak256(bytes("deposit")))
                authorized[addr] = true;
            if (keccak256(bytes(addressName)) == keccak256(bytes("inflationFund")))
                authorized[addr] = true;
            if (keccak256(bytes(addressName)) == keccak256(bytes("platform")))
                authorized[addr] = true;
    }

    function addVoting(uint256 votingType, string memory name, uint value, address payable addr, bool _decision) public {
        require(!activeVoting, "There is an active voting");
        require(votingType>0&&votingType<5, "Incorrect voteing type");
        require (isEnoughTokensPooledToInitVoting(msg.sender), "Too little tokens to init voting");
        votingID++;
        votings[votingID] = Voting(0, votingType, name, value, addr, block.timestamp, _decision);
        activeVoting = true;
        emit NewVoting(votingID, name);
    }

    function isEnoughTokensPooledToInitVoting(address initiator) internal view returns (bool enough){
        return pooled[initiator]>=ruleToken.totalSupply()*params['minRuleTokensToInitVotingPercent']/100;
    }

    function renewContracts() public {
        ruleToken = Rule(addresses['rule']);
    }

    function poolTokens() public returns (bool success){
        uint256 amount = ruleToken.allowance(msg.sender, address(this));
        require (amount>0, "allow tokens first");
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "Could not pool tokens for some reason");
        pooled[msg.sender] += amount;
        totalPooled += amount;
        return true;
    }

    function returnTokens() public returns (bool) {
        require(pooled[msg.sender] > 0, 'You must have pooled tokens');
        if (activeVoting && votes[votingID][msg.sender]>0){
            votings[votingID].totalPositive -= votes[votingID][msg.sender];
        }
        ruleToken.transfer(msg.sender, pooled[msg.sender]);
        totalPooled -= pooled[msg.sender];
        pooled[msg.sender] = 0;
        return true;
    }

    function vote(bool _vote) public{
        require(activeVoting, "No active voting found");
        require(votings[votingID].startTime + params['votingDuration'] >= block.timestamp, "Voting is already inactive");
        require(pooled[msg.sender]>0, "You dont have pooled tokens to vote");

        if (_vote) {
            uint _votesToAdd = pooled[msg.sender] - votes[votingID][msg.sender];
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

    function claimToFinalizeCurrentVoting() public {
        if (votings[votingID].totalPositive >= ruleToken.totalSupply() * params['absoluteMajority'] / 100) {
            finalizeCurrentVoting();
            return;
        }
        else if (votings[votingID].startTime + params['votingDuration'] <= block.timestamp) {
            if (totalPooled >= params['quorum'] * ruleToken.totalSupply() / 100 && votings[votingID].totalPositive > (totalPooled - votings[votingID].totalPositive)) {
                finalizeCurrentVoting();
                return;
            }
            emit VotingFailed(votingID);
            activeVoting = false;
            return;
        }
    }

    function finalizeCurrentVoting() internal {
        if (votings[votingID].voteingType == 1)
            params[votings[votingID].name] = votings[votingID].value;
        if (votings[votingID].voteingType == 2)
            addresses[votings[votingID].name] = votings[votingID].addr;
        if (votings[votingID].voteingType == 3)
            paused[votings[votingID].addr] = votings[votingID].decision;
        if (votings[votingID].voteingType == 4)
            authorized[votings[votingID].addr] = votings[votingID].decision;
        emit VotingSucceed(votingID);
        activeVoting = false;
    }

    receive() external payable {}

    function withdraw() public {
        addresses['oracle'].transfer(address(this).balance);
    }
}
