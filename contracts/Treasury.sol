// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Treasury {

    address public owner;
    uint256 public balance;

    event Deposited(address from, uint256 amount);
    event Withdrawn(address to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        balance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(address payable to, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        require(address(this).balance >= amount, "Not enough balance");

        to.transfer(amount);
        emit Withdrawn(to, amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}