const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

contract("Test player bid", accounts => {
    utils.deployAllContracts(accounts)

    it("should not let player bid when open block is not yet mined", async()=>{

    })

    it("should not let player bid when expiryBlock is mined", async()=>{
        
    })

    it("should not let player bid invalid token index", async()=>{

    })

    it("should not let player bid with less-than-current amount", async()=>{

    })

    it("should not let player bid with invalid increment", async()=>{
        
    })

    it("should not let player bid with doubled current value", async()=>{
        
    })

    it("should let player bid and not expand auction time", async()=>{
        // check bid value

        // check balance

        // check event
    })

    it("should let player bid and expand auction time", async()=>{

    })

    it("should let player bid on 2 different nft", async()=>{

    })

    it("should let player bid on 2 different match", async()=>{

    })

    it("should let user withdraw on one match", async()=>{
        
    })
})