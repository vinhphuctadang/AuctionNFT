pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockyMars is ERC721 {

    constructor() ERC721("MockyEarth", "MARS") {
        _safeMint(msg.sender, 0x1);
        _safeMint(msg.sender, 0x2);
        _safeMint(msg.sender, 0x3);
    }
}