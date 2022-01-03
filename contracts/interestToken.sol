pragma solidity >=0.4.22 <0.6.0;

library SafeMath {
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        uint256 c = a / b;
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        uint256 c = a - b;
        return c;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
}

contract ERC20 {
    function totalSupply() public view returns (uint supply);
    function balanceOf(address who) public view returns (uint value);
    function allowance(address owner, address spender) public view returns (uint remaining);

    function transfer(address to, uint value) public returns (bool ok);
    function transferFrom(address from, address to, uint value) public returns (bool ok);
    function approve(address spender, uint value) public returns (bool ok);

    event Transfer(address indexed from, address indexed to, uint value);//, bytes indexed data);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract Collateral {
    function getAllowedToMint() public view returns (uint amount);
    function groundAllowedToMint() public;
}

contract DAO {
    function getCollateralAddress() public view returns (address);
    function getDaoAddress() public view returns (address);
}

contract InterestToken is ERC20{
    using SafeMath for uint256;
    uint8 public constant decimals = 18;
    uint initialSupply = 1000*10**uint(decimals);

    string public constant name = "Interest Token";
    string public constant symbol = "INT";

    address public DaoAddress = address(0);
    DAO dao;

    mapping (address => uint) balances;
    mapping (address => mapping (address => uint)) allowed;


    event mintedForCollateral (uint amount, address reciever);
    event burnedFromCollateral (uint amount);

    function totalSupply() public view returns (uint) {
        return initialSupply;
    }

    function balanceOf(address owner) public view returns (uint balance) {
        return balances[owner];
    }

    function allowance(address owner, address spender) public view returns (uint remaining) {
        return allowed[owner][spender];
    }
    /*
        function transfer(address to, uint value, bytes memory data) public returns (bool success){
            uint codeLength;

            assembly {
                codeLength := extcodesize(to)
            }

            balances[msg.sender] = balances[msg.sender].sub(value);
            balances[to] = balances[to].add(value);
            if(codeLength>0) {
                ERC223ReceivingContract receiver = ERC223ReceivingContract(to);
                receiver.tokenFallback(msg.sender, value, data);
            }
            emit Transfer(msg.sender, to, value, data);
            return true;
        }
    */
    function transfer(address to, uint value) public returns (bool success){
        if (balances[msg.sender] >= value) {

            /*
                       uint codeLength;

                       assembly {
                       // Retrieve the size of the code on target address, this needs assembly .
                           codeLength := extcodesize(to)
                       }

                       bytes memory empty;
                       */
            balances[msg.sender] = balances[msg.sender].sub(value);
            balances[to] = balances[to].add(value);

            /*
                        if(codeLength>0) {
                            ERC223ReceivingContract receiver = ERC223ReceivingContract(to);
                            receiver.tokenFallback(msg.sender, value, empty);
                        }
            */
            emit Transfer(msg.sender, to, value);//, empty);
            return true;
        } else {
            return false;
        }
    }

    function transferFrom(address from, address to, uint value) public returns (bool success) {
        if (balances[from] >= value && allowed[from][msg.sender] >= value) {
            //bytes memory empty;
            balances[to] = balances[to].add(value);
            balances[from] = balances[from].sub(value);
            allowed[from][msg.sender] = allowed[from][msg.sender].sub(value);
            emit Transfer(from, to, value);//, empty);
            return true;
        } else {
            return false;
        }
    }

    function approve(address spender, uint value) public returns (bool success) {
        allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    constructor() public payable {
        balances[msg.sender] = initialSupply;
    }

    function setDaoAddress(address daoAddress) public {
        if (DaoAddress == address(0)) {
            DaoAddress = daoAddress;
            dao = DAO(DaoAddress);
        }
        else {
            DaoAddress = dao.getDaoAddress();
            dao = DAO(DaoAddress);
        }
    }

    function recieve() external payable {
        msg.sender.transfer(msg.value);// что тут делать?
    }

    function mintForCollateral() public returns (bool success) {
        uint amountToMint = Collateral(dao.getCollateralAddress()).getAllowedToMint();
        require (amountToMint>0, 'Minted amount should be positive');

        initialSupply = initialSupply.add(amountToMint);
        balances[msg.sender] = balances[msg.sender].add(amountToMint);
        emit mintedForCollateral(amountToMint, msg.sender);
        Collateral(dao.getCollateralAddress()).groundAllowedToMint();
        return true;
    }

    function burnFromCollateral() public returns (bool success){ // call only from CDP
        require(balances[dao.getCollateralAddress()]>0, 'Balance to burn should be posititve');
        initialSupply = initialSupply.sub(balances[dao.getCollateralAddress()]);
        emit burnedFromCollateral(balances[dao.getCollateralAddress()]);
        balances[dao.getCollateralAddress()] = 0;
        return true;
    }

    function authorizedContractTransfer(address contractAddressFrom, address to, uint value) public returns (bool success) {
        require (balances[contractAddressFrom] >= value);
        usingToken _contract = usingToken(contractAddressFrom);
        if (_contract.allowed(to) >= value) {
            require (_contract.transfered(to, value));
            balances[contractAddressFrom] = balances[contractAddressFrom].sub(value);
            balances[to] = balances[to].add(value);
            //bytes memory empty;
            emit Transfer(contractAddressFrom, to, value);//, empty);
            return true;
        }
        return false;
    }
}

contract usingToken{
    function allowed(address to) public view returns (uint _allowedValue) ;
    function transfered(address to, uint value) public returns (bool success);
}

/*

contract ERC223ReceivingContract {
    function tokenFallback(address _from, uint _value, bytes memory _data) public;
}
*/