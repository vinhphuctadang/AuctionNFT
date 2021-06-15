const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

let mockyEarth, mockyMars, helperContract, auctionContract, usdcContract;

function deployAllContracts(accounts) {

    let Tony = accounts[0], Thor = accounts[1], Steve = accounts[2];

    // contracts
    const Auction = artifacts.require("Auction")
    const USDC_TOKEN = artifacts.require("USDC_TOKEN")
    const MockyEarth = artifacts.require("MockyEarth")
    const MockyMars = artifacts.require("MockyMars")
    const Helper = artifacts.require("Helper")
    it("should properly deploy contracts", async()=> {
        // require 4 contracts to be deployed 
        // create helper contract
        helperContract = await Helper.new({from: Tony})
        usdcContract   = await USDC_TOKEN.new({from: Tony})

        // create usdc contract 
        mockyEarth = await MockyEarth.new({from: Tony})
        logger.debug("mockyEarth:", mockyEarth.address);
        assert(mockyEarth.address != "", "mockyEarth address is null")
        
        // create bam contract
        mockyMars = await MockyMars.new({from: Tony})
        logger.debug("bamAddr:", mockyMars.address)
        assert(mockyMars.address != "", "BAM address is null");

        // create auction contract
        auctionContract = await Auction.new(usdcContract.address, {from: Tony})
        logger.debug("auctionContract:", auctionContract.address);
        assert(auctionContract.address != "", "Auction address is null");

        let owner;
        await mockyEarth.safeTransferFrom(Tony, Thor, "1");
        owner = await mockyEarth.ownerOf("1");
        assert.strictEqual(owner, Thor, `Expected ${Thor}, actual ${owner}`);

        await mockyEarth.safeTransferFrom(Tony, Thor, "2");
        owner = await mockyEarth.ownerOf("2");
        assert.strictEqual(owner, Thor, `Expected ${Thor}, actual ${owner}`);

        await mockyEarth.safeTransferFrom(Tony, Thor, "3");
        owner = await mockyEarth.ownerOf("3");
        assert.strictEqual(owner, Thor, `Expected ${Thor}, actual ${owner}`);
    })
}

contract("Test fail cases create auction", accounts => {
    let Tony = accounts[0], Thor = accounts[1], Steve = accounts[2];

    deployAllContracts(accounts);

    it("should not create matchId = thorMatch when the matchId is occupied", async()=>{

    })

    it("should not create match when openBlock < block.number", async()=>{

    })

    it("should not create match when openBlock > expiryBlock", async()=>{

    })

    it("should not create match when expiryBlock - openBlock < 2 * BLOCKS_TO_EXPIRE", async()=>{

    })

    it("should not create match when minBid == 0", async()=>{

    })

    it("should not create match when minIncrement > minBid * 2", async()=>{
        
    })

    it("should not create match when minIncrement = 0", async()=>{
        
    })

    it("should not create match when fails to deposit tokens", async()=>{
        
    })
})