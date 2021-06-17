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
            blockCount + 30, 10, 20,
            [ {
                contractAddress: mockyEarth.address,
                tokenId: "1",
                minBid: 100
            } ],
            {from: Thor}
        )

        logger.info("Creating match with the same Id ...")
        blockCount = await utils.getBlockCount();
        await mockyEarth.approve(auctionContract.address, "2", {from: Thor})
        // create match with same Id
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    matchId, blockCount + 2, 
                    blockCount + 30, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 100
                    } ],
                    {from: Thor}
                )
            }, "reason", "matchId is occupied")
    })

    it("should not create match when openBlock < block.number or openBlock == block.number", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => {
                await auctionContract.createAuction(
                    "thorMatch", blockCount - 1, 
                    blockCount + 100, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 100
                    } ],
                    {from: Thor}
                )
            },
            "reason", "condition expiryBlock > openBlock > current block count not satisfied");

        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount, 
                    blockCount + 100, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 100
                    } ],
                    {from: Thor}
                )
            },
            "reason", "condition expiryBlock > openBlock > current block count not satisfied");
    })

    it("should not create match when openBlock > expiryBlock", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 30, 
                    blockCount + 5, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 100
                    } ],
                    {from: Thor}
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
                    blockCount + 8, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 100
                    } ],
                    {from: Thor}
                )
            },
            "reason", "auction time must not less than 2x BLOCKS_TO_EXPIRE");
    })

    it("should not create match when there is some minBid == 0", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => {
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 0
                    } ],
                    {from: Thor}
                )
            },
            "reason", "minBid must be greater than 1");
    })

    it("should not create match when minIncrement >= 100", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 101,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 100
                    } ],
                    {from: Thor}
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
                    blockCount + 19, 10, 1,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "2",
                        minBid: 20
                    } ],
                    {from: Thor}
                )
            },
            "reason", "increment should be greater than 0");
    })

    it("should not create match when fails to deposit tokens", async()=>{
        let blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "1",
                        minBid: 100
                    } ],
                    {from: Thor}
                )
            },
            "reason", "ERC721: transfer of token that is not own");
        
        blockCount = await utils.getBlockCount();
        await utils.testError(
            async () => { 
                await auctionContract.createAuction(
                    "thorMatch", blockCount + 2, 
                    blockCount + 19, 10, 20,
                    [ {
                        contractAddress: mockyEarth.address,
                        tokenId: "4",
                        minBid: 100
                    } ],
                    {from: Thor}
                )
            },
            "reason", "ERC721: operator query for nonexistent token");
    })
})

contract("Test fail cases create auction", accounts => {
    utils.deployAllContracts(accounts)

    it("shoud not allow creating contract having 2 same nft", async()=>{
        // approve token
        await mockyEarth.approve(auctionContract.address, "1", {from: Thor})

        let blockCount = await utils.getBlockCount();

        utils.testError(async()=>{
            await auctionContract.createAuction(
                "thorMatch", blockCount + 2, 
                blockCount + 30, 10, 20,
                [ 
                    {
                        contractAddress: mockyEarth.address,
                        tokenId: "1",
                        minBid: 100
                    },
                    {
                        contractAddress: mockyEarth.address,
                        tokenId: "1",
                        minBid: 200
                    }
                ],
                {from: Thor}
            )
        }, "reason", "ERC721: transfer of token that is not own")
    })

    it("should successfully create a match and get events", async()=>{
        // create match
        let blockCount = await utils.getBlockCount();

        let tx = await auctionContract.createAuction(
            "thorMatch", blockCount + 2, 
            blockCount + 30, 10, 20,
            [ {
                contractAddress: mockyEarth.address,
                tokenId: "1",
                minBid: 100
            } ],
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
            "1"
        ]

        // deep equals just produces weird error on types
        assert.strictEqual(JSON.stringify(matchData), JSON.stringify(expectedMatchData));

        let expectedEvent = {
            creatorAddress: Thor, 
            matchId: "thorMatch",
            openBlock: blockCount + 2,
            expiryBlock: blockCount + 30,
            increment: 20,
            expiryExtension: 10,
            nfts: `${mockyEarth.address},1,100`
        }

        // expect createAuctionEvent == expectedEvent
        utils.eventEquals(tx, "CreateAuctionEvent", expectedEvent)

        // expect owner is contract
        let owner;
        owner = await mockyEarth.ownerOf("1")
        // owner should be contract
        assert.strictEqual(owner.toString(), auctionContract.address.toString())
    })

    // it("should not create auction with number of nft exceeds limit", async()=>{
    // })
})