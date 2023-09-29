// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IDAO{
function addresses(string memory) external view returns (address);
function params(string memory) external view returns (uint256);
function setAddressOnce(string memory, address) external;
function isAuthorized(address candidate) external view returns (bool);
}

interface IERC20MintableAndBurnable is IERC20{
function mint(address to, uint256 amount) external;
function burn(address from, uint256 amount) external;
}

interface IAuction{
function initCoinsBuyOut(uint256 posID, uint256 collateral) external returns (uint256 auctionID);
function isFinalized(uint256 auctionId) external view returns (bool finalized);
function claimToFinalizeAuction(uint256 auctionID) external returns (bool success);
function getPaymentAmount(uint256 auctionID) external view returns (uint256);
function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) external returns (uint256 auctionID);
}

interface ICart{
function getPrice(string memory symbol) external view returns (uint256);
function getDecimals(string memory symbol) external view returns (uint8);
}

contract CDP {
uint256 public numPositions;
IDAO immutable dao;
ICart oracleCart;
IERC20MintableAndBurnable coin;
IAuction auction;
IERC20MintableAndBurnable rule;
IERC20 weth;

struct Position {
//1 slot
uint128 coinsMinted; //uint128128
uint128 wethAmountLocked;//uint128
//2 slot
uint128 interestAmountRecorded;//uint128
uint32 timeOpened; // time uint32
uint32 lastTimeUpdated;
uint32 markedOnLiquidationTimestamp;
uint32 liquidationAuctionID;//uint32 max    4 294 967 295
//3 slot
uint24 interestRate; //uint24 max 16 777 215
uint24 onLiquidation;                // bool   true 1   false 0
uint24 liquidated;                   // bool   true 1   false 0
uint24 restrictInterestPay;   // bool   true 1   false 0
address owner;
}

mapping(uint256 => Position) public positions;
event PositionOpened (address owner, uint256 posID);
event PositionUpdated (uint256 posID, uint256 newStableCoinsAmount, uint256 wethLocked);
event markedOnLiquidation (uint256 posID, uint256 timestamp);
event markOnLiquidationErased (uint256 posID, uint256 timestamp);
event OnLiquidation (uint256 posID, uint256 timestamp);

constructor(address INTDAOaddress){
dao = IDAO(INTDAOaddress);
dao.setAddressOnce("cdp",address(this));
dao.setAddressOnce("inflationSpender",address(this));
renewContracts();
}

function renewContracts() public{
coin = IERC20MintableAndBurnable(dao.addresses("stableCoin"));
rule = IERC20MintableAndBurnable(dao.addresses("rule"));
oracleCart = ICart(dao.addresses("cart"));
auction = IAuction(dao.addresses("auction"));
weth = IERC20(dao.addresses("weth"));
}

function openCDP(uint256 stableCoinsToMint) external payable returns (uint256){
stableCoinsToMint = (stableCoinsToMint > getMaxStableCoinsToMint(msg.value))
? getMaxStableCoinsToMint(msg.value)
: stableCoinsToMint;
require (stableCoinsToMint >= dao.params("minCoinsToMint"), "you can not mint less than 1 coin");
numPositions++;
Position storage p = positions[numPositions];
p.coinsMinted = uint128(stableCoinsToMint);
p.wethAmountLocked = uint128(msg.value);
(bool successTransfer, ) = dao.addresses("weth").call{value: msg.value}("");
require(successTransfer, "Could not pass funds to weth contract for some reason");
p.owner = msg.sender;
p.timeOpened = uint32(block.timestamp);
p.lastTimeUpdated = uint32(block.timestamp);
p.interestRate = uint24(dao.params("interestRate"));
coin.mint(msg.sender, stableCoinsToMint);
emit PositionOpened(p.owner, numPositions);
return numPositions;
}

function closeCDP(uint256 posID) external {
Position storage p = positions[posID];
require(p.owner == msg.sender, "Only owner may close his position");
require(p.onLiquidation==0, "This position is on liquidation");
require(p.liquidated==0, "This position is liquidated");
p.liquidated = 1;
uint256 overallDebt = getTotalCurrentFee(posID)+p.coinsMinted;
(bool success, bytes memory response) = address(coin).call(
abi.encodeWithSignature(
"transferFrom(address,address,uint256)",
p.owner,
address(this),
overallDebt)
);
require(success && abi.decode(response, (bool)), "Failed send funds");
(bool success1, ) = address(weth).call(
abi.encodeWithSignature(
"transfer(address,uint256)",
p.owner,
p.wethAmountLocked)
);
require(success1, "Failed to send funds!");
coin.burn(address(this), p.coinsMinted);
}

function updateCDP(uint posID, uint newStableCoinsAmount) external payable returns (bool success){
Position storage p = positions[posID];
require(p.onLiquidation==0, "This position is on liquidation");
require(p.owner == msg.sender, "Only owner may update the position");
require (newStableCoinsAmount >= dao.params("minCoinsToMint"), "you can not mint less than 1 coin");

p.interestAmountRecorded += uint128(getInterestAmountUnrecorded(posID));
p.lastTimeUpdated = uint32(block.timestamp);

if (msg.value>0) {
p.wethAmountLocked += uint128(msg.value);
(bool successTransfer, ) = dao.addresses("weth").call{value: msg.value}("");
require(successTransfer, "Could not pass funds to weth contract for some reason");
}

require(getMaxStableCoinsToMintForPos(posID) >= newStableCoinsAmount, "not enough collateral to mint amount");
if (newStableCoinsAmount > p.coinsMinted) {
uint256 difference = newStableCoinsAmount - p.coinsMinted;
coin.mint(p.owner, difference);
p.coinsMinted = uint128(newStableCoinsAmount);
}
if (newStableCoinsAmount < p.coinsMinted) {
uint256 difference = p.coinsMinted - newStableCoinsAmount;
require(coin.balanceOf(p.owner)>=difference);
coin.burn(p.owner, difference);
p.coinsMinted = uint128(newStableCoinsAmount);
}
emit PositionUpdated(posID, newStableCoinsAmount, p.wethAmountLocked);
return true;
}

function transferInterest(uint256 posID) external{
Position storage p = positions[posID];
if (p.restrictInterestPay==1){
require(p.owner == msg.sender, "Only owner may transfer interest");
}
require(p.onLiquidation==0, "This position is on liquidation");
(bool success, bytes memory response) = address(coin).call(
abi.encodeWithSignature(
"transferFrom(address,address,uint256)",
p.owner,
address(this),
getTotalCurrentFee(posID))
);
require(success && abi.decode(response, (bool)), "Failed send funds");
p.interestAmountRecorded = 0;
p.lastTimeUpdated = uint32(block.timestamp);
}

function markToLiquidate(uint256 posID) external{
Position storage p = positions[posID];
require (p.markedOnLiquidationTimestamp == 0 && p.onLiquidation==0, "This position is on liquidation or already marked");
require(getMaxStableCoinsToMintForPos(posID) < p.coinsMinted);
p.markedOnLiquidationTimestamp = uint32(block.timestamp);
emit markedOnLiquidation (posID, block.timestamp);
}

function eraseMarkToLiquidate(uint posID) external{
Position storage p = positions[posID];
require (p.markedOnLiquidationTimestamp !=0 && p.onLiquidation==0 && p.liquidated==0,
"This position is not marked or locked/liquidated");
require(getMaxStableCoinsToMintForPos(posID) > p.coinsMinted);
p.markedOnLiquidationTimestamp = 0;
emit markOnLiquidationErased (posID, block.timestamp);
}

function claimMarginCall(uint256 posID) external returns (bool success){
Position storage p = positions[posID];
require (p.markedOnLiquidationTimestamp >0 &&
block.timestamp - p.markedOnLiquidationTimestamp > dao.params("marginCallTimeLimit"),
"Position is not marked on liquidation or owner still has time");
require(p.onLiquidation==0 && p.liquidated==0, "Position is already on liquidation or already liquidated");
if (getMaxStableCoinsToMintForPos(posID) < p.coinsMinted) {
p.onLiquidation = 1;
uint256 currentAllowance = weth.allowance(dao.addresses("cdp"), dao.addresses("auction"));
require(weth.approve(dao.addresses("auction"), currentAllowance+p.wethAmountLocked), "could not approve weth for some reason");
emit OnLiquidation(posID, block.timestamp);
return true;
}
else {
p.markedOnLiquidationTimestamp = 0;
return false;
}
}

function startCoinsBuyOut(uint256 posID) external{
Position storage p = positions[posID];
require (p.onLiquidation==1 && p.liquidated==0 && p.liquidationAuctionID == 0,
"Position is not on liquidation or already liquidated, or auction was already started");
uint amount = p.wethAmountLocked;
p.wethAmountLocked = 0;
p.liquidationAuctionID = uint32(auction.initCoinsBuyOut(posID, amount));
}

function finishMarginCall(uint256 posID) external{
Position storage p = positions[posID];
require(p.onLiquidation==1 && p.liquidated==0 && p.liquidationAuctionID !=0,
"Position is not on liquidation or was already liquidated or auction was not started");
if (!auction.isFinalized(p.liquidationAuctionID))
require(auction.claimToFinalizeAuction(p.liquidationAuctionID),
"could not finalize auction");
uint256 paymentAmount = auction.getPaymentAmount(p.liquidationAuctionID);

if (paymentAmount >=p.coinsMinted){
uint256 overallDebt = p.coinsMinted + getTotalCurrentFee(posID) + p.coinsMinted * dao.params("liquidationFee") / 100;
if (paymentAmount > overallDebt)
coin.transfer(p.owner, paymentAmount - overallDebt);
coin.burn(address(this), p.coinsMinted);
p.liquidated = 1;
return;
}
else {
if (coin.balanceOf(address(this)) >= p.coinsMinted){
coin.burn(address(this), p.coinsMinted);
p.liquidated = 1;
return;
}
else {
uint256 toBurn = coin.balanceOf(address(this));
coin.burn(address(this), toBurn);
p.coinsMinted -= uint128(toBurn);
auction.initCoinsBuyOutForStabilization(p.coinsMinted);
}
}
}

function withdrawEther (uint256 posID, uint256 etherToWithdraw) external {
Position storage p = positions[posID];
require(p.onLiquidation==0 && p.liquidated==0, "This position is on liquidation or liquidated");
require(p.owner == msg.sender, "Only owner may update the position");
require (etherToWithdraw<p.wethAmountLocked, "You dont have enough weth locked on this pos");
uint256 wethToLeave = p.wethAmountLocked - etherToWithdraw;
uint256 maxCoins = getMaxStableCoinsToMint(wethToLeave) - getTotalCurrentFee(posID);
require (maxCoins>p.coinsMinted, "you want to keep not enough weth to cover emission and current fee");
p.wethAmountLocked -= uint128(etherToWithdraw);
weth.transfer(msg.sender, etherToWithdraw);
emit PositionUpdated (posID, p.coinsMinted, p.wethAmountLocked);
}

function allowSurplusToAuction() external{
uint256 stabilizationFundAmount = dao.params("stabilizationFundPercent")*coin.totalSupply()/100;
require (coin.balanceOf(address(this)) >= stabilizationFundAmount, "insufficient funds on CDP contract");
uint256 surplus = coin.balanceOf(address(this)) - stabilizationFundAmount;
require (surplus >= dao.params("minCDPBalanceToInitBuyOut"), "not enough surplus to start buyOut");
require (coin.approve(dao.addresses("auction"), surplus), "could not approve coins for some reason");
}

function burnRule() external{
rule.burn(address(this), rule.balanceOf(address(this)));
}

function mintRule(address to, uint256 amount) external returns (bool success){
require (msg.sender == dao.addresses("auction"), "Only auction is allowed to claim mint");
rule.mint(to, amount);
return true;
}

function switchRestrictInterestPay(uint256 posID) external{
Position storage p = positions[posID];
require (p.owner == msg.sender, "Only owner may set this property");
p.restrictInterestPay == 0 ? p.restrictInterestPay=1 : p.restrictInterestPay=0;
}

///↓↓↓↓↓↓// Only Authorized //↓↓↓↓↓↓//
////////////////////////////
function claimInterest(uint256 amount, address beneficiary) external{
require(dao.isAuthorized(msg.sender), "only authorized address may do this");
if (coin.balanceOf(address(this))>amount)
coin.transfer(beneficiary, amount);
else {
uint256 difference = amount - coin.balanceOf(address(this));
coin.transfer(beneficiary, coin.balanceOf(address(this)));
coin.approve(beneficiary, difference+coin.allowance(address(this), beneficiary));
}
}

function claimEmission(uint256 amount, address beneficiary) external{
require(dao.isAuthorized(msg.sender), "only authorized address may do this");
coin.mint(beneficiary,amount);
}
///↓↓↓↓↓↓// GETTER //↓↓↓↓↓↓//
////////////////////////////
function getTotalCurrentFee(uint256 posID) public view returns (uint256 fee){                    //+
return positions[posID].interestAmountRecorded + getInterestAmountUnrecorded(posID);        //+
}

function getInterestAmountUnrecorded(uint256 posID) public view returns (uint256 interestAmount) { //+
Position storage p = positions[posID];
return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 100 / 365 days; // +
}

function getMaxStableCoinsToMint(uint256 ethValue) public view returns (uint256) { /// посмотреть
uint256 price = oracleCart.getPrice("stb");
uint256 decimals = oracleCart.getDecimals("etc");
return ethValue * price * (100 - dao.params("collateralDiscount"))/(10**decimals)/100;
}

function getMaxStableCoinsToMintForPos(uint256 posID) public view returns (uint256 maxAmount){   //+
return getMaxStableCoinsToMint(positions[posID].wethAmountLocked) - getTotalCurrentFee(posID); //+
}
}


