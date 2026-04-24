// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Treasury
/// @notice Secure fund storage controlled exclusively by the DAO contract.
///         Accepts ETH deposits and allows the DAO to transfer ETH and update state.
contract Treasury is ReentrancyGuard {

    address public dao;
    uint256 public storedValue;

    /// @notice Deploy the Treasury
    /// @param _dao Address of the DAO contract that controls this treasury
    constructor(address _dao) {
        require(_dao != address(0), "Zero address");
        dao = _dao;
    }

    modifier onlyDAO() {
        require(msg.sender == dao, "Not DAO");
        _;
    }

    /// @notice Update a generic on-chain value; callable only by the DAO
    /// @param _value New value to store
    function setValue(uint256 _value) external onlyDAO {
        storedValue = _value;
    }

    /// @notice Transfer ETH from the treasury to a recipient; callable only by the DAO
    /// @param to     Recipient address
    /// @param amount ETH amount in wei
    function transferETH(address payable to, uint256 amount) external onlyDAO nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /// @notice Release ETH to an address; callable only by the DAO
    /// @dev Alias of transferETH; this signature is used as the on-chain execution target in governance tests
    /// @param to     Recipient address
    /// @param amount ETH amount in wei
    function release(address payable to, uint256 amount) external onlyDAO nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /// @notice Accept ETH deposits
    receive() external payable {}
}
