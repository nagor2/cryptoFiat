# DFC Token — Supply & Distribution

DFC (DotFlat Coin) is a collateralized stablecoin. It has no fixed supply, no pre-allocated tokens, no ICO, and no team allocation.

## How DFC is issued

All DFC in circulation is minted by users who deposit ETH as collateral into CDP (Collateralized Debt Position) smart contracts. The protocol is overcollateralized: the ETH collateral value must exceed the DFC minted.

When a user repays their CDP debt, the corresponding DFC is burned. Supply expands and contracts dynamically based on collateral activity.

## Supply mechanics

| Parameter | Value |
|---|---|
| Supply type | Dynamic (algorithmic) |
| Minting | Via CDP — deposit ETH, receive DFC |
| Burning | Via CDP repayment |
| Team allocation | None |
| Investor allocation | None |
| Pre-mine | None |
| Collateral ratio | Overcollateralized (ETH) |

## Verification

Current circulating supply is verifiable on Etherscan at any time:  
https://etherscan.io/token/0x1F709Cfa0C409E158C68EdcD32453809c9Eb69EE

## Similar models

This model is identical to MakerDAO (DAI) and Liquity (LUSD) — supply is fully determined by user collateral positions, not by any central issuer.
