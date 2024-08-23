
“Only when the last tree has died and the last river been poisoned and the last fish been caught will we realise we cannot eat money” — Cree Indian Proverb.


Introduction
===================================

About
------------------------------------
As the blockchain any cryptocurrencies emerged, appeared an opportunity to posses assets and transfer them securely and with no authority.
But cryptocurrencies themselves are volatile, so people invented stablecoins - coins, which are somehow pegged to fiat currencies exchange rates.
Some of them are backed, but even in this case, it is hard to check the collateral, because it is kept outside the blockchain.
And even if you can check the fact of collateral existence, it is hard to guarantee that it will be used for its purposes if something goes wrong.

For that reason the dotflat was created - the collateral is always kept on the blockchain and can be obtained as the terms are completed.

Another reason to create new stablecoin is to avoid connection with fiat currencies. The evident reason is inflation which can not be controlled.
For that purpose we decided to create a stablecoin, pegged to some basket of goods and commodities to make them stable against inflation.

.. note::
    This introduction text

Dotflat
--------------------------

Dotflat is a collateralized stablecoin with permanent purchasing power and credit type of emission.
Collateralized means that each dotflat is emitted only if sufficient collateral in ether is provided.
Collateral is stored on the smart contract, so you can always check it by yourself on etherscan or any other blockchain explorer.

What do we mean by permanent purchasing power? As we all know, fiat currencies suffer inflation. Than means, that you can buy less eggs, coffee, meat or whatever
with 10 dollars today, than 10 years before. So, stablecoins like USDT are stable only if you compare it with US dollar. We decided to make dotflat coin stable
against the basket of commoditis, which include such goods as rice, orange juice, coffee, pork, copper, gold and so on.

The change of the quotes on the exchanges are an online indicator for the system. Holding dotflat means, that in future you will be able to buy in average the same amount of those commodities.

Interest DAO
--------------------------
`DAO <https://en.wikipedia.org/wiki/Decentralized_autonomous_organization>`_ stands for decentralized autonomous organization with no
central authority. It is in whole is managed and regulated by its interconnected smart contracts.
The smart contract is a program, executed on a blockchain, as if articles of association are written in code and executed automatically.
All the code is permanent and can not be changed by anybody. Only the parameters of the system may by changed from their initial values
by the voting among governance token holders. The governance tokens of Interest DAO are called Rule tokens.
Anybody is free to obtain Rules on the Auction or elsewhere, so the DAO becomes decentralized and regulated by the community.

More detailed terms of DAO are described in contract section.

FAQ
------------------------------------

How is it collateralized?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Dotflat is a collateralized with excessive amount of native cryptocurrency - the ether. Each piece of ether is held on the contract with a discount.
For example, if 100 dotflat coins were minted, it means that the balance of CDP contract should not be less then ether, sufficient to buy 142.85 dotflat.

Why is it stable?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Dotflat is pegged to basket price in the code. If the basket price raise, holder of debt position should increase collateral or decrease emission.

What is an indicative price?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Indicative price is the price on which smart-contract are oriented. It is calculated as 1 US dollar * (price change of the basket since deploy).
Market prices of dotflat may vary, but they tend to be equal to indicative.

What is the stabilization fund and how it is refilled?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Coming soon

Were does annual interest on deposit come from?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Coming soon

What if stabilization fund is empty?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Coming soon

What if stabilization fund is empty?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Coming soon