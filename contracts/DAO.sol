// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAO is ReentrancyGuard, Ownable {

    struct Proposal {
        address creator;
        address target;
        bytes data;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool executed;
        bool canceled;
        mapping(address => bool) voted;
    }

    uint256 public proposalCount;
    uint256 public quorumPercent = 30;

    mapping(uint256 => Proposal) private proposals;
    mapping(address => uint256) public votingPower;

    event ProposalCreated(uint256 id, address creator);
    event Voted(uint256 id, address voter, bool support);
    event Executed(uint256 id);
    event Canceled(uint256 id);

    constructor() {}

    function setVotingPower(address user, uint256 power) external onlyOwner {
        votingPower[user] = power;
    }

    function createProposal(address _target, bytes memory _data) external returns (uint256) {
        Proposal storage p = proposals[proposalCount];

        p.creator = msg.sender;
        p.target = _target;
        p.data = _data;
        p.deadline = block.timestamp + 1 days;

        emit ProposalCreated(proposalCount, msg.sender);

        proposalCount++;

        return proposalCount - 1;
    }

    function vote(uint256 _id, bool support) external {
        require(_id < proposalCount, "Invalid proposal ID");

        Proposal storage p = proposals[_id];

        require(p.creator != address(0), "Proposal not found");
        require(block.timestamp < p.deadline, "Voting ended");
        require(!p.voted[msg.sender], "Already voted");
        require(votingPower[msg.sender] > 0, "No voting power");

        p.voted[msg.sender] = true;

        if (support) {
            p.yesVotes += votingPower[msg.sender];
        } else {
            p.noVotes += votingPower[msg.sender];
        }

        emit Voted(_id, msg.sender, support);
    }

    function executeProposal(uint256 _id) external nonReentrant {
        require(_id < proposalCount, "Invalid proposal ID");

        Proposal storage p = proposals[_id];

        require(block.timestamp >= p.deadline, "Voting not ended");
        require(!p.executed, "Already executed");
        require(!p.canceled, "Canceled");

        uint256 totalVotes = p.yesVotes + p.noVotes;
        require(totalVotes > 0, "No votes");

        uint256 quorum = (p.yesVotes * 100) / totalVotes;
        require(quorum >= quorumPercent, "Quorum not met");

        require(p.yesVotes > p.noVotes, "Rejected");

        p.executed = true;

        (bool success, ) = p.target.call(p.data);
        require(success, "Execution failed");

        emit Executed(_id);
    }

    function cancelProposal(uint256 _id) external {
        require(_id < proposalCount, "Invalid proposal ID");

        Proposal storage p = proposals[_id];

        require(msg.sender == p.creator, "Not creator");
        require(block.timestamp < p.deadline, "Too late");

        p.canceled = true;

        emit Canceled(_id);
    }

    function getProposal(uint256 _id)
        external
        view
        returns (
            address creator,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 deadline,
            bool executed,
            bool canceled
        )
    {
        require(_id < proposalCount, "Invalid proposal ID");

        Proposal storage p = proposals[_id];

        return (
            p.creator,
            p.yesVotes,
            p.noVotes,
            p.deadline,
            p.executed,
            p.canceled
        );
    }
}