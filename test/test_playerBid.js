const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

let openBlock, expiryBlock 

function createAuction(){
    it("should create an auction with 2 nft from 2 erc71", async()=>{
        // approve 

        await mockyEarth.approve(auctionContract.address, "1", {from: Thor})
        await mockyMars.approve (auctionContract.address, "1", {from: Thor})

        let blockCount = await utils.getBlockCount();

        expiryBlock = blockCount + 30
        openBlock = blockCount + 5
        let tx = await auctionContract.createAuction(
            "thorMatch", openBlock, 
            expiryBlock, 10, 20,
            [ {
                contractAddress: mockyEarth.address,
                tokenId: "1",
                minBid: 100
            }, 
            {
                contractAddress: mockyMars.address,
                tokenId: "1",
                minBid: 200
            }
            ],
            {from: Thor}
        )

        let amatch = await auctionContract.get_match("thorMatch")
        
        let expectedMatchData = [
            Thor,
            "20",
            (blockCount + 5).toString(),
            expiryBlock.toString(),
            "10",
            "2"
        ]

        let matchData = []
        for(let key in amatch) {
            let x = amatch[key].toString()
            // string case
            matchData.push(x);
        }

        // deep equals just produces weird error on types
        assert.strictEqual(JSON.stringify(matchData), JSON.stringify(expectedMatchData));

        logger.info("created match will be ended at:", expiryBlock)
    })
}

function compareBid(actual, expected){
    tmp = []
    for(let key in actual) tmp.push(actual[key].toString())
    assert.notStrictEqual(tmp, expected)
}

contract("Test player bid when match is not opened", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should not let player bid when open block is not yet mined", async()=>{

        await utils.testError(async()=>{
            await auctionContract.player_bid("thorMatch", 1, 120)
        }, "reason", "match is not opened for bidding")
    })

    it("should not let player bid when expiryBlock is mined", async()=>{
        await utils.generateBlock(helperContract, expiryBlock + 1, Thor)

        await utils.testError(async()=>{
            await auctionContract.player_bid("thorMatch", 1, 120)
        }, "reason", "match is not opened for bidding")
    })
})

contract("Test player bid on invalid inputs", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should not let player bid invalid token index", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await utils.testError(async()=>{
            await auctionContract.player_bid("thorMatch", 2, 120, {from: Steve})
        }, "reason", "invalid token")
    })

    it("should not let player bid with invalid increment", async()=>{
        await utils.testError(async()=>{
            await auctionContract.player_bid("thorMatch", 0, 105, {from: Natasha})
        }, "reason", "illegal increment")
    })

    it("should not let player bid with less-than-current amount, or doubled amount", async()=>{
        let tx
        // some one bid on thorMatch
        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})

        tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, [Steve, "140"])

        logger.info("Testing with less-than-current amount ...")
        // lower than current
        
        await utils.testError(async()=>{
            await auctionContract.player_bid("thorMatch", 0, 120, {from: Natasha})
        }, "reason", "illegal increment")

        logger.info("Testing with doubled amount ...")
        // double the amount
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.testError(async()=>{
            await auctionContract.player_bid("thorMatch", 0, 280, {from: Natasha})
        }, "reason", "illegal increment")

        logger.info("Checking if current result stays unchanged ...")
        tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, [Steve, "140"])
    })
})

contract("test player bid on valid cases", accounts =>{
    utils.deployAllContracts(accounts)
    createAuction()

    it("should let player bid and not expand auction time", async()=>{
        let tx
        // wait until match opened
        await utils.generateBlock(helperContract, openBlock + 1, Steve)
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 200, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})

        // get balance
        let stevePreviousBalance = await usdcContract.balanceOf(Steve);
        let contractBalance = await usdcContract.balanceOf(auctionContract.address)

        tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, ["0x0000000000000000000000000000000000000000", "100"])

        // bid 
        let bidTx = await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})

        // check bid value
        tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, [Steve, "140"])

        // check balance
        let steveCurrentBalance = await usdcContract.balanceOf(Steve)
        assert.strictEqual(steveCurrentBalance - stevePreviousBalance, -140)

        let currentContractBalance = await usdcContract.balanceOf(auctionContract.address)
        assert.strictEqual(currentContractBalance - contractBalance, 140)

        // check event
        utils.eventEquals(bidTx, "PlayerBidEvent", {
            matchId: "thorMatch",
            playerAddress: Steve,
            tokenIndex: "0",
            bid: "140",
            expiryBlock: expiryBlock,
        })
    })

    it("should let Natasha beat Steve on nft 0", async()=> {
        let bidTx = await auctionContract.player_bid("thorMatch", 0, 160, {from: Natasha})

        // top bidder updated
        tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, [Natasha, "160"])

        utils.eventEquals(bidTx, "PlayerBidEvent", {
            matchId: "thorMatch",
            playerAddress: Natasha,
            tokenIndex: "0",
            bid: "160",
            expiryBlock: expiryBlock,
        })

        // check balance
        let steve = await auctionContract.get_player_bid("thorMatch", Steve, 0)
        assert.strictEqual(steve.toString(), "140")

        let natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 0)
        assert.strictEqual(natasha.toString(), "160")
    })

    it("should let player bid and expand auction time", async()=>{
        let tx
        await utils.generateBlock(helperContract, expiryBlock - 6, Steve)
        
        let stevePreviousBalance = await usdcContract.balanceOf(Steve);
        let contractBalance = await usdcContract.balanceOf(auctionContract.address)

        // bid
        let bidTx = await auctionContract.player_bid("thorMatch", 0, 200, {from: Steve})

        // check outputs
        let steve = await auctionContract.get_player_bid("thorMatch", Steve, 0)
        assert.strictEqual(steve.toString(), "200")

        // check emitted event
        utils.eventEquals(bidTx, "PlayerBidEvent", {
            matchId: "thorMatch",
            playerAddress: Steve,
            tokenIndex: "0",
            bid: "200",
            expiryBlock: expiryBlock + 10, // auction time expanded
        })
        
        // check balance
        let steveCurrentBalance = await usdcContract.balanceOf(Steve)
        assert.strictEqual(steveCurrentBalance - stevePreviousBalance, -60)
        
        let currentContractBalance = await usdcContract.balanceOf(auctionContract.address)
        assert.strictEqual(currentContractBalance - contractBalance, 60)
    })

    it("should let player bid on 2 different nft", async()=>{
        
        let natashaPreviousBalance = await usdcContract.balanceOf(Natasha);
        // natasha bids on ntf 2
        let bidTx = await auctionContract.player_bid("thorMatch", 1, 240, {from: Natasha})

        utils.eventEquals(bidTx, "PlayerBidEvent", {
            matchId: "thorMatch",
            playerAddress: Natasha,
            tokenIndex: "1",
            bid: "240",
            expiryBlock: expiryBlock + 10, // auction time expanded
        })

        let natashaCurrentBalance = await usdcContract.balanceOf(Natasha);
        assert.strictEqual(natashaCurrentBalance - natashaPreviousBalance, -240)

        let natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 1)
        assert.strictEqual(natasha.toString(), "240")

        // check if nft 1 is also bidded by natasha
        natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 0)
        assert.strictEqual(natasha.toString(), "160")
    })
})