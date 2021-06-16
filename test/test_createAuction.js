const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

contract("Test fail cases create auction", accounts => {
    utils.deployAllContracts(accounts)

    it("should not create matchId = thorMatch when the matchId is occupied", async()=>{
        //logger.debug("Thor address:", Thor);
        let matchId = "thorNftMatch"
        logger.info("Creating valid match ...")
        // approve token
        await mockyEarth.approve(auctionContract.address, "1", {from: Thor})

        // create auction
        let blockCount = await utils.getBlockCount();

        await auctionContract.createAuction(
            matchId, blockCount + 2, 
            blockCount + 30, 10, 20, 100,
            [ mockyEarth.address ],
            ["1"],
            {from: Thor}
        )

        logger.info("Creating match with the same Id ...")
        
        await mockyEarth.approve(auctionContract.address, "2", {from: Thor})
        // create match with same Id
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    matchId, blockCount + 5, 
                    blockCount + 30, 10, 20, 100,
                    [ mockyEarth.address ],
                    ["2"],
                    {from: Thor}
                )
            }, "reason", "matchId is occupied")
    })

    it("should not create match when openBlock < block.number or openBlock ==block.number", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount - 1, 
                    blockCount + 100, 10, 20, 100,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "condition expiryBlock > openBlock > current block count not satisfied");

        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount, 
                    blockCount + 10, 10, 20, 100,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "condition expiryBlock > openBlock > current block count not satisfied");
    })

    it("should not create match when openBlock > expiryBlock", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 31, 
                    blockCount + 20, 10, 20, 100,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "condition expiryBlock > openBlock > current block count not satisfied");
    })

    it("should not create match when expiryBlock - openBlock < 2 * BLOCKS_TO_EXPIRE", async()=>{
        // expiryBlock - openBlock < 2 * BLOCKS_TO_EXPIRE
        // TODO: Try again for this case
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 8, 10, 20, 100,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "auction time must not less than 2x BLOCKS_TO_EXPIRE");
    })

    it("should not create match when minBid == 0", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 20, 0,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "min bid should be greater than 0");
    })

    it("should not create match when minIncrement >= 100", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 100, 50,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "increment must be greater than 0 and less than 100%");
    })

    it("should not create match when minIncrement = 0", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 1, 50,
                    [ mockyEarth.address ],
                    ["2"]
                )
            },
            "reason", "increment must be greater than 0 and less than 100%");
    })

    it("should not create match when fails to deposit tokens", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 20, 50,
                    [ mockyEarth.address ],
                    ["1"]
                )
            },
            "reason", "ERC721: transfer of token that is not own");
        
        blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 20, 50,
                    [ mockyEarth.address ],
                    ["4"]
                )
            },
            "reason", "ERC721: operator query for nonexistent token");
    })
})

contract("Test fail cases create auction", accounts => {
    utils.deployAllContracts(accounts)
    it("should successfully create a match and get events", async()=>{

        // approve token
        await mockyEarth.approve(auctionContract.address, "1", {from: Thor})
        // create match
        let blockCount = await utils.getBlockCount();

        await auctionContract.createAuction(
            "thorMatch", blockCount + 2, 
            blockCount + 30, 10, 20, 100,
            [ mockyEarth.address ],
            ["1"],
            {from: Thor}
        )

        let amatch = await auctionContract.get_match("thorMatch")

        let matchData = []
        for(let key in amatch) {
            let x = amatch[key].toString()
            // string case
            matchData.push(x);
        }

        // amatch.creatorAddress,
        // amatch.minIncrement, 
        // amatch.openBlock,
        // amatch.expiryBlock,
        // amatch.expiryExtension, 
        // amatch.minBid

        let expectedMatchData = [
            Thor,
            "20",
            (blockCount + 2).toString(),
            (blockCount + 30).toString(),
            "10",
            "100"
        ]

        // deep equals just produces weird error on types
        assert.strictEqual(JSON.stringify(matchData), JSON.stringify(expectedMatchData));
        
        let owner;
        owner = await mockyEarth.ownerOf("1")
        // owner should be contract
        assert.strictEqual(owner.toString(), auctionContract.address.toString())
    })
})