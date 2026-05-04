# 🪙 dotFlat — Collateralized Stablecoin Protocol

![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=for-the-badge&logo=solidity&logoColor=white)
![Hardhat](https://img.shields.io/badge/Hardhat-2.20-F7DF1E?style=for-the-badge&logo=hardhat&logoColor=black)
![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-4.9-4E5EE4?style=for-the-badge&logo=openzeppelin&logoColor=white)
![License](https://img.shields.io/badge/License-UNLICENSED-red?style=for-the-badge)

A MakerDAO-style collateralized stablecoin system on Ethereum, built solo from scratch.  
Users lock ETH as collateral to mint **DFC (dotFlat Coin)** — a stablecoin designed for permanent purchasing power.

[![dApp](https://img.shields.io/badge/dApp-beta.app.dotflat.io-blue?style=for-the-badge&logo=googlechrome&logoColor=white)](https://beta.app.dotflat.io)
[![Docs](https://img.shields.io/badge/Docs-docs.dotflat.io-green?style=for-the-badge&logo=readthedocs&logoColor=white)](https://docs.dotflat.io)

---

## 🏗️ Architecture

```
┌─────────────┐     mint/burn      ┌──────────────┐
│    CDP      │◄──────────────────►│  flatCoin    │
│  (core)     │                    │  ERC-20 DFC  │
└──────┬──────┘                    └──────────────┘
       │ liquidation
       ▼
┌─────────────┐     governance     ┌──────────────┐
│   Auction   │◄──────────────────►│   INTDAO     │
│commit-reveal│                    │  governance  │
└──────┬──────┘                    └──────────────┘
       │ price feeds
       ▼
┌─────────────┐
│   Basket    │  multi-asset price oracle
└─────────────┘
```

## 📄 Contracts

| Contract | Description |
|---|---|
| `CDP.sol` | Core: collateral deposits, DFC minting, interest accrual, liquidation state machine |
| `flatCoin.sol` | ERC-20 stablecoin (DFC), DAO-authorized mint/burn |
| `AuctionCommitReveal.sol` | Liquidation auctions with **commit-reveal scheme** (anti-frontrun) |
| `Auction.sol` | Standard auction for rule buyouts and stabilization |
| `INTDAO.sol` | Governance: system parameters, authorized addresses |
| `Deposit.sol` | Deposit management |
| `basket.sol` | Multi-collateral price aggregator |
| `exchangeRateContract.sol` | On-chain exchange rate interface |
| `Rule.sol` | Governance rule parameters |

## 🔑 Key Design Decisions

- 🕵️ **Commit-reveal auctions** — `AuctionCommitReveal.sol` implements commit-reveal to prevent MEV front-running (in development; deployed auction uses standard scheme)
- ⚙️ **Liquidation state machine** — positions go through `ok → markedOnLiquidation → onLiquidation → liquidated / closed`, with a time buffer before liquidation finalizes
- 🔒 **DAO-gated minting** — only DAO-authorized contracts can mint or burn DFC
- 🛡️ **ReentrancyGuard** on CDP and Auction — guards against re-entrancy in ETH-handling paths
- 📈 **Interest accrual** — per-position interest tracked via `interestAmountRecorded` and `lastTimeUpdated`

## 🛠️ Tech Stack

![Solidity](https://img.shields.io/badge/Solidity-363636?style=flat-square&logo=solidity&logoColor=white)
![Hardhat](https://img.shields.io/badge/Hardhat-F7DF1E?style=flat-square&logo=hardhat&logoColor=black)
![ethers.js](https://img.shields.io/badge/ethers.js-v6-2535a0?style=flat-square)
![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-4E5EE4?style=flat-square&logo=openzeppelin&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Mocha](https://img.shields.io/badge/Mocha-8D6748?style=flat-square&logo=mocha&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

## 🚀 Getting Started

```bash
npm install

# compile
npx hardhat compile

# run local node
npx hardhat node

# deploy
npx hardhat run scripts/deploy.js --network localhost

# tests
npx hardhat test
```

## 🌐 Deployed Contracts (Ethereum Mainnet)

| Contract | Address |
|---|---|
| INTDAO (governance) | [0x55Ead3b40016b1d5417F5A20F2d1E53e2d1c9122](https://etherscan.io/address/0x55Ead3b40016b1d5417F5A20F2d1E53e2d1c9122) |
| CDP | [0xbCf58DE37791eFe60fE87a6d420FE8F7AEA99ef8](https://etherscan.io/address/0xbCf58DE37791eFe60fE87a6d420FE8F7AEA99ef8) |
| flatCoin (DFC, ERC-20) | [0x1F709Cfa0C409E158C68EdcD32453809c9Eb69EE](https://etherscan.io/address/0x1F709Cfa0C409E158C68EdcD32453809c9Eb69EE) |
| Deposit | [0x44881F5ac2938AAaF4260d7DBE18997318788f9f](https://etherscan.io/address/0x44881F5ac2938AAaF4260d7DBE18997318788f9f) |
| Auction | [0xBdFb52d4C9fBdE41805abBb206465aca3b3499D6](https://etherscan.io/address/0xBdFb52d4C9fBdE41805abBb206465aca3b3499D6) |
| Rule Token | [0x3Dfa45997ddB7980Eb4D73CBfCf0E024F05b08a3](https://etherscan.io/address/0x3Dfa45997ddB7980Eb4D73CBfCf0E024F05b08a3) |
| Exchange Rate | [0x1DF609afDC67396a9f307de2BA3E3b667dEe8b5B](https://etherscan.io/address/0x1DF609afDC67396a9f307de2BA3E3b667dEe8b5B) |

✅ All contracts verified on Etherscan (source code exact match, Solidity 0.8.26, optimized).

## 🧪 Tests

![Tests](https://img.shields.io/badge/Tests-101%20passing-brightgreen?style=for-the-badge&logo=mocha&logoColor=white)
![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen?style=for-the-badge)

All 101 automated tests pass, covering all critical use cases across the full contract suite:

| Suite | Coverage |
|---|---|
| CDP — open, update, close, withdraw | ✅ |
| CDP — fee accrual & interest calculation | ✅ |
| CDP — margin call & liquidation trigger | ✅ |
| CDP — several auctions to close a position | ✅ |
| Auction — standard bidding & finalization | ✅ |
| Auction — stab fund buyout (coins buyout for stabilization) | ✅ |
| Deposit — open, top-up, interest, withdraw | ✅ |
| DAO — governance parameters & voting | ✅ |
| FlatCoin — mint, burn, transfer, events | ✅ |
| Rule token — supply, parameters | ✅ |
| Basket — multi-asset price aggregation | ✅ |
| Exchange Rate — price feed interface | ✅ |
| Future address calculation — deterministic deployment | ✅ |

Tests are written in Hardhat + ethers.js v6 + Chai and run in an isolated in-process Hardhat Network (no external node needed).

```bash
npm test
# 101 passing (2s)
```

## 📦 Project Status

Protocol deployed on Ethereum mainnet with verified contracts. Frontend (React + ethers.js + Uniswap SDK) lives in the companion repo [app-dotflat](https://github.com/nagor2/fiatApp).

## 🔗 Links

- 💻 **dApp:** [beta.app.dotflat.io](https://beta.app.dotflat.io)
- 📚 **Docs:** [docs.dotflat.io](https://docs.dotflat.io) — Sphinx-generated autodocs covering contract interfaces, architecture, and integration guides
