// SPDX-License-Identifier: UNLICENSED

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./INTDAO.sol";
import "./CDP.sol";
import "./tokenTemplate.sol";

pragma solidity 0.8.19;

contract Platform is ERC20{
    address public tokenMinter;
    address public ownerAddress;
    uint256 public mintedNum;

    event newDividendsRound(uint256 round, address rewardToken, uint256 amount);

    INTDAO dao;
    CDP cdp;
    IERC20 coin;

    uint256 public currentDividendsRound;
    mapping (address => bool) public isMintedByPlatform;
    mapping (uint256 => address) public mintedTokens;
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

    constructor(address payable INTDAOaddress) ERC20("Crowdfunding platform", "CFP"){
        _mint(msg.sender, 10**6*10**decimals());
        dao = INTDAO(INTDAOaddress);
        coin = IERC20(dao.addresses('stableCoin'));
        cdp = CDP(dao.addresses('cdp'));
        dao.setAddressOnce('platform',payable(address(this)));
        tokenMinter = msg.sender;
        ownerAddress = msg.sender;
    }

    function changeMinter(address addr) public onlyOwner{
        tokenMinter = addr;
    }

    function renewContracts() public {
        coin = IERC20(dao.addresses('stableCoin'));
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
            divAmount = balanceOf(addr)/10**18*dividendsPerRoundPerToken[i];
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
        isMintedByPlatform[addr] = true;
        mintedTokens[mintedNum] = addr;
        mintedNum++;
    }

    function addDividend(address rewardToken, uint256 amount) public returns(bool success){
        require(amount>0, "dont be greedy");
        require(rewardToken == dao.addresses('stableCoin') || isMintedByPlatform[rewardToken], "only for authorized tokens");
        require(isMintedByPlatform[msg.sender], "only for authorized tokens");
        dividendsRounds[currentDividendsRound] = rewardToken;
        dividendsPerRoundPerToken[currentDividendsRound] = 10**decimals()*amount/totalSupply();
        emit newDividendsRound(currentDividendsRound, rewardToken, amount);
        currentDividendsRound++;
        return true;
    }

    function claimInterestForMintedTokenHolder(uint256 amount, address beneficiary) public{
        require(isMintedByPlatform[msg.sender], "only tokens, minted by the platform may claim interest");
        cdp.claimInterest(amount, beneficiary);
    }

    function getCurrentInterestRate() public view returns (uint256 interestRate){
        return dao.params('depositRate');
    }

    receive() external payable {
        dao.addresses('oracle').transfer(address(this).balance);
    }
}
