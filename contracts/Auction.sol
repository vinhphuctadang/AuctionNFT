// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Auction is ReentrancyGuard, IERC721Receiver {

    // using safeErc20 for ierc20 based contract
    using SafeERC20 for IERC20;

    // constants
    address constant ADDRESS_NULL             = 0x0000000000000000000000000000000000000000;
    
    // max item allow per auction, should not be more than 2^32-1
    uint    constant MAX_ITEM_PER_AUCTION     = 32;
    
    uint    constant BLOCKS_TO_EXPIRE         = 8;
    
    bytes4  constant ERC721_ONRECEIVED_RESULT = bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    // uint constant MAX_UINT96 = type(uint96).max;

    // structs
    struct NFT {
        address contractAddress;
        uint    tokenId;
        uint    minBid;
    }
    
    struct AuctionResult {
        address topBidder;
        uint standingBid;
    }

    struct Match {
        address creatorAddress;
        uint96 minIncrement; // percentage based
        uint96 openBlock;
        uint96 expiryBlock;
        uint32 expiryExtension; // expiryBlock will be extend (+=) for expiryExtension block(s) if bid updated in range [expiryBlock - expiryExtension + 1 .. expiryBlock]
        uint32 nftCount;
    }

    // state
    // matchId => Match
    mapping(string => Match)                    public  matches;

    // matchId => index => NFT
    mapping(string => mapping(uint => NFT))     public  matchNFTs;
    
    // matchId => Result
    mapping(string => mapping(uint => AuctionResult))            public  matchResults;
    
    // matchId => player => tokenIndex => price
    mapping(string => mapping(address => mapping(uint => uint))) private playerBid;

    // address to balance
    mapping(address => uint)                    private creatorBalance;

    // events
    event CreateAuctionEvent(address creatorAddress, string matchId, uint96 openBlock, uint96 expiryBlock, uint96 increment, uint32 expiryExtension, NFT[] nfts);
    event PlayerBidEvent(string matchId, address playerAddress, uint tokenIndex, uint bid, uint96 expiryBlock);
    event RewardEvent(string matchId, uint tokenIndex, address winnerAddress);

    // base erc20 token
    address public USDC_ADDRESS;

    // modifier 
    modifier validTokenIndex(string memory matchId, uint tokenIndex) {
        require(matches[matchId].creatorAddress != ADDRESS_NULL, "invalid match"); 
        require(tokenIndex < matches[matchId].nftCount, "invalid token");
        _;
    }

    modifier creatorOnly(string memory matchId) {
         require(matches[matchId].creatorAddress == msg.sender, "creator only function"); 
        _;
    }
    
    // match finished should be used with checking valid match
    modifier matchFinished(string memory matchId) {
        // require(matches[matchId].creatorAddress != ADDRESS_NULL, "invalid match");
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
        uint32 expiryExtension,
        uint96 minIncrement, 
        NFT[] memory nfts) external nonReentrant {

        // check if matchId is occupied
        require(matches[matchId].creatorAddress == ADDRESS_NULL, "matchId is occupied");
        
        // check valid openBlock, expiryBlock, expiryExtensionOnBidUpdate
        require(expiryBlock > openBlock && openBlock > block.number, "condition expiryBlock > openBlock > current block count not satisfied");
        require(expiryBlock - openBlock > BLOCKS_TO_EXPIRE * 2,      "auction time must not less than 2x BLOCKS_TO_EXPIRE");

        // check increment
        require(minIncrement < 100, "increment must be greater than 0 and less than 100%");
        
        // check item count
        require(nfts.length > 0 && nfts.length <= MAX_ITEM_PER_AUCTION, "number of nft must be greater than 0 and less than MAX_ITEM_PER_AUCTION");

        // deposit item to contract
        for(uint i = 0; i < nfts.length; ++i) {
            
            require(nfts[i].minBid > 1, "minBid must be greater than 1");
            require(minIncrement * nfts[i].minBid / 100 > 0, "increment should be greater than 0");
            
            // if meet requirements then send tokens to contract
            IERC721(nfts[i].contractAddress).safeTransferFrom(msg.sender, address(this), nfts[i].tokenId);
            
            // create slots for items
            matchResults[matchId][i]    = AuctionResult(ADDRESS_NULL, nfts[i].minBid);
            matchNFTs[matchId][i]       = nfts[i];
        }

        // create match
        matches[matchId] = Match(
            msg.sender,
            minIncrement, // percentage based
            openBlock,
            expiryBlock,
            expiryExtension, // expiryBlock will be extend (+=) for expiryExtension block(s) if bid updated in range [expiryBlock - expiryExtension + 1 .. expiryBlock]
            uint32(nfts.length)
        );

        // emit events
        // reateAuctionEvent(address creatorAddress, string matchId, uint96 openBlock, uint96 expiryBlock, uint96 increment, uint32 expiryExtension, NFT[] nfts);
        emit CreateAuctionEvent(msg.sender, matchId, openBlock, expiryBlock, minIncrement, expiryExtension, nfts);
    }

    function player_bid(string memory matchId, uint tokenIndex, uint amount) external nonReentrant validTokenIndex(matchId, tokenIndex) {
        Match memory amatch = matches[matchId];
        address playerAddress = msg.sender;
        require(amatch.openBlock < block.number && block.number <= amatch.expiryBlock, "match is not opened for bidding");
        
        AuctionResult memory auctionResult = matchResults[matchId][tokenIndex];
        uint    standingBid     = auctionResult.standingBid;
        uint    nftMinBid       = matchNFTs[matchId][tokenIndex].minBid;
        uint    increment       = nftMinBid * amatch.minIncrement / 100;
        
        // check valid amount (> current wining, not doubled value compare to standing bid, sender someone different from winner)
        // known issue: Auction creator should be aware of the case where stadingBid = 1 and min increment >= 1
        require(
            amount < 2 * standingBid && 
            amount > standingBid && 
            amount - standingBid >= increment, 
            "illegal increment"
        );

        // update the winner for that token
        matchResults[matchId][tokenIndex] = AuctionResult(playerAddress, amount);
    
        // if in BLOCKS_TO_EXPIRE blocks then extends the auction expiry time
        if (amatch.expiryBlock - block.number < BLOCKS_TO_EXPIRE) {
            amatch.expiryBlock += amatch.expiryExtension;
            matches[matchId].expiryBlock = amatch.expiryBlock;
        }

        // just transfer (amount - currentBid) of that person to contract
        uint transferAmount = amount - playerBid[matchId][playerAddress][tokenIndex]; // sure that amount always higher than current
        playerBid[matchId][playerAddress][tokenIndex] = amount;
    
        // emit event
        emit PlayerBidEvent(
            matchId, 
            playerAddress,
            tokenIndex,
            amount, 
            amatch.expiryBlock
        );
        IERC20(USDC_ADDRESS).safeTransferFrom(playerAddress, address(this), transferAmount);
    }

    // player can withdraw bid if he is not winner of this match
    function player_withdraw_bid(string memory matchId, uint tokenIndex) external nonReentrant validTokenIndex(matchId, tokenIndex) {
        
        // check if player is top bidder 
        address playerAddress = msg.sender;
        require(matchResults[matchId][tokenIndex].topBidder != playerAddress, "top bidder cannot withdraw");

        uint amount = playerBid[matchId][playerAddress][tokenIndex];
        require(amount > 0, "bid must be greater than 0 to withdraw");

        // reset bid amount        
        playerBid[matchId][playerAddress][tokenIndex] = 0;

        // transfer money
        IERC20(USDC_ADDRESS).safeTransfer(playerAddress, amount); // auto reverts on error
    }

    // anyone can call reward, top bidder and creator are incentivized to call this function to send rewards/profit
    function reward(string memory matchId, uint tokenIndex) external validTokenIndex(matchId, tokenIndex) matchFinished(matchId) {
        
        address winnerAddress  = matchResults[matchId][tokenIndex].topBidder;
        require(winnerAddress != ADDRESS_NULL, "winner is not valid");

        // set result to null
        matchResults[matchId][tokenIndex] = AuctionResult(ADDRESS_NULL, 0);

        // increase creator's balance
        uint standingBid = playerBid[matchId][winnerAddress][tokenIndex];
        playerBid[matchId][winnerAddress][tokenIndex]   = 0;
        creatorBalance[matches[matchId].creatorAddress] += standingBid;
        
        NFT memory nft = matchNFTs[matchId][tokenIndex];
        // send nft to “address”
        IERC721(nft.contractAddress).safeTransferFrom(address(this), winnerAddress, nft.tokenId);
        emit RewardEvent(matchId, tokenIndex, winnerAddress);
    }

    function process_withdraw_nft(string memory matchId, uint tokenIndex) private {
        // set standingBid to 0 to prevent withdraw again
        matchResults[matchId][tokenIndex].standingBid = 0;
        // transfer asset
        NFT memory nft = matchNFTs[matchId][tokenIndex];
        IERC721(nft.contractAddress).safeTransferFrom(address(this), msg.sender, nft.tokenId);
    }

    // çreator withdraws unused nft
    function creator_withdraw_nft_batch(string memory matchId) external creatorOnly(matchId) matchFinished(matchId) { 
        // check valid matchId, match finished
        uint _len = matches[matchId].nftCount;
        for(uint i = 0; i < _len; ++i) {
            
            // consider result
            AuctionResult memory result = matchResults[matchId][i];
            
            // if no one wins the token then withdraw 
            if (result.topBidder == ADDRESS_NULL && result.standingBid > 0) {
                process_withdraw_nft(matchId, i);
            }
        }
    }
    
    function creator_withdraw_nft(string memory matchId, uint tokenIndex) external validTokenIndex(matchId, tokenIndex) creatorOnly(matchId) matchFinished(matchId) {
        AuctionResult memory result = matchResults[matchId][tokenIndex];
        require (result.topBidder == ADDRESS_NULL && result.standingBid > 0, "token is not available to withdraw");
        
        process_withdraw_nft(matchId, tokenIndex);
    }

    function creator_withdraw_profit() external { // in batch, maybe we will use array for only desired items to prevent out of gas due to for loop
        uint balance = creatorBalance[msg.sender];
        require(balance > 0, "creator balance must be greater than 0");
        
        // reset balance 
        creatorBalance[msg.sender] = 0;
        
        // send money
        IERC20(USDC_ADDRESS).safeTransfer(msg.sender, balance);
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external override pure returns (bytes4) {
        // return ERC721_ONRECEIVED_RESULT to conform the interface
        return ERC721_ONRECEIVED_RESULT;
    }

    function get_match(string memory matchId) external view returns(address, uint, uint, uint, uint, uint) {
        Match memory amatch = matches[matchId];
        return (
            amatch.creatorAddress,
            amatch.minIncrement, 
            amatch.openBlock,
            amatch.expiryBlock,
            amatch.expiryExtension,
            amatch.nftCount
        );
    }

    function get_current_result(string memory matchId, uint tokenIndex) external view returns (address, uint) {
        return (matchResults[matchId][tokenIndex].topBidder, matchResults[matchId][tokenIndex].standingBid);
    }

    function get_player_bid(string memory matchId, address playerAddress, uint tokenIndex) external view returns(uint) {
        return playerBid[matchId][playerAddress][tokenIndex];
    }

    function get_creator_balance(address creatorAddress) external view returns(uint) {
        return creatorBalance[creatorAddress];
    }
}
