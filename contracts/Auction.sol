// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Auction is ReentrancyGuard {


    struct NFTokenAuctionResult {
        address contractAddress;
        address winnerAddress;
        uint standingBid;
        uint tokenId; 
    }

    struct Match {
        address creator;
        uint openBlock;
        uint expiryBlock;
        uint expiryExtensionOnBidUpdate; // expiryBlock will be extend (+=) for ‘expiryExtensionOnBidUpdate’ block(s) if bid updated in range [expiryBlock - expiryExtensionOnBidUpdate + 1 .. expiryBlock]
        uint minBid; // minimum bid for all assets in this auction
        uint increment; // percentage as requested, but I think it should be a particular number 
    }

    // vars
    mapping(string => Match)                    public  matches;
    mapping(string => NFTokenAuctionResult[])   public  matchResults;
    mapping(string => mapping(uint => uint))    private playerBid;
    mapping(address => uint)                    private creatorBalance;

    // events

    // base erc20 token
    // usdc address (erc20)
    address public USDC_ADDRESS;

    constructor(address usdcContractAddress) {
        USDC_ADDRESS = usdcContractAddress;
    }

    function createAuction(
        string memory matchId, 
        uint openBlock, 
        uint expiryBlock, 
        uint expiryExtensionOnBidUpdate, 
        address[] memory contracts, uint[] memory tokenIds) external {
        // check if matchId is occupied 
        // check valid openBlock, expiryBlock, expiryExtensionOnBidUpdate
        // token ids to contracts 
        // save auction meta info on successfully depositing, each tokens has its index
        // emit events
    }

    function player_bid(string memory matchId, uint tokenIndex, uint amount) external {
        // check valid match
        // check valid token_index 
        // check valid amount (> current wining, not doubled value compare to standing bid, sender someone different from winner)
        // just transfer (amount - currentBid) of that person to contract
        // update the winner for that token
    }

    function player_withdraw_bid(string memory matchId, uint tokenIndex) external {
        // check valid matchId, token_index
        // if sender is not winner then allow to withdraw
    }

    function player_withdraw_nft(string memory matchId, uint tokenIndex, address recipientAddress) external {
        // check valid matchId, token_index, match finished
        // check sender is winner
        // send nft to “address”
    }

    function creator_withdraw_nft(string memory matchId) external { // in batch, maybe we will use array for only desired items
        // check valid matchId, match finished
        // withdraw all nft of the match having no winner
    }

    function functioncreator_withdraw_profit(string memory matchId) external { // in batch, maybe we will use array for only desired items to prevent out of gas due to for loop
        // check valid matchId, match finished
        // iterate through tokens and compute total profit
        // transfer
    }
}
