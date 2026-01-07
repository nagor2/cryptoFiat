// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDAOFlashLoan {
    function poolTokens() external returns (bool success);
    function returnTokens() external returns (bool);
    function vote(bool _vote) external;
    function pooled(address) external view returns (uint256);
    function addVoting(uint8 votingType, string memory name, uint value, address addr, bool decision) external;
}

/// @title Flash Loan Attacker contract for testing DAO vulnerability
/// @notice This contract attempts to exploit DAO voting via flash loan attack
contract FlashLoanAttacker {
    IDAOFlashLoan public dao;
    IERC20 public ruleToken;
    address public owner;
    
    // Attack result tracking
    bool public attackSucceeded;
    uint256 public votesRecorded;
    string public attackError;
    
    constructor(address _dao, address _ruleToken) {
        dao = IDAOFlashLoan(_dao);
        ruleToken = IERC20(_ruleToken);
        owner = msg.sender;
    }
    
    /// @notice Simulate flash loan attack in a single transaction
    /// @dev Attempts to: 1) Pool tokens 2) Vote 3) Return tokens
    function executeFlashLoanAttack() external returns (bool success) {
        require(msg.sender == owner, "owner only");
        
        uint256 balance = ruleToken.balanceOf(address(this));
        require(balance > 0, "no tokens to attack with");
        
        try this._attemptAttack() returns (bool result) {
            attackSucceeded = result;
            return result;
        } catch Error(string memory reason) {
            attackError = reason;
            attackSucceeded = false;
            return false;
        } catch {
            attackError = "Unknown error";
            attackSucceeded = false;
            return false;
        }
    }
    
    /// @notice Internal function to execute the attack sequence
    function _attemptAttack() external returns (bool) {
        require(msg.sender == address(this), "internal only");
        
        // Step 1: Approve DAO to spend our tokens
        uint256 balance = ruleToken.balanceOf(address(this));
        require(ruleToken.approve(address(dao), balance), "approve failed");
        
        // Step 2: Pool tokens into DAO
        require(dao.poolTokens(), "pool failed");
        votesRecorded = dao.pooled(address(this));
        
        // Step 3: Vote with pooled tokens
        dao.vote(true);
        
        // Step 4: Immediately return tokens (simulate flash loan repayment)
        require(dao.returnTokens(), "return failed");
        
        // Check if we still have tokens back
        uint256 balanceAfter = ruleToken.balanceOf(address(this));
        return balanceAfter == balance;
    }
    
    /// @notice Helper to create a voting proposal (needs enough tokens)
    function createVoting(uint8 votingType, string memory name, uint value, address addr, bool decision) external {
        require(msg.sender == owner, "owner only");
        
        // Pool tokens first
        uint256 balance = ruleToken.balanceOf(address(this));
        require(ruleToken.approve(address(dao), balance), "approve failed");
        require(dao.poolTokens(), "pool failed");
        
        // Create voting
        dao.addVoting(votingType, name, value, addr, decision);
    }
    
    /// @notice Transfer tokens to this contract
    function fundAttacker(uint256 amount) external {
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
    }
}

