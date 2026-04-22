// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Treasury {

    address public dao;
    uint256 public storedValue;

    constructor(address _dao) {
        dao = _dao;
    }

    modifier onlyDAO() {
        require(msg.sender == dao, "Not DAO");
        _;
    }

    function setValue(uint256 _value) external onlyDAO {
        storedValue = _value;
    }

    function transferETH(address payable to, uint256 amount) external onlyDAO {
        require(address(this).balance >= amount, "Insufficient balance");
        to.transfer(amount);
    }

    receive() external payable {}
}