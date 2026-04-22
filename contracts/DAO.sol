// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GovernanceToken.sol";

contract DAO {
    struct Proposal {
        string description;
        address target;
        bytes data;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool cancelled;
    }

    GovernanceToken public token;
    uint256 public proposalCount;
    uint256 public quorumPercent = 30;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    constructor(address _token) {
        token = GovernanceToken(_token);
    }

    function createProposal(
        string memory _description,
        address _target,
        bytes memory _data,
        uint256 _votingPeriod
    ) external {
        require(token.balanceOf(msg.sender) > 0, "Not a token holder");

        proposalCount++;

        proposals[proposalCount] = Proposal({
            description: _description,
            target: _target,
            data: _data,
            deadline: block.timestamp + _votingPeriod,
            yesVotes: 0,
            noVotes: 0,
            executed: false,
            cancelled: false
        });
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.deadline != 0, "Proposal does not exist");
        require(block.timestamp < proposal.deadline, "Voting ended");

        uint256 voterWeight = token.balanceOf(msg.sender);
        require(voterWeight > 0, "Not a token holder");

        require(!hasVoted[proposalId][msg.sender], "Already voted");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.yesVotes += voterWeight;
        } else {
            proposal.noVotes += voterWeight;
        }
    }

    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.deadline != 0, "Proposal does not exist");
        require(block.timestamp >= proposal.deadline, "Voting still active");
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Proposal cancelled");

        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        uint256 totalSupply = token.totalSupply();

        require(
            totalVotes * 100 >= totalSupply * quorumPercent,
            "Quorum not reached"
        );

        require(proposal.yesVotes > proposal.noVotes, "Proposal rejected");

        proposal.executed = true;

        (bool success, ) = proposal.target.call(proposal.data);
        require(success, "Execution failed");
    }

    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.deadline != 0, "Proposal does not exist");
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Already cancelled");
        require(block.timestamp < proposal.deadline, "Voting ended");

        proposal.cancelled = true;
    }

    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (
            string memory description,
            address target,
            bytes memory data,
            uint256 deadline,
            uint256 yesVotes,
            uint256 noVotes,
            bool executed,
            bool cancelled
        )
    {
        Proposal storage proposal = proposals[proposalId];

        return (
            proposal.description,
            proposal.target,
            proposal.data,
            proposal.deadline,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.executed,
            proposal.cancelled
        );
    }
}
