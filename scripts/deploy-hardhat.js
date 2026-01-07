// Пример скрипта деплоя для Hardhat
// Использование: npx hardhat run scripts/deploy-hardhat.js --network <network_name>

const hre = require("hardhat");

async function main() {
  console.log("🚀 Начало деплоя контрактов...\n");

  // Получаем deployer аккаунт
  const [deployer] = await ethers.getSigners();
  console.log("📝 Деплой с аккаунта:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("💰 Баланс аккаунта:", ethers.utils.formatEther(balance), "ETH\n");

  // Пример деплоя контракта (замените на ваши контракты)
  console.log("📦 Деплой контрактов cryptoFiat...\n");

  // Здесь можно добавить деплой ваших контрактов
  // Например:
  /*
  const FlatCoin = await ethers.getContractFactory("flatCoin");
  const flatCoin = await FlatCoin.deploy();
  await flatCoin.deployed();
  console.log("✅ FlatCoin развернут:", flatCoin.address);

  const CDP = await ethers.getContractFactory("CDP");
  const cdp = await CDP.deploy(flatCoin.address);
  await cdp.deployed();
  console.log("✅ CDP развернут:", cdp.address);
  */

  console.log("\n🎉 Деплой завершён успешно!");
  console.log("\n📋 Сохраните адреса контрактов для дальнейшего использования");
}

// Запуск скрипта
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Ошибка при деплое:", error);
    process.exit(1);
  });

