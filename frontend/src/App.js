import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_CONFIG } from "./contract";

// Matches DAO.sol Status enum: Pending=0, Active=1, Defeated=2, Succeeded=3, Executed=4, Cancelled=5
const STATUS_LABEL = ["Pending", "Active", "Defeated", "Succeeded", "Executed", "Cancelled"];
const STATUS_COLOR = ["#94a3b8", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6", "#f97316"];

export default function App() {
  const [account, setAccount]     = useState("");
  const [balance, setBalance]     = useState("");
  const [dao, setDao]             = useState(null);
  const [proposals, setProposals] = useState([]);
  const [txStatus, setTxStatus]   = useState("");

  // Create proposal form
  const [description, setDescription] = useState("");
  const [target, setTarget]           = useState("");
  const [calldata, setCalldata]       = useState("0x");
  const [votingDays, setVotingDays]   = useState(7);

  function getContractConfig() {
    const { addresses, abi } = CONTRACT_CONFIG || {};
    if (!addresses?.dao || !addresses?.token || !abi?.dao || !abi?.token) {
      throw new Error("Contract config missing. Run: npm run deploy:localhost");
    }
    return {
      daoAddress: addresses.dao,
      tokenAddress: addresses.token,
      daoAbi: abi.dao,
      tokenAbi: abi.token,
    };
  }

  async function connectWallet() {
    if (!window.ethereum) { alert("Install MetaMask"); return; }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr   = await signer.getAddress();

      setAccount(addr);

      const { daoAddress, tokenAddress, daoAbi, tokenAbi } = getContractConfig();
      const daoContract = new ethers.Contract(daoAddress, daoAbi, signer);
      const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);

      setDao(daoContract);

      const bal = await tokenContract.balanceOf(addr);
      setBalance(ethers.formatUnits(bal, 18));

      setTxStatus("Wallet connected.");
    } catch (err) {
      setTxStatus("Wallet connect failed: " + (err?.reason || err.message));
    }
  }

  async function loadProposals() {
    if (!dao) return;
    try {
      setTxStatus("Loading proposals...");
      const count = Number(await dao.proposalCount());
      const list  = [];

      for (let i = 1; i <= count; i++) {   // proposals are 1-indexed in our contract
        const p = await dao.getProposal(i);
        list.push({
          id:           i,
          description:  p.description,
          yesVotes:     ethers.formatUnits(p.yesVotes, 18),
          noVotes:      ethers.formatUnits(p.noVotes,  18),
          deadline:     new Date(Number(p.deadline) * 1000).toLocaleString(),
          executed:     p.executed,
          cancelled:    p.cancelled,
          quorumReached: p.quorumReached,
          status:       Number(p.status),
        });
      }

      setProposals(list);
      setTxStatus(`Loaded ${count} proposal(s).`);
    } catch (err) {
      setTxStatus("Failed to load: " + (err?.reason || err.message));
    }
  }

  async function createProposal() {
    if (!dao || !description) return;
    try {
      setTxStatus("Submitting proposal...");
      const period = ethers.toBigInt(Math.round(Number(votingDays))) * 86400n;
      const tx = await dao.createProposal(
        description,
        target || ethers.ZeroAddress,
        calldata || "0x",
        period
      );
      await tx.wait();
      setTxStatus("Proposal created successfully!");
      setDescription(""); setTarget(""); setCalldata("0x"); setVotingDays(7);
      await loadProposals();
    } catch (err) {
      setTxStatus("Create failed: " + (err?.reason || err.message));
    }
  }

  async function vote(id, support) {
    if (!dao) return;
    try {
      setTxStatus(`Casting ${support ? "YES" : "NO"} vote on proposal #${id}...`);
      const tx = await dao.vote(id, support);
      await tx.wait();
      setTxStatus(`Vote cast successfully on proposal #${id}!`);
      await loadProposals();
    } catch (err) {
      setTxStatus("Vote failed: " + (err?.reason || err.message));
    }
  }

  async function executeProposal(id) {
    if (!dao) return;
    try {
      setTxStatus(`Executing proposal #${id}...`);
      const tx = await dao.executeProposal(id);
      await tx.wait();
      setTxStatus(`Proposal #${id} executed!`);
      await loadProposals();
    } catch (err) {
      setTxStatus("Execute failed: " + (err?.reason || err.message));
    }
  }

  return (
    <div style={{
      padding: 24, minHeight: "100vh",
      background: "linear-gradient(to right, #0f172a, #1e293b)",
      color: "white", fontFamily: "sans-serif"
    }}>
      <h1 style={{ marginBottom: 4 }}>DAO Governance DApp</h1>
      <p style={{ color: "#64748b", marginTop: 0 }}>CS218 — MerkleMinds</p>

      {/* ── Wallet ── */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={connectWallet} style={btn("#3b82f6")}>
          {account ? "✓ Connected" : "Connect MetaMask"}
        </button>
        {account && (
          <span style={{ fontSize: 14, color: "#94a3b8" }}>
            {account.slice(0, 6)}…{account.slice(-4)}
            &nbsp;|&nbsp;
            Balance: <b style={{ color: "#22c55e" }}>{Number(balance).toFixed(2)} GT</b>
          </span>
        )}
      </div>

      {/* ── Status bar ── */}
      {txStatus && (
        <div style={{
          background: "#1e3a5f", padding: "8px 14px", borderRadius: 6,
          marginBottom: 16, fontSize: 14, color: "#93c5fd"
        }}>
          {txStatus}
        </div>
      )}

      <hr style={{ borderColor: "#334155", marginBottom: 20 }} />

      {/* ── Create Proposal ── */}
      <h2 style={{ marginBottom: 10 }}>Create Proposal</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 500, marginBottom: 24 }}>
        <input
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={input}
        />
        <input
          placeholder="Target contract address (0x...)"
          value={target}
          onChange={e => setTarget(e.target.value)}
          style={input}
        />
        <input
          placeholder="Calldata (0x for none)"
          value={calldata}
          onChange={e => setCalldata(e.target.value)}
          style={input}
        />
        <input
          type="number" min={1}
          placeholder="Voting period (days)"
          value={votingDays}
          onChange={e => setVotingDays(e.target.value)}
          style={input}
        />
        <button
          onClick={createProposal}
          disabled={!dao || !description}
          style={btn("#8b5cf6")}
        >
          Submit Proposal
        </button>
      </div>

      <hr style={{ borderColor: "#334155", marginBottom: 20 }} />

      {/* ── Proposals ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Proposals</h2>
        <button onClick={loadProposals} disabled={!dao} style={btn("#0ea5e9")}>
          Load / Refresh
        </button>
      </div>

      {proposals.length === 0 && (
        <p style={{ color: "#64748b" }}>No proposals yet. Connect wallet and click Load.</p>
      )}

      {proposals.map(p => (
        <div key={p.id} style={{
          border: "1px solid #334155", padding: 16, marginBottom: 12,
          borderRadius: 10, background: "#0f172a"
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>
              #{p.id} — {p.description || "(no description)"}
            </h3>
            <span style={{
              background: STATUS_COLOR[p.status], color: "#fff",
              padding: "3px 10px", borderRadius: 12, fontSize: 13, fontWeight: 600
            }}>
              {STATUS_LABEL[p.status]}
            </span>
          </div>

          {/* Stats */}
          <div style={{ marginTop: 10, fontSize: 14, color: "#94a3b8", display: "flex", gap: 20, flexWrap: "wrap" }}>
            <span>👍 Yes: <b style={{ color: "#22c55e" }}>{Number(p.yesVotes).toFixed(0)}</b></span>
            <span>👎 No: <b style={{ color: "#ef4444" }}>{Number(p.noVotes).toFixed(0)}</b></span>
            <span>
              Quorum:&nbsp;
              <b style={{ color: p.quorumReached ? "#22c55e" : "#ef4444" }}>
                {p.quorumReached ? "Met ✓" : "Not met"}
              </b>
            </span>
            <span>⏰ Deadline: {p.deadline}</span>
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            {p.status === 1 && (  /* Active */
              <>
                <button onClick={() => vote(p.id, true)}  style={btn("#22c55e")}>Vote YES</button>
                <button onClick={() => vote(p.id, false)} style={btn("#ef4444")}>Vote NO</button>
              </>
            )}
            {p.status === 3 && (  /* Succeeded */
              <button onClick={() => executeProposal(p.id)} style={btn("#8b5cf6")}>
                Execute Proposal
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const btn = (bg) => ({
  background: bg, color: "white", border: "none",
  padding: "8px 16px", borderRadius: 6,
  cursor: "pointer", fontWeight: 600, fontSize: 14,
});

const input = {
  padding: "8px 12px", borderRadius: 6, border: "1px solid #334155",
  background: "#1e293b", color: "white", fontSize: 14,
  width: "100%", boxSizing: "border-box",
};
