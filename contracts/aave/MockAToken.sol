// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Minimal aToken for a single underlying asset.
contract MockAToken is ERC20 {
    address public immutable POOL;
    uint8 private immutable _decimals;

    modifier onlyPool() {
        require(msg.sender == POOL, "ONLY_POOL");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address pool_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        POOL = pool_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyPool {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyPool {
        _burn(from, amount);
    }
}

