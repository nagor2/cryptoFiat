// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDAO{
    function addresses(string memory) external view returns (address);
    function params(string memory) external view returns (uint256);
    function setAddressOnce(string memory, address) external;
}

interface ICDP{
    function claimEmission(uint256 amount, address beneficiary) external;
}

contract InflationFund {
    IDAO dao;
    IERC20 coin;
    ICDP cdp;

    uint256 public lastEmission;
    event inflationEmission(uint256 amount);

    constructor(address payable INTDAOaddress){
        dao = IDAO(INTDAOaddress);
        dao.setAddressOnce('inflationFund',address(this));
        coin = IERC20(dao.addresses('stableCoin'));
        cdp = ICDP(payable(dao.addresses('cdp')));
        lastEmission = block.timestamp;
    }

    function renewContracts() public {
        coin = IERC20(payable(dao.addresses('stableCoin')));
        cdp = ICDP(payable(dao.addresses('cdp')));
    }

    function claimEmission() public{
        uint256 period = block.timestamp - lastEmission;
        require (period>=363 days, "too early to claim");
        uint256 amount = period/365 days*dao.params("annualInflationPercent")*coin.totalSupply()/100;
        lastEmission = block.timestamp;
        require (amount>0, "nothing to emit");
        cdp.claimEmission(amount,address(this));
        emit inflationEmission(amount);
    }

    function claimTransfer() public{
        coin.transfer(dao.addresses("inflationSpender"), coin.balanceOf(address(this)));
    }
}
