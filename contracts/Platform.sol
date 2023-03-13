// SPDX-License-Identifier: UNLICENSED
import "./INTDAO.sol";
import "./stableCoin.sol";
import "./CDP.sol";
import "./tokenTemplate.sol";

pragma solidity >=0.4.22 <0.9.0;

contract Platform is ERC20{
    uint256 public constant decimals = 18;
    uint256 initialSupply = 1000;
    address public tokenMinter;
    address public ownerAddress;

    string public constant name = "Crowdfunding platform";
    string public constant symbol = "CFP";

    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;
    event newDividendsRound(uint256 round, address rewardToken, uint256 amount);

    INTDAO dao;
    CDP cdp;
    stableCoin coin;

    uint256 public currentDividendsRound;
    mapping (address => bool) public mintedTokens;
    mapping (uint256 => address) public dividendsRounds;
    mapping (uint256 => uint256) public dividendsPerRoundPerToken;
    mapping (address => uint256) public lastPayedDividendsRound;

    modifier onlyMinter{
        require(msg.sender == tokenMinter, "This function is for minter only");
        _;
    }

    modifier onlyOwner{
        require(msg.sender == ownerAddress, "This function is for minter only");
        _;
    }

    constructor(address payable INTDAOaddress){
        dao = INTDAO(INTDAOaddress);
        coin = stableCoin(dao.addresses('stableCoin'));
        cdp = CDP(dao.addresses('cdp'));
        dao.setAddressOnce('platform',payable(address(this)));
        tokenMinter = msg.sender;
        ownerAddress = msg.sender;
        balances[ownerAddress] = initialSupply*10**decimals;
    }

    function changeMinter(address addr) public onlyOwner{
        tokenMinter = addr;
    }

    function renewContracts() public {
        coin = stableCoin(dao.addresses('stableCoin'));
        cdp = CDP(dao.addresses('cdp'));
    }

    function claimDividends(address addr) public{
        uint256 divAmount;
        address beneficiary;
        if (isContract(addr)) {
            beneficiary = tokenMinter;
        }
        else beneficiary = addr;
        for (uint256 i=lastPayedDividendsRound[addr]; i<currentDividendsRound; i++){
            ERC20 token = ERC20(dividendsRounds[i]);
            divAmount = balances[addr]/10**18*dividendsPerRoundPerToken[i];
            if (token.balanceOf(address(this))>=divAmount)
                token.transfer(beneficiary, divAmount);
            else
                token.transfer(beneficiary, token.balanceOf(address(this)));
        }
        lastPayedDividendsRound[addr] = currentDividendsRound;
    }

    function isContract(address addr) internal view returns (bool) {
        uint size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }

    function addMintedToken(address addr) public onlyMinter{
        tokenTemplate token = tokenTemplate(addr);
        require(token.platformContractAddress() == address(this));
        mintedTokens[addr] = true;
    }

    function addDividend(address rewardToken, uint256 amount) public returns(bool success){
        require(amount>0, "dont be greedy");
        require(rewardToken == dao.addresses('stableCoin') || mintedTokens[rewardToken], "only for authorized tokens");
        require(mintedTokens[msg.sender], "only for authorized tokens");
        dividendsRounds[currentDividendsRound] = rewardToken;
        dividendsPerRoundPerToken[currentDividendsRound] = amount/initialSupply;
        emit newDividendsRound(currentDividendsRound, rewardToken, amount);
        currentDividendsRound++;
        return true;
    }

    function claimInterestForMintedTokenHolder(uint256 amount, address beneficiary) public{
        require(mintedTokens[msg.sender], "only tokens, minted by the platform may claim interest");
        cdp.claimInterest(amount, beneficiary);
    }

    function getCurrentInterestRate() public view returns (uint256 interestRate){
        return dao.params('depositRate');
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
        claimDividends(to);
        claimDividends(msg.sender);
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
        claimDividends(from);
        claimDividends(to);
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

    receive() external payable {
        dao.addresses('oracle').transfer(address(this).balance);
    }
}
