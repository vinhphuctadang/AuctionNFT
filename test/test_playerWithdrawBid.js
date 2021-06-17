const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

contract("Test fail cases create auction", accounts => {
    utils.deployAllContracts(accounts)
    it("should not let player withdraw on invalid token index", async()=>{

    })

    it("should not let topBidder withdraw Bid", async()=>{

    })

    it("should not let someone withdraw when his/her bid == 0", async()=>{

    })

    it("should let player withdraw", async()=>{

    })

    
})