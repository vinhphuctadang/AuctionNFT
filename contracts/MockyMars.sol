pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockyEarth is ERC721 {
    constructor() ERC721("MockyEarth", "EARTH") {

    }
}