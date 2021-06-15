// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Auction is ReentrancyGuard {

    // using safeErc20 for ierc20 based contract
    using SafeERC20 for IERC20;

    // constants
    address constant ADDRESS_NULL = 0x0000000000000000000000000000000000000000;
    uint constant MAX_ITEM_PER_AUCTION = 32;
    uint constant BLOCKS_TO_EXPIRE     = 8;
    // uint constant MAX_UINT96 = type(uint96).max;

    // structs
    struct NFTAuctionResult {
        address contractAddress;
        uint    tokenId;
        address topBidder;
        uint    standingBid;
    }

    struct Match {
        address creatorAddress;
        uint96 minIncrement; // percentage based
        uint96 openBlock;
        uint96 expiryBlock;
        uint64 expiryExtension; // expiryBlock will be extend (+=) for expiryExtension block(s) if bid updated in range [expiryBlock - expiryExtension + 1 .. expiryBlock]
        uint   minBid; // minimum bid for all assets in this auction
    }

    // state
    // matchId => Match
    mapping(string => Match)                    public  matches;

    // matchId => Result
    mapping(string => NFTAuctionResult[])       public  matchResults;

    // matchId => player => tokenIndex => price
    mapping(string => mapping(address => mapping(uint => uint))) private playerBid;

    // address to balance
    mapping(address => uint)                    private creatorBalance;

    // events
    event CreateAuctionEvent(address creatorAddress, string matchId, uint96 openBlock, uint96 expiryBlock, uint minBid, uint96 increment, address[] contracts, uint[] tokenIds);
    event PlayerBidEvent(string matchId, address contractAddress, uint tokenId, uint bid, uint96 expiryBlock);
    event RewardEvent(string matchId, address contractAddress, uint tokenId, address winner);

    // base erc20 token
    address public USDC_ADDRESS;

    // modifier 
    modifier validMatch(string memory matchId) {
        require(matches[matchId].creatorAddress != ADDRESS_NULL, "invalid match"); 
        _;
    }

    modifier creatorOnly(string memory matchId) {
         require(matches[matchId].creatorAddress == msg.sender, "creator only function"); 
        _;
    }
    
    modifier matchFinished(string memory matchId) {
        require(matches[matchId].creatorAddress != ADDRESS_NULL, "invalid match");
        require(matches[matchId].expiryBlock < block.number, "match is not finished");
        _;
    }

    constructor(address usdcContractAddress) {
        USDC_ADDRESS = usdcContractAddress;
    }

    function createAuction(
        string memory matchId, 
        uint96 openBlock, 
        uint96 expiryBlock,
        uint64 expiryExtension,
        uint96 minIncrement, 
        uint minBid,
        address[] memory contracts, uint[] memory tokenIds) external nonReentrant {
        // check if matchId is occupied
        require(matches[matchId].creatorAddress == ADDRESS_NULL, "matchId is occupied");
        
        // check valid openBlock, expiryBlock, expiryExtensionOnBidUpdate
        require(expiryBlock > openBlock && openBlock > block.number, "condition expiryBlock > openBlock > current block count not satisfied");
        require(expiryBlock - openBlock > BLOCKS_TO_EXPIRE * 2, "auction time must be more than 2x BLOCKS_TO_EXPIRE");
        // increment 
        // check item count
        require(contracts.length <= MAX_ITEM_PER_AUCTION, "item count must not exceed MAX_ITEM_PER_AUCTION");
        require(contracts.length == tokenIds.length, "contracts and item ids must have the same length");

        require(minBid > 0, "min bid should be greater than 0");
        require(minIncrement < 100 && minBid * minIncrement / 100 > 0, "increment should be greater than 0");

        // deposit item to contract
        for(uint i = 0; i < contracts.length; ++i) {
            IERC721(contracts[i]).safeTransferFrom(msg.sender, address(this), tokenIds[i]);
            // create slots for items
            matchResults[matchId].push(NFTAuctionResult(contracts[i], tokenIds[i], ADDRESS_NULL, minBid));
        }

        // create match
        matches[matchId] = Match(
            msg.sender,
            minIncrement, // percentage based
            openBlock,
            expiryBlock,
            expiryExtension, // expiryBlock will be extend (+=) for expiryExtension block(s) if bid updated in range [expiryBlock - expiryExtension + 1 .. expiryBlock]
            minBid 
        );

        // emit events
        emit CreateAuctionEvent(msg.sender, matchId, openBlock, expiryBlock, minBid, minIncrement, contracts, tokenIds);
    }

    function player_bid(string memory matchId, uint tokenIndex, uint amount) external nonReentrant validMatch(matchId) {
        Match memory amatch = matches[matchId];
        address playerAddress = msg.sender;
        require(amatch.openBlock < block.number && block.number <= amatch.expiryBlock, "match finished");

        // check valid token_index
        require(tokenIndex < matchResults[matchId].length, "token index out of range");
        NFTAuctionResult storage tokenResult = matchResults[matchId][tokenIndex];
        uint    standingBid     = tokenResult.standingBid;
        // check valid amount (> current wining, not doubled value compare to standing bid, sender someone different from winner)
        // known issue: Auction creator should be aware of the case where stadingBid = 1 and min increment >= 1
        require(
            amount < 2 * standingBid && 
            amount > standingBid && 
            amount - standingBid >= amatch.minBid * amatch.minIncrement / 100, 
            "illegal increment"
        );

        // update the winner for that token
        tokenResult.standingBid = amount;
        tokenResult.topBidder   = playerAddress;

        // if in BLOCKS_TO_EXPIRE blocks then extends the auction expiry time
        if (amatch.expiryBlock - block.number < BLOCKS_TO_EXPIRE) {
            amatch.expiryBlock += amatch.expiryExtension;
            matches[matchId].expiryBlock = amatch.expiryBlock;
        }

        // just transfer (amount - currentBid) of that person to contract
        uint transferAmount = amount - playerBid[matchId][playerAddress][tokenIndex]; // sure that amount always higher than current
        playerBid[matchId][playerAddress][tokenIndex] = amount;

        emit PlayerBidEvent(
            matchId, 
            tokenResult.contractAddress, 
            tokenResult.tokenId, 
            amount, 
            amatch.expiryBlock
        );
        IERC20(USDC_ADDRESS).safeTransferFrom(playerAddress, address(this), transferAmount);
    }

    // player can withdraw bid if he is not winner of this match
    function player_withdraw_bid(string memory matchId, uint tokenIndex) external nonReentrant {
        // check valid matchId, token_index
        require(tokenIndex < matchResults[matchId].length, "token index out of range");
        address playerAddress = msg.sender;

        require(matchResults[matchId][tokenIndex].topBidder != playerAddress, "top bidder cannot withdraw");

        uint amount = playerBid[matchId][playerAddress][tokenIndex];
        require(amount > 0, "bid must be greater than 0");

        // reset bid amount        
        playerBid[matchId][playerAddress][tokenIndex] = 0;

        // transfer money
        IERC20(USDC_ADDRESS).safeTransfer(playerAddress, amount); // auto reverts on error
    }

    // anyone can call reward, top bidder and creator are incentivized to call this function to send rewards/profit
    function reward(string memory matchId, uint tokenIndex) external matchFinished(matchId) {

        require(tokenIndex < matchResults[matchId].length, "token index out of range");
        
        NFTAuctionResult memory result = matchResults[matchId][tokenIndex];
        address winnerAddress  = result.topBidder;

        // set top bidder to null
        matchResults[matchId][tokenIndex].topBidder = ADDRESS_NULL;

        // increase creator's balance
        uint standingBid = playerBid[matchId][winnerAddress][tokenIndex];
        playerBid[matchId][winnerAddress][tokenIndex]   = 0;
        creatorBalance[matches[matchId].creatorAddress] += standingBid;

        // send nft to “address”
        IERC721(result.contractAddress).safeTransferFrom(address(this), winnerAddress, result.tokenId);
        emit RewardEvent(matchId, result.contractAddress, result.tokenId, winnerAddress);
    }

    // çreator withdraws unused nft
    function creator_withdraw_nft_batch(string memory matchId) external matchFinished(matchId) creatorOnly(matchId) { 
        // check valid matchId, match finished
        address creatorAddress = msg.sender;
        uint minBid = matches[matchId].minBid;
        uint _len = matchResults[matchId].length;
        for(uint i = 0; i < _len; ++i) {
            NFTAuctionResult memory result = matchResults[matchId][i];
            if (result.topBidder == ADDRESS_NULL && result.standingBid == minBid) {
                // set standingBid to 0
                matchResults[matchId][i].standingBid = 0;
                // transfer asset
                IERC721(result.contractAddress).safeTransferFrom(address(this), creatorAddress, result.tokenId);
            }
        }
    }
    
    function creator_withdraw_nft(string memory matchId, uint tokenIndex) external matchFinished(matchId) creatorOnly(matchId) {
        uint minBid = matches[matchId].minBid;
        NFTAuctionResult memory result = matchResults[matchId][tokenIndex];
        require (result.topBidder == ADDRESS_NULL && result.standingBid == minBid, "token is not available to withdraw");
        // set standingBid to 0
        matchResults[matchId][tokenIndex].standingBid = 0;
        // transfer asset
        IERC721(result.contractAddress).safeTransferFrom(address(this), msg.sender, result.tokenId);
    }

    function creator_withdraw_profit() external { // in batch, maybe we will use array for only desired items to prevent out of gas due to for loop
        uint balance = creatorBalance[msg.sender];
        require(balance > 0, "creator balance must be greater than 0");
        creatorBalance[msg.sender] = 0;
        // send token
        IERC20(USDC_ADDRESS).safeTransfer(msg.sender, balance);
    }
}
