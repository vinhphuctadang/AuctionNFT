const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

let expiryBlock, openBlock
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
            openBlock.toString(),
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

contract("Test bid withdrawal", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should let player made some bids", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})
        await auctionContract.player_bid("thorMatch", 0, 200, {from: Natasha})

        let tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, [Natasha, "200"])
    })

    it("should not let player withdraw on invalid token index", async()=>{
        await utils.testError(async()=>{
            // whoever can call from
            await auctionContract.player_withdraw_bid("thorMatch", 2, {from: Steve})
        }, "reason", "invalid token")
    })

    it("should not let topBidder withdraw Bid", async()=>{
        await utils.testError(async()=>{
            // whoever can call from
            await auctionContract.player_withdraw_bid("thorMatch", 0, {from: Natasha})
        }, "reason", "top bidder cannot withdraw")
    })

    it("should not let someone withdraw when his/her bid == 0", async()=>{
        await utils.testError(async()=>{
            // whoever can call from
            await auctionContract.player_withdraw_bid("thorMatch", 0, {from: Tony})
        }, "reason", "bid must be greater than 0 to withdraw")
    })

    it("should let Steve withdraw his bid", async()=>{
        let steve, natasha

        steve = await auctionContract.get_player_bid("thorMatch", Steve, 0)
        assert.strictEqual(steve.toString(), "140")
        natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 0)
        assert.strictEqual(natasha.toString(), "200")

        // get balance
        let stevePreviousBalance = await usdcContract.balanceOf(Steve);
        let contractBalance = await usdcContract.balanceOf(auctionContract.address)

        // withdraw
        await auctionContract.player_withdraw_bid("thorMatch", 0, {from: Steve})

        // check balance 
        steve = await auctionContract.get_player_bid("thorMatch", Steve, 0)
        assert.strictEqual(steve.toString(), "0")
        natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 0)
        assert.strictEqual(natasha.toString(), "200")

        // check usdc contract
        // check balance
        let steveCurrentBalance = await usdcContract.balanceOf(Steve)
        assert.strictEqual(steveCurrentBalance - stevePreviousBalance, 140)

        let currentContractBalance = await usdcContract.balanceOf(auctionContract.address)
        assert.strictEqual(currentContractBalance - contractBalance, -140)
    })
})