const assert = require("assert")
const logger = require("./logger")

module.exports = {
    eventEquals: function(tx, eventName, expectedData) {
        let depositEvent = tx.logs.filter(event => event.event === eventName)
        assert.strictEqual(depositEvent.length, 1)
            
        let args = depositEvent[0].args 
        logger.debug("Event args:", args)

        let cnt = 0
        for(let key in expectedData) {
            let x
            x = args[key]
            assert.strictEqual(x.toString(), expectedData[key].toString(), `Error on field ${key}`)
            cnt ++;
        }       
    },

    generateBlock: async function(helperContract, targetBlock, caller) {
        let blockCount = parseInt(await helperContract.get_block_count({from: caller}))
        assert(targetBlock > blockCount, `blockCount: ${blockCount} >= target: ${targetBlock}`);

        for(let i = blockCount; i < targetBlock; ++i) {
            logger.info(`Creating block ${i+1}, target: >${targetBlock} ...`)
            // generate (expectedFutureBlock - blockCount) blocks (to when future block created)
            await helperContract.dummy_assign()
        }
    },

    deployAllContracts: function (accounts) {
        global.Tony    = accounts[0]
        global.Thor    = accounts[1]
        global.Steve   = accounts[2]
        global.Natasha = accounts[4];
        // contracts
        const Auction = artifacts.require("Auction")
        const USDC_TOKEN = artifacts.require("USDC_TOKEN")
        const MockyEarth = artifacts.require("MockyEarth")
        const MockyMars = artifacts.require("MockyMars")
        const Helper = artifacts.require("Helper")

        // test case: deploy contract
        it("should properly deploy contracts", async()=> {
            // require 4 contracts to be deployed 
            // create helper contract
            global.helperContract = await Helper.new({from: Tony})
            global.usdcContract   = await USDC_TOKEN.new({from: Tony})

            // create usdc contract 
            global.mockyEarth = await MockyEarth.new({from: Tony})
            logger.debug("mockyEarth:", mockyEarth.address);
            assert(mockyEarth.address != "", "mockyEarth address is null")
            
            // create bam contract
            global.mockyMars = await MockyMars.new({from: Tony})
            logger.debug("mockyMars:", mockyMars.address)
            assert(mockyMars.address != "", "mockyMars address is null");

            // create auction contract
            global.auctionContract = await Auction.new(usdcContract.address, {from: Tony})
            logger.debug("auctionContract:", auctionContract.address);
            assert(auctionContract.address != "", "Auction address is null");

            let owner;
            for(let tokenId of ["1", "2", "3"]) {
                await mockyEarth.safeTransferFrom(Tony, Thor, tokenId);
                owner = await mockyEarth.ownerOf(tokenId);
                assert.strictEqual(owner, Thor, `Expected ${Thor}, actual ${owner}`);
            }

            for(let tokenId of ["1", "2", "3"]) {
                await mockyMars.safeTransferFrom(Tony, Thor, tokenId);
                owner = await mockyMars.ownerOf(tokenId);
                assert.strictEqual(owner, Thor, `Expected ${Thor}, actual ${owner}`);
            }
       })
    },

    testError: async function(func, testField, errorString) {
        try {
            await func();
        }
        catch(err) {
            logger.error("Error happened:", err.toString())
            return assert.strictEqual(err[testField], errorString);
        }
        throw `Expect: ${errorString} but no error thrown`
    },
    getBlockCount: async function(){
        return parseInt(await helperContract.get_block_count());
    }
}