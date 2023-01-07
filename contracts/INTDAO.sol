// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./Rule.sol";

/*

Polls for parameters and important contract addresses for INTDAO

*/

contract INTDAO {
    Rule ruleToken;
    mapping (uint => mapping(address => uint)) votes;

    mapping (uint=>Voting) votings;
    uint votingID;

    struct Voting {
        uint totalPositive;
        bool paramOrAddress;
        string name;
        uint value;
        address addr;
        uint startTime;
    }

    bool public activeVoting;

    mapping (string => uint) public params;
    mapping (string => address) public addresses;

    mapping (address => uint) pooled;
    uint public totalPooled;

    event NewParamVoteing (string name);
    event NewAddressVoteing (string name);

    constructor () {
        params['interestRate'] = 9;
        params['depositRate']=8;
        params['liquidationFee'] = 13;
        params['collateralDiscount'] = 30;
        params['stabilizationFundPercent'] = 5;
        params['quorum'] = 60;
        params['majority'] = 50;
        params['minAuctionBalanceToInitBuyOut'] = 10**19;
        params['absoluteMajority'] = 80;
        params['minRuleTokensToInitVoting'] = 10;
        params['votingDuration'] = 1 weeks;
        params['auctionDuration'] = 15 minutes;

        params['minColleteral'] = 1*10^16; // minColleteral is 0.01 ETH

        addresses['cdp'] = address(0x0);
        addresses['auction'] = address(0x0);
        addresses['stableCoin'] = address(0x0);
        addresses['dao'] = address(this);
        addresses['oracle'] = address(0x0);
        addresses['rule'] = address(0x0);
    }

    function setAddressOnce(string memory addressName, address addr) public{ //a certain pool of names, check not to expand addresses
        require(addresses[addressName] == address (0x0), 'address can be set only once');
        addresses[addressName] = addr;
    }

    function addVoting(bool paramOrAddress, string memory name, uint value, address addr) public {
        require(!activeVoting);
        ruleToken = Rule(addresses['rule']);
        require (pooled[msg.sender]>ruleToken.totalSupply()*params['minSharesToInitVoting']/100);
        votingID ++;
        votings[votingID] = Voting(0, paramOrAddress, name, value, addr, block.timestamp);

        if (paramOrAddress)
            emit NewParamVoteing(name);
        else
            emit NewAddressVoteing(name);
    }

    function transfered(address destination, uint value) public returns (bool) {
        require(destination == msg.sender, 'You can take back only your personal tokens');
        require(pooled[msg.sender] > 0, 'You must have pooled tokens');
        if (activeVoting && votes[votingID][msg.sender]>0){
            votings[votingID].totalPositive -= votes[votingID][msg.sender];
        }
        pooled[msg.sender] -= value;
        totalPooled -= value;
        return true;
    }

    function vote(uint votingId, bool _vote) public{
        require(activeVoting);
        require(votings[votingID].startTime + params['votingDuration'] < block.timestamp);
        require(pooled[msg.sender]>0);

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
        if (votings[votingId].paramOrAddress)
            params[votings[votingId].name] = votings[votingId].value;
        else
            addresses[votings[votingId].name] = votings[votingId].addr;
    }

    function claimToFinalizeVoting(uint votingId) public {
        if (votings[votingId].totalPositive > ruleToken.totalSupply() * params['absoluteMajority'] / 100)
            finalizeVoting(votingId);
        else if (votings[votingId].startTime + params['votingDuration'] < block.timestamp) {
            if (totalPooled > params['quorum'] * ruleToken.totalSupply() / 100 && votings[votingId].totalPositive > (totalPooled - votings[votingId].totalPositive))
                finalizeVoting(votingId);
        }
    }

    function allowed(address to) public view returns (uint _allowedValue) {
        return pooled[to];
    }

    function init (bool paramOrAddress, string memory name, uint value, address addr) public {
        if (paramOrAddress && params[name]==0)
            params[name] = value;
        else if (!paramOrAddress && addresses[name]==address(0x0))
            addresses[name] = addr;
    }

}
