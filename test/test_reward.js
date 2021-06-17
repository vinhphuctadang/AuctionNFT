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

contract("Test fail cases create auction", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should bid on nft 1 and 2", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})
        await auctionContract.player_bid("thorMatch", 0, 200, {from: Natasha})

        let tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, [Natasha, "200"])
    })

    it("should not reward on unfinished match", async()=>{
        await utils.testError(async()=>{
            // whoever can call from
            await auctionContract.reward("thorMatch", 0, {from: Tony})
        }, "reason", "match is not finished")
    })

    it("should not reward on invalid token index", async()=>{
        await utils.testError(async()=>{
            // whoever can call from
            await auctionContract.reward("thorMatch", 2, {from: Tony})
        }, "reason", "invalid token")
    })

    it("should not reward on token having no bid", async()=>{
        // await
        await utils.generateBlock(helperContract, expiryBlock + 1, Steve)

        await utils.testError(async()=>{
            // whoever can call from
            await auctionContract.reward("thorMatch", 1, {from: Tony})
        }, "reason", "winner is not valid")
    })

    it("should reward winner and check if state changed", async()=>{
        let steve, natasha, tx
        // check current state first
        steve = await auctionContract.get_player_bid("thorMatch", Steve, 0)
        assert.strictEqual(steve.toString(), "140")

        natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 0)
        assert.strictEqual(natasha.toString(), "200")

        creatorBalance = await auctionContract.get_creator_balance(Thor)
        assert.strictEqual(creatorBalance.toString(), "0")

        // reward, called from someone, whoever
        tx = await auctionContract.reward("thorMatch", 0, {from: Tony})

        // check event
        utils.eventEquals(tx, "RewardEvent", {
            matchId: "thorMatch",
            tokenIndex: "0",
            winnerAddress: Natasha
        })

        // check match
        tx = await auctionContract.get_current_result("thorMatch", 0)
        compareBid(tx, ["0x0000000000000000000000000000000000000000", "0"])

        // check balance
        steve = await auctionContract.get_player_bid("thorMatch", Steve, 0)
        assert.strictEqual(steve.toString(), "140")

        natasha = await auctionContract.get_player_bid("thorMatch", Natasha, 0)
        assert.strictEqual(natasha.toString(), "0")

        creatorBalance = await auctionContract.get_creator_balance(Thor)
        assert.strictEqual(creatorBalance.toString(), "200")
    })
})