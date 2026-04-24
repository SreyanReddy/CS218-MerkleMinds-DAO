import { useState } from "react";
import { ethers } from "ethers";

const daoAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const abi = [
  "function createProposal(address,bytes)",
  "function vote(uint256,bool)",
  "function getProposal(uint256) view returns (address,uint256,uint256,uint256,bool,bool)",
  "function proposalCount() view returns (uint256)"
];

export default function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);

  const [proposals, setProposals] = useState([]);

  // CONNECT WALLET
  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    const signer = await provider.getSigner();
    const addr = await signer.getAddress();

    setAccount(addr);

    const dao = new ethers.Contract(daoAddress, abi, signer);
    setContract(dao);
  }

  // LOAD ALL PROPOSALS
  async function loadAllProposals() {
    const count = await contract.proposalCount();

    let temp = [];

    for (let i = 0; i < Number(count); i++) {
      const p = await contract.getProposal(i);

      temp.push({
        id: i,
        yes: Number(p[1]),
        no: Number(p[2]),
        deadline: Number(p[3]),
        executed: p[4],
        canceled: p[5]
      });
    }

    setProposals(temp);
  }

  // CREATE PROPOSAL
  async function createProposal() {
  try {
    const tx = await contract.createProposal(
      ethers.ZeroAddress,
      new Uint8Array([]) // 🔥 FIX: proper empty bytes
    );

    await tx.wait();

    await loadAllProposals();

    alert("Proposal Created!");
  } catch (err) {
    console.error("CREATE ERROR:", err);
    alert(err?.reason || "Create failed");
  }
}

  // VOTE FUNCTION (CLEAN + SAFE)
  async function vote(id, support) {
    try {
      const tx = await contract.vote(id, support);
      await tx.wait();

      await loadAllProposals();

      alert("Vote successful!");

    } catch (err) {
      console.error(err);

      if (err?.reason === "Already voted") {
        alert("Already voted on this proposal");
      } else {
        alert("Voting failed");
      }
    }
  }

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: "linear-gradient(to right, #0f172a, #1e293b)",
        color: "white"
      }}
    >
      <h1>DAO Governance DApp</h1>

      <button onClick={connectWallet}>
        Connect Wallet
      </button>

      <p><b>Account:</b> {account}</p>

      <hr />

      <button
        onClick={createProposal}
        disabled={!contract}
      >
        Create Proposal
      </button>

      <button
        onClick={loadAllProposals}
        disabled={!contract}
        style={{ marginLeft: 10 }}
      >
        Load Proposals
      </button>

      <hr />

      {proposals.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid gray",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8
          }}
        >
          <h3>📄 Proposal #{p.id}</h3>
          <p>👍 Yes Votes: {p.yes}</p>
          <p>👎 No Votes: {p.no}</p>
          <p>Status: {p.executed ? "Executed" : "Active"}</p>

          <button onClick={() => vote(p.id, true)}>
            Vote YES
          </button>

          <button
            onClick={() => vote(p.id, false)}
            style={{ marginLeft: 10 }}
          >
            Vote NO
          </button>
        </div>
      ))}
    </div>
  );
}