1. 	IDAO immutable dao;
2.	удалил лишнюю переменную posID
3. 	убрал payable из конструктора
4. 	изменил структуру Position
5. 	в контракте ИнТДАо можно еще оптимизировать количество используемого газа за счет изменения bool => 0/1
6. 	function getMaxStableCoinsToMint обсудить метод рассчета цены.

!!7. 	 p.interestAmountRecorded = 0; убрал по умолчанию 0.
8. 	(bool successTransfer, ) = dao.addresses("weth").call{value: msg.value}(""); зачем происходит конвертация
ETC в WETC?
!!9. 	function interestAmountUnrecorded(uint256 posID) public view returns (uint256 interestAmount) {
Position storage p = positions[posID];
return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 31536000 / 100;
}
заменил на
function getInterestAmountUnrecorded(uint256 posID) public view returns (uint256 interestAmount) {
Position storage p = positions[posID];
return p.coinsMinted * (block.timestamp - p.lastTimeUpdated) * p.interestRate / 100 / 365 days;
}
!!10. 	В функции closeCDP не проверяется закрыта позиция или нет. p.liquidated  Предлагаю проверять и не делать лишних изменений
стейта по занулению переменных.

TODO://11. 	require (coin.approve(dao.addresses('auction'), surplus), "could not approve coins for some reason"); зачем такая методика, почему
сразу не произвести трансфер? А если кто-то выдаст больший апрув для своего удобства.


