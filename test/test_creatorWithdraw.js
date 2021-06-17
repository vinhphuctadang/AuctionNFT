const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

contract("Creator withdraw unused Nft", accounts => {
    utils.deployAllContracts(accounts)

    it("should not allow withdraw nft having some bidder", async()=>{
        
    })

    it("should only withdraw nft having no bid", async()=>{

    })
})

contract("Creator withdraw in batch unused Nft", accounts => {
    utils.deployAllContracts(accounts)

    it("should not allow withdraw nft having some bidder", async()=>{
        
    })

    it("should only withdraw nft in batch, on which nft has no bid ", async()=>{

    })
})

contract("Creator withdraw profit", accounts => {
    utils.deployAllContracts(accounts)
    it("should not let creator withdraw when their profit is 0", async()=>{

    })

    it("should let creator withdraw", async()=>{
        
    })
})