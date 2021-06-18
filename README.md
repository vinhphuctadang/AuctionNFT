# Traditional english Auction for NFT
---

## Features

- Create auction for nfts from different erc721 contracts
- Allow participant (player) to bid and withdraw their bid, extends the match if new top bid made
- Reward nft on finished match
- Creator withdraw profit from their auctions


## Run ?

1. Setup environment

* nodejs

Used nodejs v10.21, installed using ``nvm``. 

To install nvm:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
nvm install 10.21
```

Learn more at ``https://github.com/nvm-sh/nvm``

Can also install from https://nodejs.org/en/

* ganache

Use Ganache-cli (docker container version) as a blockchain emulator

```
docker run -d -p 7777:8545 trufflesuite/ganache-cli
```

* install packages:

```
git clone https://github.com/vinhphuctadang/AuctionNFT
cd AuctionNFT
npm i
```

* install truffle 

```
npm i -g truffle
```

2. Run tests

```
truffle test
```

Please make sure all tests work fine before exploring the source

## Contracts details:
- Helper contract: just a temp contract for testing purpose
- MockyEarch, MockyMars: 2 nft mock contract, both implements ERC721 standard, using @openzeppelin tempaltes

- Auction: Main contract for nft auction


```
function createAuction(string memory matchId, uint96 openBlock, uint96 expiryBlock, uint32 expiryExtension, uint96 minIncrement, NFT[] memory nfts) external nonReentrant
```

* Person creating the match is called ``creator``

* Creates an auction, creator can choose a unique ``matchId``, choose an ``openBlock`` and ``expiryBlock``, which will enable player bidding when ``openBlock`` mined and expires after expired after ``expiryBlock`` has been mined. 

* Creator can set ``expxiryExtension``, so that in the event of match's deadline, if there is someone bidding higher then the match expiryBlock will be increased by ``expxiryExtension``

* Allows setting min increment (percentage based) for all nfts, each nft has min bidding value

---

```
function player_bid(string memory matchId, uint tokenIndex, uint amount) external nonReentrant validTokenIndex(matchId, tokenIndex)
```

* Bids value for nft in a match. ``matchId`` represents the match player would like to bid, the ``tokenIndex`` denotes which token (ordered) will be bidded.

* User should approve the contract with the relevant amount, so that contract can call transferFrom, which deposits USDC into contract

* If someone bids at near-end of the auction (i.e in the last 8 blocks), match will be increased by ``expxiryExtension`` which is prior determined by creator 

---

```
function player_withdraw_bid(string memory matchId, uint tokenIndex) external nonReentrant validTokenIndex(matchId, tokenIndex) 
```

* Player calls this function to withdraw money, top bidder is not allowed to withdraw

---
```
function reward(string memory matchId, uint tokenIndex) external validTokenIndex(matchId, tokenIndex) matchFinished(matchId) 
```

* Reward the NFT for top bidder of the current nft, anyone can call this function as long as the winner is valid.
Bid value is sent to creator balance as his benefits, the nft will be transfer to player's wallet

---
```
function creator_withdraw_nft(string memory matchId, uint tokenIndex) external validTokenIndex(matchId)
```

* Creator withdraw nft if that nft is not won by anyone 

```
function creator_withdraw_nft_batch(string memory matchId) external creatorOnly(matchId) matchFinished(matchId)
```

* A version of nft withdrawal for creator, but withdraw all in one call, of course only nft having no winner is withdrawed.

---

```
function creator_withdraw_profit() external
```

* Creator withdraw profit received from all auctions the made