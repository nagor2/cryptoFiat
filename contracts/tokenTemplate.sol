// SPDX-License-Identifier: UNLICENSED
import "./Platform.sol";
import "./stableCoin.sol";

pragma solidity >=0.4.22 <0.9.0;

contract tokenTemplate is ERC20{
    Platform platform;
    stableCoin coin;
    uint256 public constant decimals = 18;
    string public name;
    string public symbol;

    mapping (address => uint256) balances;
    mapping (address => uint256) timeBought;
    mapping (address => mapping (address => uint256)) allowed;
    mapping (address => uint256) public frozen;

    address public stableCoinAddress;
    address public platformContractAddress;
    address public teamAddress;
    uint256 public initialPrice;
    uint256 public initialSupply;
    uint256 public initialTime;
    uint256 public crowdSaleDuration;
    bool public crowdSaleIsActive;
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public percentOfTokensToTeam;
    uint256 public numberOfMileStones;
    uint256 public currentStage;
    uint256 public previousStageSubmitted;
    uint256[] public budgetPercent;
    uint256[] public extraChargePercent;
    uint256[] public stagesDuration;
    string [] public stagesShortDescription;
    uint256 public holdDuration;
    bool public projectFinished;
    uint256 public soldTokens;
    uint256 public platformFeePercent;
    uint256 public totalBudgetSpent;
    uint256 public tokensToSell;

    event stageSubmitted(uint256 stageNumber);
    event tokensSold(uint256 amount, uint256 price);
    event tokensReturned(uint256 amount);
    event fundsPassed(uint256 stage, uint256 amount);

    modifier onlyTeam{
        require(msg.sender == teamAddress, "This function is for team only");
        _;
    }

    constructor(address[] memory addresses,
                uint256[] memory params,
                string memory _symbol,
                string memory _name,
                uint256[] memory _budgetPercent,
                uint256[] memory _extraChargePercent,
                uint256[] memory _stagesDuration,
                string[] memory _stagesShortDescription) {

        teamAddress = addresses[0];
        coin = stableCoin(payable(addresses[1]));
        platform = Platform(payable(addresses[2]));
        platformContractAddress = addresses[2];

        initialPrice = params[0]*10**coin.decimals();
        initialSupply = params[1]*10**decimals;
        balances[address(this)] = initialSupply;
        platformFeePercent = params[2];
        numberOfMileStones = params[3];

        require(_budgetPercent[0]<=10, "too much for the first stage");
        require(_budgetPercent[numberOfMileStones]>=30, "too little for the last stage");
                      uint256 overallBudget;
                for (uint256 i = 0; i<=numberOfMileStones; i++){
                    overallBudget += _budgetPercent[i];
                }
                require(overallBudget == 100, "Wrong budget percent values");

                for (uint256 j = 0; j<numberOfMileStones; j++){
                    require (_stagesDuration[j]>=2592000, "each stage duration should be at least 1 month");
                }

        percentOfTokensToTeam = params[4];
        crowdSaleDuration = params[5];
        holdDuration = params[6];
        softCap = params[7];
        hardCap = initialSupply;

        require (hardCap>softCap);

        projectFinished = false;
        initialTime = block.timestamp;
        budgetPercent = new uint256[](numberOfMileStones+1);
        budgetPercent = _budgetPercent;
        extraChargePercent = new uint256[](numberOfMileStones);
        extraChargePercent = _extraChargePercent;
        stagesDuration = new uint256[](numberOfMileStones);
        stagesDuration = _stagesDuration;
        stagesShortDescription = new string[](numberOfMileStones);
        stagesShortDescription = _stagesShortDescription;
        crowdSaleIsActive = true;
        previousStageSubmitted = block.timestamp;
        name = _name;
        symbol = _symbol;
        tokensToSell = initialSupply;
        soldTokens = 0;
    }

    function submitStage() public onlyTeam{
        require(!crowdSaleIsActive, "crowdsale is still active, finalizePublicOffer first");
        require (block.timestamp > previousStageSubmitted+stagesDuration[currentStage], "too early to submit the stage");
        emit stageSubmitted(currentStage);
        currentStage++;
        previousStageSubmitted = block.timestamp;
    }

    function finalizePublicOffer() public onlyTeam{
        if (soldTokens >=hardCap)
            crowdSaleIsActive = false;
        if (soldTokens < hardCap)
            require(block.timestamp> initialTime + crowdSaleDuration, "too early to finalize crowdsale");
        if (soldTokens >=softCap) {
            crowdSaleIsActive = false;
        }
        if (soldTokens<softCap){
            crowdSaleIsActive = false;
            return;
        }
        initialSupply = soldTokens;
        uint256 tokensToTeam = percentOfTokensToTeam * soldTokens / (100 - percentOfTokensToTeam);
        balances[address(this)] = tokensToTeam;
        initialSupply += tokensToTeam;
        emit Transfer(address(this), address(this), tokensToTeam);
        tokensToSell = 0;
    }

    function passFundsToTeam() public onlyTeam{
        require (!projectFinished, "Project is already finished, nothing to pass");
        require (block.timestamp>previousStageSubmitted+holdDuration, "Hold period is not finished yet");
        uint256 fundsToPass = budgetPercent[currentStage] * soldTokens * initialPrice / 100;
        coin.transfer(teamAddress, fundsToPass);
        emit fundsPassed(currentStage, fundsToPass);
        totalBudgetSpent += budgetPercent[currentStage];
    }

    function finalizeProject() public{
        require (currentStage==numberOfMileStones, "All stages should be passed");
        uint256 fee = soldTokens * initialPrice / 100 * platformFeePercent;
        coin.transfer(platformContractAddress, fee);
        platform.addDividend(address(coin), fee);
        uint256 coinsLeft = coin.balanceOf(address(this));
        coin.transfer(teamAddress, coinsLeft);
        emit fundsPassed(currentStage, coinsLeft);
        uint256 tokensToPlatform =  initialSupply * platformFeePercent /100;
        transfer(platformContractAddress, tokensToPlatform);
        platform.addDividend(address(this), tokensToPlatform);
        transfer(teamAddress, balances[address(this)]);
        projectFinished = true;
    }

    function buyTokens() public{
        require (tokensToSell > 0, "nothing to sell, sorry");
        uint256 coinsAmount = coin.allowance(msg.sender, address(this));
        require (coinsAmount > initialPrice, "You should allow enough stableCoins first");
        require (coin.transferFrom(msg.sender, address(this), coinsAmount), "Could not transfer for some reason");
        uint256 currentPrice = initialPrice * (100+extraChargePercent[currentStage])/100;
        uint256 tokensAmount = coinsAmount/currentPrice*10**decimals;
        if (tokensAmount>balances[address(this)])
            tokensAmount = balances[address(this)];
        this.transfer(msg.sender, tokensAmount);
        timeBought[msg.sender] = block.timestamp;
        soldTokens += tokensAmount;
        tokensToSell -= tokensAmount;
        emit tokensSold(tokensAmount, currentPrice);
        emit Transfer(address(this), msg.sender, tokensAmount);
    }

    function returnTokens() public{
        require (!projectFinished, "Project is already finished, all stages passed, nothing to return");
        uint256 tokensAmount = allowed[msg.sender][address(this)];
        uint256 toFreeze = tokensAmount * totalBudgetSpent / 100;
        uint256 toReturn = tokensAmount - toFreeze;
        if (toReturn>0){
            require(this.transferFrom(msg.sender, address(this), toReturn), "Could not transfer tokens for some reason");
            emit tokensReturned(toReturn);
            uint256 coinsAvailableForTokenHolder = toReturn * initialPrice / 10**decimals;
            uint256 interestAvailable = calculateInterestAvailable(coinsAvailableForTokenHolder, msg.sender);
            platform.claimInterestForMintedTokenHolder(interestAvailable, msg.sender);
            require(coin.transfer(msg.sender, coinsAvailableForTokenHolder), "Could not transfer coins for some reason");
            tokensToSell += toReturn;
            soldTokens -= toReturn;
            frozen[msg.sender] += toFreeze;
        }
    }

    function calculateInterestAvailable(uint256 coinsOnHold, address holderAddress) public view returns (uint256 amount){
        return coinsOnHold*(block.timestamp - timeBought[holderAddress])/1 days*platform.getCurrentInterestRate()/36500;
    }

    function totalSupply() public view returns (uint256) {
        return initialSupply;
    }

    function balanceOf(address owner) public view returns (uint256 balance) {
        return balances[owner];
    }

    function allowance(address owner, address spender) public view returns (uint remaining) {
        return allowed[owner][spender];
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        require(value<=balances[msg.sender]-frozen[msg.sender], "You can not transfer frozen tokens");
        if (balances[msg.sender] >= value && value > 0) {
            balances[msg.sender] -= value;
            balances[to] += value;
            emit Transfer(msg.sender, to, value);
            return true;
        } else {
            return false;
        }
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(value<=balances[from]-frozen[from], "You can not transfer frozen tokens");
        if (balances[from] >= value && allowed[from][msg.sender] >= value && value > 0) {
            balances[to] += value;
            balances[from] -= value;
            allowed[from][msg.sender] -= value;
            emit Transfer(from, to, value);
            return true;
        } else {
            return false;
        }
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
}

