require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true // Needed for complex contracts to avoid "Stack too deep"
    }
  },
  
  networks: {
    // Hardhat Network (встроенная)
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        accountsBalance: "10000000000000000000000" // 10000 ETH
      }
    },
    
    // Локальная сеть
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    }
  },
  
  // Gas reporter configuration
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD"
  },
  
  // Paths
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  // Mocha timeout
  mocha: {
    timeout: 40000
  }
};
