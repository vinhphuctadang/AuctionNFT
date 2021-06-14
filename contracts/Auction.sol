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
    uint constant MIN_HALF_AUCTION_TIME = 8;
    // uint constant MAX_UINT96 = type(uint96).max;

    // structs
    struct NFTokenAuctionResult {
        address contractAddress;
        uint tokenId;
        address topBidder;
        uint standingBid;
    }

    struct Match {
        address creatorAddress;
        uint96 minIncrement; // percentage based
        uint96 openBlock;
        uint96 expiryBlock;
        uint64 expiryExtension; // expiryBlock will be extend (+=) for expiryExtension block(s) if bid updated in range [expiryBlock - expiryExtension + 1 .. expiryBlock]
        uint minBid; // minimum bid for all assets in this auction
    }
    // state
    // matchId => Match
    mapping(string => Match)                    public  matches;

    // matchId => Result
    mapping(string => NFTokenAuctionResult[])   public  matchResults;

    // matchId => Current bid for each token in the match
    mapping(address => mapping(bytes32 => uint)) private playerBid;

    // address to balance
    mapping(address => uint)                    private creatorBalance;

    // events
    event CreteAuctionEvent(string matchId, uint96 openBlock, uint96 expiryBlock, uint minBid, uint96 increment, address[] contracts, uint[] tokenIds);
    event NftWithdrawed(string matchId, address contractAddress, uint tokenId, address winners);

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
    // modifier openMatch() {

    // }

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
        require(expiryBlock - openBlock > MIN_HALF_AUCTION_TIME * 2, "auction time must be more than 2x MIN_HALF_AUCTION_TIME");
        // increment 
        // check item count
        require(contracts.length <= MAX_ITEM_PER_AUCTION, "item count must not exceed MAX_ITEM_PER_AUCTION");
        require(contracts.length == tokenIds.length, "contracts and item ids must have the same length");

        require(minBid > 0, "min bid should be greater than 0");
        require(minIncrement < 100 && minBid * minIncrement / 100 > 0, "increment should be greater than 0");

        // deposit item to contract
        for(uint i = 0; i < contracts.length; ++i) {
            IERC721(contracts[i]).safeTransferFrom(contracts[i], address(this), tokenIds[i]);
            // create slots for items
            matchResults[matchId].push(NFTokenAuctionResult(contracts[i], tokenIds[i], ADDRESS_NULL, minBid));
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
    }

    function player_bid(string memory matchId, uint tokenIndex, uint amount) external nonReentrant validMatch(matchId) {

        Match memory amatch = matches[matchId];
        address playerAddress = msg.sender;
        require(amatch.openBlock < block.number && block.number <= amatch.expiryBlock, "match finished");

        // check valid token_index
        require(tokenIndex < matchResults[matchId].length, "token index out of range");
        uint standingBid = matchResults[matchId][tokenIndex].standingBid;
        // check valid amount (> current wining, not doubled value compare to standing bid, sender someone different from winner)
        // known issue: Auction creator should be aware of the case where stadingBid = 1 and min increment >= 1
        require(amount < 2 * standingBid && amount > standingBid && amount - standingBid >= amatch.minBid * amatch.minIncrement / 100, "illegal increment");

        // update the winner for that token
        matchResults[matchId][tokenIndex].standingBid = amount;
        matchResults[matchId][tokenIndex].topBidder = playerAddress;

        // if in MIN_HALF_AUCTION_TIME blocks then extends the auction
        if (amatch.expiryBlock - block.number < MIN_HALF_AUCTION_TIME) {
            matches[matchId].expiryBlock = amatch.expiryBlock + amatch.expiryExtension;
        }
        // just transfer (amount - currentBid) of that person to contract
        bytes32 playerBidIndex = keccak256(abi.encodePacked(matchId, tokenIndex));
        uint transferAmount = amount - playerBid[playerAddress][playerBidIndex];
        playerBid[playerAddress][playerBidIndex] = amount;
        
        IERC20(USDC_ADDRESS).safeTransferFrom(msg.sender, address(this), transferAmount);
    }

    function player_withdraw_bid(string memory matchId, uint tokenIndex) external nonReentrant {
        // check valid matchId, token_index
        require(tokenIndex < matchResults[matchId].length, "token index out of range");
        require(matchResults[matchId][tokenIndex].topBidder != msg.sender, "top bidder cannot withdraw");
        
        address playerAddress = msg.sender;
        // TOOD: Use string, anyway this packed value is hashed by default
        bytes32 playerBidIndex = keccak256(abi.encodePacked(matchId, tokenIndex));
        uint amount = playerBid[playerAddress][playerBidIndex];
        playerBid[playerAddress][playerBidIndex] = 0;
        // transfer money
        IERC20(USDC_ADDRESS).safeTransfer(playerAddress, amount); // auto reverts on error
    }

    function player_withdraw_nft(string memory matchId, uint tokenIndex, address recipientAddress) external matchFinished(matchId) {

        require(tokenIndex < matchResults[matchId].length, "token index out of range");
        address playerAddress = msg.sender;
        NFTokenAuctionResult memory result = matchResults[matchId][tokenIndex];

        // check sender is winner
        require(result.topBidder == playerAddress, "non top bidder cannot withdraw");

        // set top bidder to null
        matchResults[matchId][tokenIndex].topBidder = ADDRESS_NULL;

        // increase auction creator money
        bytes32 playerBidIndex = keccak256(abi.encodePacked(matchId, tokenIndex));

        // increase creator's balance
        uint amount = playerBid[playerAddress][playerBidIndex];
        playerBid[playerAddress][playerBidIndex] = 0;
        creatorBalance[matches[matchId].creatorAddress] += amount;

        // send nft to “address”
        IERC721(result.contractAddress).safeTransferFrom(address(this), recipientAddress, result.tokenId);
        emit NftWithdrawed(matchId, result.contractAddress, result.tokenId, playerAddress);
    }

    function creator_withdraw_nft(string memory matchId) external matchFinished(matchId) creatorOnly(matchId) { // in batch, maybe we will use array for only desired items
        // check valid matchId, match finished
        address creatorAddress = msg.sender;
        uint minBid = matches[matchId].minBid;
        uint _len = matchResults[matchId].length;
        for(uint i = 0; i < _len; ++i) {
            NFTokenAuctionResult memory result = matchResults[matchId][i];
            if (result.topBidder == ADDRESS_NULL && result.standingBid == minBid) {
                // set standingBid to 0
                matchResults[matchId][i].standingBid = 0;
                // transfer asset
                IERC721(result.contractAddress).safeTransferFrom(address(this), creatorAddress, result.tokenId);
            }
        }
    }

    function functioncreator_withdraw_profit() external { // in batch, maybe we will use array for only desired items to prevent out of gas due to for loop
        uint balance = creatorBalance[msg.sender];
        require(balance > 0, "creator balance must be greater than 0");
        creatorBalance[msg.sender] = 0;
        // send token
        IERC20(USDC_ADDRESS).safeTransfer(msg.sender, balance);
    }
}
