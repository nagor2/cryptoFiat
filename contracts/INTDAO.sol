pragma solidity ^0.4.0;

/*

Polls for parameters and important contract addresses for INTDAO

*/

contract Control{
    function totalSupply() public view returns (uint supply);
    function balanceOf(address who) public view returns (uint value);
    function allowance(address owner, address spender) public view returns (uint remaining);

    function transfer(address to, uint value) public returns (bool ok);
    function transferFrom(address from, address to, uint value) public returns (bool ok);
    function approve(address spender, uint value) public returns (bool ok);
    function authorizedContractTransfer(address contractAddressFrom, address to, uint value) public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract INTDAO {
    Control controlToken;
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

    mapping (string => uint) params;
    mapping (string => address) addresses;

    mapping (address => uint) pooled;
    uint public totalPooled;

    event NewParamVoteing (string name);
    event NewAddressVoteing (string name);

    address public controllAddress; //The only unchangable address

    constructor (address interestControlTokenAddress) public {
        controllAddress = interestControlTokenAddress;
        controlToken = Control(controllAddress);

        params['interestRate'] = 9;
        params['depositRate']=8;
        params['liquidationFee'] = 13;
        params['stabilityFundPercent'] = 5;
        params['quorum'] = 50;
        params['majority'] = 50;
        params['absoluteMajority'] = 50;
        params['minSharesToInitVoting'] = 10;
        params['VotingDuration'] = 1 weeks;

        addresses['colleteralAddress'] = address(0x0);
        addresses['auctionAddress'] = address(0x0);
        addresses['daoAddress'] = address(this);
        addresses['oracleAddress'] = address(0x0); //0x88e2a2c9cfc1d0e12815319b19a9ed0491d343d0
    }

    function addVoting(bool paramOrAddress, string name, uint value, address addr) public {
        require(!activeVoting);
        require (pooled[msg.sender]>controlToken.totalSupply()*params['minSharesToInitVoting']/100);
        votingID ++;
        votings[votingID] = Voting(0, paramOrAddress, name, value, addr, now);

        if (paramOrAddress)
            emit NewParamVoteing(name);
        else
            emit NewAddressVoteing(name);
    }

    function poolControlTokens() public {
        uint256 controlTokensAllowed = controlToken.allowance(msg.sender, address(this));
        require(controlToken.transferFrom(msg.sender, address(this),controlTokensAllowed));
        pooled[msg.sender] += controlTokensAllowed;
        totalPooled += controlTokensAllowed;
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

    function takeAllFromThePool() public { //This function calls transfered, which lows positive votes
        require(pooled[msg.sender] > 0, 'You must have pooled tokens');
        controlToken.authorizedContractTransfer(address(this), msg.sender, pooled[msg.sender]);
    }

    function vote(uint votingId, bool _vote) public{
        require(activeVoting);
        require(votings[votingID].startTime + params['VotingDuration'] < now);
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
        if (votings[votingId].totalPositive > controlToken.totalSupply() * params['absoluteMajority'] / 100)
            finalizeVoting(votingId);
        else if (votings[votingId].startTime + params['VotingDuration'] < now) {
            if (totalPooled > params['quorum'] * controlToken.totalSupply() / 100 && votings[votingId].totalPositive > (totalPooled - votings[votingId].totalPositive))
                finalizeVoting(votingId);
        }
    }

    function getParam(string paramName) public view returns (uint) {
        return params[paramName];
    }

    function getAddress(string addressName) public view returns (address) {
        return addresses[addressName];
    }

    function allowed(address to) public view returns (uint _allowedValue) {
        return pooled[to];
    }
}