!! 12. 	в функции markToLiquidate заменил if на require
13. 	юзер может закрывать долговую позицию  closeCDP при маркированой к ликвидации позиции?
!!14. 	в функции eraseMarkToLiquidate заменил if на require
15. 	Вы же понимаете что цена может изменяться каждую секунду и будет разный результат getMaxStableCoinsToMintForPos(posID)
а от него зависит маркировка на ликвидацию и позиция может менять свой статус очень часто. Кто будет вызывать эти функции, бот ?

!!16. 	В функции updateCDP вынес строки emit PositionUpdated(posID, newStableCoinsAmount, p.wethAmountLocked);
return true;
за if

if (newStableCoinsAmount == p.coinsMinted) {
} - удалил
!!17.	  function withdrawEther нет require require(p.onLiquidated==0,) добавил
18.	 require (etherToWithdraw<p.wethAmountLocked, "You dont have enough weth locked on this pos"); вот тут возможно
нужно <=       ?
19.
20.	  В функции burnRule() не нужен require (msg.sender == dao.addresses("auction"), "Only auction is allowed to burn");?

function burnRule() external{
rule.burn(address(this), rule.balanceOf(address(this)));
}



21.	Если surplus = 1mln., то все будет перемещенно 	coin.transferFrom(dao.addresses("cdp"), address(this), allowed);
, но потом при желании вызвать повторно initRuleBuyOut вот этот require (allowed>0, не пройдет.
И получится что на балансе СК аукциона 1 млн., а выкупить токены он не может. Или я не понимаю логики функции.
17.00 8 часов
22. 	В СК exchangeRateContract нет определения цены инструмента при его первоначальном добавлении, нет модификации поля
instruments[dictionary[symbol].id].price. Определение цены происходит только при апдейте. Почему так?
23. 	    migrations/2_deploy_contracts.js вот тут деплой и начинаются задавать параметры
await eRC.addInstrument("etc", "Ethereum", 6, {from: exRAuthour});
await eRC.updateSinglePrice(0, 3100000000, {from: exRAuthour});
Это не правильно заданные параметры. В функции сначала делается инкремент =>  ETC будет иметь id = 1.

Перепроверить!! (2 теста)

24. 	В СК cart  функция  getCurrentSharePrice() не отработает, т.к. при добавлении item в функции addItem сначала происходит
инкремент, а потом под этим ключом записывается значение в мэппинг.
Соответственно itemsCount для первого item будет = 1.
for (uint256 j = 0; j < itemsCount; j ++) {  надо менять
на for (uint256 j = 1; j < itemsCount+1; j ++) {
10 13:00

Добавить пару тестов!!

25.	await eRC.addInstrument("etc", "Ethereum", 6, {from: exRAuthour}); почему в СК оракула передается ETC с 6 decimals?
26. 	Зачем хранить decimals инстументов  в exchangeRateContract ?
27. 	Зачем в СК exchangeRateContract  2 структуры отвечающие за 1 элемент?
28. 	Зачем в СК cart в функции addItem() поле newCartItem.exists = true;
29. 	В СК exchangeRateContract через функцию CONTRACT_ERC.updateSinglePrice апдейтер может устанавливать цену несуществующим инструментам.
30.	В СК exchangeRateContract мы устанавливаем decimals для Gold. Обсудить.
31.	Почему при запросе await CONTRACT_ERC.connect(owner).dictionary("Gold") пользователь не получаю цену?
32.	Почему при добавлении etc await CONTRACT_ERC.addInstrument("etc", "Ethereum", 6); мы должны указать 6 decimals?
33.

x = a*0.4+b*0.4+c*0.2=800+6+92=

1) gold 2000, lamber 1000
gold 40 shares, lamber 20 shares


totalShares = 60


(2000*40+1000*20)/60 = 1666.(6)


2) gold 2200, lamber 2000

(2200*40+2000*20)/60 = 2133.(3) +28%

etc 3100, discount 30% - > 2170

gold, lumber up, -> stb -> up





	
	
