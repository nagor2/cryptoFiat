# dotFlat — Collateralized Stablecoin Protocol

A MakerDAO-style collateralized stablecoin system on Ethereum, built solo from scratch.  
Users lock ETH as collateral to mint **DFC (dotFlat Coin)** — a stablecoin designed for permanent purchasing power.

---

## Architecture

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

## Contracts

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

## Key Design Decisions

- **Commit-reveal auctions** — `AuctionCommitReveal.sol` implements commit-reveal to prevent MEV front-running (in development; deployed auction uses standard scheme)
- **Liquidation state machine** — positions go through `ok → markedOnLiquidation → onLiquidation → liquidated / closed`, with a time buffer before liquidation finalizes
- **DAO-gated minting** — only DAO-authorized contracts can mint or burn DFC
- **ReentrancyGuard** on CDP and Auction — guards against re-entrancy in ETH-handling paths
- **Interest accrual** — per-position interest tracked via `interestAmountRecorded` and `lastTimeUpdated`

## Tech Stack

- **Solidity** 0.8.19
- **Hardhat** (primary) + **Truffle** (cross-validation)
- **OpenZeppelin** v4.9 (ERC-20, ReentrancyGuard, access control)
- **ethers.js** v6 + **TypeChain** (type-safe contract interactions)
- **Mocha / Chai** — contract tests
- **Docker** — local Hardhat node

## Getting Started

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

## Deployed Contracts (Ethereum Mainnet)

| Contract | Address |
|---|---|
| INTDAO (governance) | [0x55Ead3b40016b1d5417F5A20F2d1E53e2d1c9122](https://etherscan.io/address/0x55Ead3b40016b1d5417F5A20F2d1E53e2d1c9122) |
| CDP | [0xbCf58DE37791eFe60fE87a6d420FE8F7AEA99ef8](https://etherscan.io/address/0xbCf58DE37791eFe60fE87a6d420FE8F7AEA99ef8) |
| flatCoin (DFC, ERC-20) | [0x1F709Cfa0C409E158C68EdcD32453809c9Eb69EE](https://etherscan.io/address/0x1F709Cfa0C409E158C68EdcD32453809c9Eb69EE) |
| Deposit | [0x44881F5ac2938AAaF4260d7DBE18997318788f9f](https://etherscan.io/address/0x44881F5ac2938AAaF4260d7DBE18997318788f9f) |
| Auction | [0xBdFb52d4C9fBdE41805abBb206465aca3b3499D6](https://etherscan.io/address/0xBdFb52d4C9fBdE41805abBb206465aca3b3499D6) |
| Rule Token | [0x3Dfa45997ddB7980Eb4D73CBfCf0E024F05b08a3](https://etherscan.io/address/0x3Dfa45997ddB7980Eb4D73CBfCf0E024F05b08a3) |
| Exchange Rate | [0x1DF609afDC67396a9f307de2BA3E3b667dEe8b5B](https://etherscan.io/address/0x1DF609afDC67396a9f307de2BA3E3b667dEe8b5B) |

All contracts verified on Etherscan (source code exact match, Solidity 0.8.26, optimized).

## Project Status

Protocol deployed on Ethereum mainnet with verified contracts. Frontend (React + ethers.js + Uniswap SDK) lives in the companion repo [app-dotflat](https://github.com/yourusername/app-dotflat).
