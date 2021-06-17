const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')
const ADDRESS_NULL = "0x0000000000000000000000000000000000000000"
let expiryBlock, openBlock

function createAuction(){
    it("should create an auction with 2 nft from 2 erc71", async()=>{
        // approve 

        await mockyEarth.approve(auctionContract.address, "1", {from: Thor})
        await mockyEarth.approve(auctionContract.address, "2", {from: Thor})
        await mockyEarth.approve(auctionContract.address, "3", {from: Thor})
        await mockyMars.approve (auctionContract.address, "1", {from: Thor})

        let blockCount = await utils.getBlockCount();

        expiryBlock = blockCount + 30
        openBlock = blockCount + 5
        let tx = await auctionContract.createAuction(
            "thorMatch", openBlock, 
            expiryBlock, 10, 20,
            [ 
                {
                    contractAddress: mockyEarth.address,
                    tokenId: "1",
                    minBid: 100
                }, 
                {
                    contractAddress: mockyEarth.address,
                    tokenId: "2",
                    minBid: 100
                }, 
                {
                    contractAddress: mockyEarth.address,
                    tokenId: "3",
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
            "4"
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

async function checkCurrentResult(matchId, tokenIndex, expected) {
    let tx = await auctionContract.get_current_result(matchId, tokenIndex)
    compareBid(tx, expected)
}

async function checkOwner(contract, tokenId, person) {
    assert.strictEqual(await contract.ownerOf(tokenId), person)
}

contract("Creator withdraw unused Nft", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should make some bid", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})
        await auctionContract.player_bid("thorMatch", 0, 200, {from: Natasha})
    })

    it("should not allow withdrawal when match is not finished", async()=>{
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft("thorMatch", 1, {from: Thor})
        }, "reason", "match is not finished")
    })

    it("should not allow withdraw nft having some bidder", async()=>{
        // wait until match finished
        await utils.generateBlock(helperContract, expiryBlock + 1, Steve)

        // cannot withdraw
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft("thorMatch", 0, {from: Thor})
        }, "reason", "token is not available to withdraw")
    })

    it("should not allow non-creator withdraw nft", async()=>{
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft("thorMatch", 1, {from: Natasha})
        }, "reason", "creator only function")

        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft("thorMatch", 2, {from: Natasha})
        }, "reason", "creator only function")
    })

    it("should only withdraw nft having no bid", async()=>{
        let owner 
        await auctionContract.creator_withdraw_nft("thorMatch", 1, {from: Thor})
        owner = await mockyEarth.ownerOf("2");
        assert.strictEqual(owner, Thor)

        await auctionContract.creator_withdraw_nft("thorMatch", 2, {from: Thor})
        owner = await mockyEarth.ownerOf("3");
        assert.strictEqual(owner, Thor)
    })
})

contract("Test creator withdraw (in batch) unused Nft", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should make some bid", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})
        await auctionContract.player_bid("thorMatch", 0, 200, {from: Natasha})
    })

    it("should not allow withdrawal when match is not finished", async()=>{
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft_batch("thorMatch", {from: Thor})
        }, "reason", "match is not finished")
    })

    it("should only withdraw nft in batch, on which nft has no bid", async()=>{
        // wait until match finished
        await utils.generateBlock(helperContract, expiryBlock + 1, Steve)

        await checkOwner(mockyEarth, "2", auctionContract.address)
        await checkOwner(mockyEarth, "3", auctionContract.address)
        await checkOwner(mockyMars, "1", auctionContract.address)

        await auctionContract.creator_withdraw_nft_batch("thorMatch", {from: Thor})

        await checkOwner(mockyEarth, "1", auctionContract.address)
        await checkOwner(mockyEarth, "2", Thor)
        await checkOwner(mockyEarth, "3", Thor)
        await checkOwner(mockyMars,  "1", Thor)
    })
})

// the only difference is, this will test using withdraw 1 nft first, then withdraw batch
contract("Test creator withdraw (combined with in batch) unused Nft", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should make some bid", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})
        await auctionContract.player_bid("thorMatch", 0, 200, {from: Natasha})
    })

    it("should not allow withdrawal when match is not finished", async()=>{
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft_batch("thorMatch", {from: Thor})
        }, "reason", "match is not finished")
    })

    it("should only withdraw nft having no bid", async()=>{
        // wait until match finished
        await utils.generateBlock(helperContract, expiryBlock + 1, Steve)

        let owner 
        await auctionContract.creator_withdraw_nft("thorMatch", 1, {from: Thor})
        // tokenId "2" is at index 1 of the match ntfs array
        owner = await mockyEarth.ownerOf("2");
        assert.strictEqual(owner, Thor)
    })

    it("should only withdraw nft in batch, on which nft has no bid", async()=>{
        await checkOwner(mockyEarth, "2", Thor);                    await checkCurrentResult("thorMatch", 1, [ADDRESS_NULL, "0"])
        await checkOwner(mockyEarth, "3", auctionContract.address); await checkCurrentResult("thorMatch", 2, [ADDRESS_NULL, "100"])
        await checkOwner(mockyMars,  "1", auctionContract.address); await checkCurrentResult("thorMatch", 3, [ADDRESS_NULL, "200"])

        await auctionContract.creator_withdraw_nft_batch("thorMatch", {from: Thor})

        await checkOwner(mockyEarth, "1", auctionContract.address)
        await checkOwner(mockyEarth, "2", Thor); await checkCurrentResult("thorMatch", 1, [ADDRESS_NULL, "0"])
        await checkOwner(mockyEarth, "3", Thor); await checkCurrentResult("thorMatch", 2, [ADDRESS_NULL, "0"])
        await checkOwner(mockyMars,  "1", Thor); await checkCurrentResult("thorMatch", 3, [ADDRESS_NULL, "0"])
    })

    it("should not let owner withdraw again", async()=>{
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_nft("thorMatch", 1, {from: Thor})
        }, "reason", "token is not available to withdraw")
    })
})

contract("Creator withdraw profit", accounts => {
    utils.deployAllContracts(accounts)
    createAuction()

    it("should not let creator withdraw when their profit is 0", async()=>{
        await utils.testError(async()=>{
            await auctionContract.creator_withdraw_profit({from: Thor})
        }, "reason", "creator balance must be greater than 0")
    })

    it("should make some bid", async()=>{
        // should approve some amount of money first
        await usdcContract.approve(auctionContract.address, 140, {from: Steve})
        await usdcContract.approve(auctionContract.address, 500, {from: Natasha})
        await utils.generateBlock(helperContract, openBlock + 1, Steve)

        await auctionContract.player_bid("thorMatch", 0, 140, {from: Steve})
        await auctionContract.player_bid("thorMatch", 0, 200, {from: Natasha})
    })

    it("should wait until end and reward", async()=>{
        // await
        await utils.generateBlock(helperContract, expiryBlock + 1, Steve)

        // reward, called from someone, whoever
        tx = await auctionContract.reward("thorMatch", 0, {from: Tony})
    })

    it("should let creator withdraw", async()=>{
        let currentCreatorBalance = await auctionContract.get_creator_balance(Thor);
        assert.strictEqual(currentCreatorBalance.toString(), "200")
        let previousThorUsdc = await usdcContract.balanceOf(Thor);
        
        await auctionContract.creator_withdraw_profit({from: Thor})
        let currentThorUsdc = await usdcContract.balanceOf(Thor);

        currentCreatorBalance = await auctionContract.get_creator_balance(Thor);
        assert.strictEqual(currentCreatorBalance.toString(), "0")
        assert.strictEqual(currentThorUsdc - previousThorUsdc, 200)
    })
})