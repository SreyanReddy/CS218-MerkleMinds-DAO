// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GovernanceToken.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DAO is AccessControl, ReentrancyGuard {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum Status { Pending, Active, Defeated, Succeeded, Executed, Cancelled }

    struct Proposal {
        string   description;
        address  target;
        bytes    data;
        uint256  startTime;     
        uint256  deadline;      
        uint256  yesVotes;
        uint256  noVotes;
        uint256  snapshotBlock; 
        address  proposer;
        bool     executed;
        bool     cancelled;
    }

    GovernanceToken public token;
    uint256 public proposalCount;
    uint256 public quorumPercent;
    uint256 public votingDelay;

    mapping(uint256 => Proposal)                        public proposals;
    mapping(uint256 => mapping(address => bool))        public hasVoted;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string  description,
        uint256 startTime,
        uint256 deadline
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool    support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    constructor(address _token, uint256 _votingDelay) {
        require(_token != address(0), "Zero token address");
        token        = GovernanceToken(_token);
        votingDelay  = _votingDelay;
        quorumPercent = 30;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function setQuorumPercent(uint256 _quorum) external onlyRole(ADMIN_ROLE) {
        require(_quorum > 0 && _quorum <= 100, "Invalid quorum");
        quorumPercent = _quorum;
    }



    function createProposal(
        string  memory _description,
        address        _target,
        bytes   memory _data,
        uint256        _votingPeriod
    ) external {
        require(token.balanceOf(msg.sender) > 0, "Not a token holder");
        require(_votingPeriod > 0, "Invalid voting period");

        proposalCount++;

        uint256 start = block.timestamp + votingDelay;
        uint256 end   = start + _votingPeriod;

        proposals[proposalCount] = Proposal({
            description:   _description,
            target:        _target,
            data:          _data,
            startTime:     start,
            deadline:      end,
            yesVotes:      0,
            noVotes:       0,
            snapshotBlock: block.number,
            proposer:      msg.sender,
            executed:      false,
            cancelled:     false
        });

        emit ProposalCreated(proposalCount, msg.sender, _description, start, end);
    }


    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.deadline != 0,              "Proposal does not exist");
        require(!proposal.cancelled,                 "Proposal cancelled");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp < proposal.deadline,  "Voting ended");

        uint256 weight = token.getPastVotes(msg.sender, proposal.snapshotBlock);
        require(weight > 0,                          "No voting power");
        require(!hasVoted[proposalId][msg.sender],   "Already voted");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.yesVotes += weight;
        } else {
            proposal.noVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.deadline != 0,             "Proposal does not exist");
        require(block.timestamp >= proposal.deadline, "Voting still active");
        require(!proposal.executed,                 "Already executed");
        require(!proposal.cancelled,                "Proposal cancelled");

        uint256 totalVotes  = proposal.yesVotes + proposal.noVotes;
        uint256 totalSupply = token.totalSupply();

        require(totalVotes * 100 >= totalSupply * quorumPercent, "Quorum not reached");
        require(proposal.yesVotes > proposal.noVotes,            "Proposal rejected");

        proposal.executed = true;

        (bool success, ) = proposal.target.call(proposal.data);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.deadline != 0,             "Proposal does not exist");
        require(msg.sender == proposal.proposer,    "Not proposer");
        require(!proposal.executed,                 "Already executed");
        require(!proposal.cancelled,                "Already cancelled");
        require(block.timestamp < proposal.startTime, "Voting already started");

        proposal.cancelled = true;

        emit ProposalCancelled(proposalId);
    }


    function getProposalStatus(uint256 proposalId) public view returns (Status) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.deadline != 0, "Proposal does not exist");

        if (proposal.cancelled) return Status.Cancelled;
        if (proposal.executed)  return Status.Executed;

        if (block.timestamp < proposal.startTime) return Status.Pending;
        if (block.timestamp < proposal.deadline)  return Status.Active;

        uint256 totalVotes  = proposal.yesVotes + proposal.noVotes;
        uint256 totalSupply = token.totalSupply();
        bool quorumMet      = totalVotes * 100 >= totalSupply * quorumPercent;
        bool majorityYes    = proposal.yesVotes > proposal.noVotes;

        return (quorumMet && majorityYes) ? Status.Succeeded : Status.Defeated;
    }



    function getProposal(uint256 proposalId)
        external
        view
        returns (
            string  memory description,
            address        target,
            bytes   memory data,
            uint256        deadline,
            uint256        yesVotes,
            uint256        noVotes,
            bool           executed,
            bool           cancelled,
            bool           quorumReached,
            Status         status
        )
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.deadline != 0, "Proposal does not exist");

        uint256 totalVotes  = proposal.yesVotes + proposal.noVotes;
        uint256 totalSupply = token.totalSupply();
        bool qReached       = totalVotes * 100 >= totalSupply * quorumPercent;

        return (
            proposal.description,
            proposal.target,
            proposal.data,
            proposal.deadline,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.executed,
            proposal.cancelled,
            qReached,
            getProposalStatus(proposalId)
        );
    }
}
