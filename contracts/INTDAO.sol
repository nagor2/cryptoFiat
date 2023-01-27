// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./Rule.sol";

/*

Polls for parameters and important contract addresses for INTDAO

*/

contract INTDAO {
    Rule ruleToken;
    mapping (uint => mapping(address => uint)) votes;

    mapping (uint=>Voting) public votings;
    uint votingID;

    struct Voting {
        uint totalPositive;
        uint256 voteingType;
        string name;
        uint value;
        address payable addr;
        uint256 startTime;
        bool toPause;
    }

    bool public activeVoting;

    mapping (string => uint) public params;
    mapping (string => address payable) public addresses;
    mapping (address => bool) public paused;
    mapping (address => address) public convert; //TODO: for exchange operations to convert old tokens to newer once if needed

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
        params['minAuctionBalanceToInitBuyOut'] = 10**19;
        params['absoluteMajority'] = 80;
        params['minRuleTokensToInitVotingPercent'] = 1;
        params['votingDuration'] = 1 days;
        params['auctionTurnDuration'] = 15 minutes;
        params['minAuctionPriceMove'] = 5;
        params['marginCallFee'] = 13;
        params['minColleteral'] = 1*10^16; // minColleteral is 0.01 ETH
        params['marginCallTimeLimit'] = 1 days;

        addresses['weth'] = payable(WETH);
        addresses['cdp'] = payable(0x0);
        addresses['auction'] = payable(0x0);
        addresses['stableCoin'] = payable(0x0);
        addresses['dao'] = payable(address(this));
        addresses['oracle'] = payable(0x0);
        addresses['rule'] = payable(0x0);
    }

    function setAddressOnce(string memory addressName, address payable addr) public{ //a certain pool of names, check not to expand addresses
        require(addresses[addressName] == address (0x0), 'address can be set only once');
        addresses[addressName] = addr;
        paused[addr] = false;
    }

    function addVoting(uint256 votingType, string memory name, uint value, address payable addr, bool toPause) public {
        require(!activeVoting, "There is an active voting");
        require(votingType>0&&votingType<4, "Incorrect voteing type");
        require (pooled[msg.sender]>=ruleToken.totalSupply()*params['minRuleTokensToInitVotingPercent']/100, "Too little tokens to init voting");
        votingID++;
        votings[votingID] = Voting(0, votingType, name, value, addr, block.timestamp, toPause);
        emit NewVoting(votingID, name);
        activeVoting = true;
    }

    function renewRule() public{
        ruleToken = Rule(addresses['rule']);
    }

    function poolTokens() public returns (bool success){
        uint256 amount = ruleToken.allowance(msg.sender, address(this));
        require (amount>0, "allow tokens first");
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "Could not pool tokens for some reason");
        pooled[msg.sender] += amount;
        totalPooled += amount;
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

    function vote(uint256 votingId, bool _vote) public{
        require(activeVoting, "No active voting found");
        require(votings[votingId].startTime + params['votingDuration'] >= block.timestamp, "Voting is already inactive");
        require(pooled[msg.sender]>0, "You dont have pooled tokens to vote");

        if (_vote) {
            uint _votesToAdd = pooled[msg.sender] - votes[votingId][msg.sender];
            votes[votingId][msg.sender] = pooled[msg.sender];
            votings[votingId].totalPositive += _votesToAdd;
        }
        else {
            if (votes[votingId][msg.sender] > 0){
                votings[votingID].totalPositive -= votes[votingId][msg.sender];
                votes[votingId][msg.sender] = 0;
            }
        }
    }

    function finalizeVoting(uint votingId) internal {
        if (votings[votingId].voteingType == 1)
            params[votings[votingId].name] = votings[votingId].value;
        if (votings[votingId].voteingType == 2)
            addresses[votings[votingId].name] = votings[votingId].addr;
        if (votings[votingId].voteingType == 3)
            paused[votings[votingId].addr] = votings[votingId].toPause;
        emit VotingSucceed(votingId);
        activeVoting = false;
    }

    function claimToFinalizeVoting(uint votingId) public {
        if (votings[votingId].totalPositive >= ruleToken.totalSupply() * params['absoluteMajority'] / 100) {
            finalizeVoting(votingId);
            return;
        }
        else if (votings[votingId].startTime + params['votingDuration'] < block.timestamp) {
            if (totalPooled >= params['quorum'] * ruleToken.totalSupply() / 100 && votings[votingId].totalPositive > (totalPooled - votings[votingId].totalPositive)) {
                finalizeVoting(votingId);
                return;
            }
            emit VotingFailed(votingId);
            activeVoting = false;
            return;
        }
    }
}
