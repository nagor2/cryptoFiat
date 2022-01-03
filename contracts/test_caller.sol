contract interestToken {
    function totalSupply() public view returns (uint supply);
    function balanceOf(address who) public view returns (uint value);
    function allowance(address owner, address spender) public view returns (uint remaining);

    function transfer(address to, uint value) public returns (bool ok);
    function transferFrom(address from, address to, uint value) public returns (bool ok);
    function approve(address spender, uint value) public returns (bool ok);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    function mintForAuction(uint amount, address winner) public returns (bool success); //call only from CDP
    function burnINTtoken(uint amount) public returns (bool success); //call only from CDP
}

contract test_caller {
    interestToken public INT;

    constructor() public {
    }

    function setINT (address ad) public {
        INT = interestToken (ad);
    }

    function call() public {
        INT.mintForAuction(100, address (this));
    }
}
