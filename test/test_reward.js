const assert = require("assert")
const logger = require("./logger")
const utils = require('./utils')

contract("Test fail cases create auction", accounts => {
    utils.deployAllContracts(accounts)

    it("should not reward on unfinished match", async()=>{

    })

    it("should not reward on invalid token index", async()=>{

    })

    it("should not reward on token having no bid", async()=>{

    })

    it("should reward winner and check if state changed", async()=>{
        
    })
})