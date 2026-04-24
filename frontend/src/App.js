import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_CONFIG } from "./contract";

// Matches DAO.sol Status enum: Pending=0, Active=1, Defeated=2, Succeeded=3, Executed=4, Cancelled=5
const STATUS_LABEL = ["Pending", "Active", "Defeated", "Succeeded", "Executed", "Cancelled"];
const STATUS_COLOR = ["#94a3b8", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6", "#f97316"];
const EXPECTED_CHAIN_ID = 31337n; // Hardhat / localhost

export default function App() {
  // Wallet + contracts
  const [provider, setProvider]   = useState(null);
  const [account,  setAccount]    = useState("");
  const [chainId,  setChainId]    = useState(null);
  const [dao,      setDao]        = useState(null);
  const [token,    setToken]      = useState(null);
  const [treasury, setTreasury]   = useState(null);

  // On-chain live data
  const [balance,       setBalance]       = useState("0");
  const [votingPower,   setVotingPower]   = useState("0");
  const [delegatee,     setDelegatee]     = useState(ethers.ZeroAddress);
  const [totalSupply,   setTotalSupply]   = useState("0");
  const [quorumPercent, setQuorumPercent] = useState("30");
  const [votingDelay,   setVotingDelay]   = useState("0");
  const [treasuryEth,   setTreasuryEth]   = useState("0");
  const [proposals,     setProposals]     = useState([]);

  // UI state
  const [txStatus,   setTxStatus]   = useState("");
  const [fatalError, setFatalError] = useState("");

  // Proposal form
  const [description,      setDescription]      = useState("");
  const [target,           setTarget]           = useState("");
  const [calldata,         setCalldata]         = useState("0x");
  const [votingDays,       setVotingDays]       = useState(7);
  const [presetKind,       setPresetKind]       = useState("setValue");
  const [presetValue,      setPresetValue]      = useState("42");
  const [presetRecipient,  setPresetRecipient]  = useState("");
  const [presetAmountEth,  setPresetAmountEth]  = useState("0.1");

  const addresses = CONTRACT_CONFIG?.addresses || {};
  const treasuryIface = useMemo(() => {
    try { return new ethers.Interface(CONTRACT_CONFIG?.abi?.treasury || []); }
    catch { return null; }
  }, []);

  // ── Connect wallet ─────────────────────────────────────────────────────────
  async function connectWallet() {
    setFatalError("");
    if (!window.ethereum) {
      setFatalError("MetaMask not detected. Install it from https://metamask.io and refresh.");
      return;
    }

    try {
      setTxStatus("Requesting wallet connection...");
      const prov = new ethers.BrowserProvider(window.ethereum);
      await prov.send("eth_requestAccounts", []);
      const sgn  = await prov.getSigner();
      const addr = await sgn.getAddress();
      const net  = await prov.getNetwork();
      const cid  = net.chainId;

      setProvider(prov);
      setAccount(addr);
      setChainId(cid);

      if (!addresses?.dao || !addresses?.token || !addresses?.treasury) {
        setFatalError(
          "frontend/src/contract.js has no contract addresses yet. " +
          "Run: npx hardhat run scripts/deploy.js --network localhost"
        );
        return;
      }

      if (cid !== EXPECTED_CHAIN_ID) {
        setFatalError(
          `MetaMask is connected to chainId ${cid.toString()} but this DApp needs ` +
          `chainId ${EXPECTED_CHAIN_ID} (Hardhat / localhost:8545). ` +
          `Open MetaMask → Networks → Add "Hardhat Local" (RPC http://127.0.0.1:8545, chain 31337) ` +
          `and switch to it, then reconnect.`
        );
        return;
      }

      const [tokenCode, daoCode, treasuryCode] = await Promise.all([
        prov.getCode(addresses.token),
        prov.getCode(addresses.dao),
        prov.getCode(addresses.treasury),
      ]);
      if (tokenCode === "0x" || daoCode === "0x" || treasuryCode === "0x") {
        setFatalError(
          `No contract code found at the addresses in contract.js on chain ${cid}. ` +
          `This usually means you restarted 'npx hardhat node' without redeploying. ` +
          `Re-run: npx hardhat run scripts/deploy.js --network localhost, then refresh the page.`
        );
        return;
      }

      const daoContract      = new ethers.Contract(addresses.dao,      CONTRACT_CONFIG.abi.dao,      sgn);
      const tokenContract    = new ethers.Contract(addresses.token,    CONTRACT_CONFIG.abi.token,    sgn);
      const treasuryContract = new ethers.Contract(addresses.treasury, CONTRACT_CONFIG.abi.treasury, sgn);

      setDao(daoContract);
      setToken(tokenContract);
      setTreasury(treasuryContract);

      setTxStatus("Wallet connected. Loading on-chain state...");
    } catch (err) {
      setFatalError("Wallet connect failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }

  // ── Refresh data ───────────────────────────────────────────────────────────
  const refreshGlobal = useCallback(async () => {
    if (!dao || !token || !treasury || !provider || !account) return;
    try {
      const [bal, vp, dlg, ts, qp, vd, tbal] = await Promise.all([
        token.balanceOf(account),
        token.getVotes(account),
        token.delegates(account),
        token.totalSupply(),
        dao.quorumPercent(),
        dao.votingDelay(),
        provider.getBalance(addresses.treasury),
      ]);
      setBalance(ethers.formatUnits(bal, 18));
      setVotingPower(ethers.formatUnits(vp, 18));
      setDelegatee(dlg);
      setTotalSupply(ethers.formatUnits(ts, 18));
      setQuorumPercent(qp.toString());
      setVotingDelay(vd.toString());
      setTreasuryEth(ethers.formatEther(tbal));
    } catch (err) {
      setTxStatus("Refresh failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }, [dao, token, treasury, provider, account, addresses.treasury]);

  const loadProposals = useCallback(async () => {
    if (!dao) return;
    try {
      setTxStatus("Loading proposals...");
      const count = Number(await dao.proposalCount());
      const list  = [];
      for (let i = 1; i <= count; i++) {
        const p = await dao.getProposal(i);
        let decoded = "";
        if (treasuryIface && p.target && p.target.toLowerCase() === (addresses.treasury || "").toLowerCase() && p.data && p.data !== "0x") {
          try {
            const tx = treasuryIface.parseTransaction({ data: p.data });
            decoded = `${tx.name}(${tx.args.map((a) => a.toString()).join(", ")})`;
          } catch { /* undecodable — leave blank */ }
        }
        list.push({
          id:            i,
          description:   p.description,
          target:        p.target,
          data:          p.data,
          decoded,
          yesVotes:      ethers.formatUnits(p.yesVotes, 18),
          noVotes:       ethers.formatUnits(p.noVotes, 18),
          deadline:      new Date(Number(p.deadline) * 1000).toLocaleString(),
          executed:      p.executed,
          cancelled:     p.cancelled,
          quorumReached: p.quorumReached,
          status:        Number(p.status),
        });
      }
      setProposals(list);
      setTxStatus(`Loaded ${count} proposal(s).`);
    } catch (err) {
      setTxStatus("Load failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }, [dao, treasuryIface, addresses.treasury]);

  useEffect(() => {
    if (dao && token) {
      refreshGlobal();
      loadProposals();
    }
  }, [dao, token, refreshGlobal, loadProposals]);

  // React to MetaMask account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    window.ethereum.on?.("accountsChanged", reload);
    window.ethereum.on?.("chainChanged", reload);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", reload);
      window.ethereum.removeListener?.("chainChanged", reload);
    };
  }, []);

  // ── Write actions ──────────────────────────────────────────────────────────
  async function delegateToSelf() {
    if (!token || !account) return;
    try {
      setTxStatus("Delegating voting power to yourself...");
      const tx = await token.delegate(account);
      await tx.wait();
      setTxStatus("Delegation successful. Voting power is now active for new proposals.");
      await refreshGlobal();
    } catch (err) {
      setTxStatus("Delegate failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }

  function applyPreset() {
    if (!treasuryIface) return;
    try {
      if (presetKind === "setValue") {
        const n = ethers.toBigInt(presetValue || "0");
        setTarget(addresses.treasury);
        setCalldata(treasuryIface.encodeFunctionData("setValue", [n]));
        setDescription((d) => d || `Set Treasury.storedValue to ${n.toString()}`);
      } else if (presetKind === "release") {
        const to = presetRecipient || ethers.ZeroAddress;
        const amt = ethers.parseEther(presetAmountEth || "0");
        setTarget(addresses.treasury);
        setCalldata(treasuryIface.encodeFunctionData("release", [to, amt]));
        setDescription((d) => d || `Release ${presetAmountEth} ETH to ${to}`);
      }
      setTxStatus("Preset applied to the proposal form.");
    } catch (err) {
      setTxStatus("Preset failed: " + (err?.reason || err?.shortMessage || err?.message));
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
      setTxStatus("Proposal created.");
      setDescription(""); setTarget(""); setCalldata("0x"); setVotingDays(7);
      await loadProposals();
    } catch (err) {
      setTxStatus("Create failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }

  async function vote(id, support) {
    if (!dao) return;
    try {
      setTxStatus(`Casting ${support ? "YES" : "NO"} vote on #${id}...`);
      const tx = await dao.vote(id, support);
      await tx.wait();
      setTxStatus(`Vote recorded on #${id}.`);
      await Promise.all([loadProposals(), refreshGlobal()]);
    } catch (err) {
      setTxStatus("Vote failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }

  async function executeProposal(id) {
    if (!dao) return;
    try {
      setTxStatus(`Executing proposal #${id}...`);
      const tx = await dao.executeProposal(id);
      await tx.wait();
      setTxStatus(`Proposal #${id} executed.`);
      await Promise.all([loadProposals(), refreshGlobal()]);
    } catch (err) {
      setTxStatus("Execute failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }

  async function cancelProposal(id) {
    if (!dao) return;
    try {
      setTxStatus(`Cancelling proposal #${id}...`);
      const tx = await dao.cancelProposal(id);
      await tx.wait();
      setTxStatus(`Proposal #${id} cancelled.`);
      await loadProposals();
    } catch (err) {
      setTxStatus("Cancel failed: " + (err?.reason || err?.shortMessage || err?.message));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const shortAcct = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "";
  const shortDel  = delegatee && delegatee !== ethers.ZeroAddress
    ? `${delegatee.slice(0, 6)}…${delegatee.slice(-4)}`
    : "—";
  const needsDelegation = account && delegatee === ethers.ZeroAddress;

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>DAO Governance DApp</h1>
            <p style={{ color: "#94a3b8", marginTop: 4 }}>CS218 — MerkleMinds</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={connectWallet} style={btn(account ? "#1e293b" : "#3b82f6")}>
              {account ? `✓ ${shortAcct}` : "Connect MetaMask"}
            </button>
            {account && (
              <span style={chip}>chainId&nbsp;<b style={{ color: chainId === EXPECTED_CHAIN_ID ? "#22c55e" : "#ef4444" }}>{chainId?.toString()}</b></span>
            )}
          </div>
        </header>

        {/* ── Messages ─────────────────────────────────────────────── */}
        {fatalError && (
          <div style={{ ...callout, background: "#7f1d1d", borderColor: "#ef4444", color: "#fee2e2" }}>
            <b>Problem:</b> {fatalError}
          </div>
        )}
        {txStatus && !fatalError && (
          <div style={{ ...callout, background: "#1e3a5f", borderColor: "#3b82f6", color: "#bfdbfe" }}>
            {txStatus}
          </div>
        )}

        {/* ── Stats grid ──────────────────────────────────────────── */}
        {account && dao && !fatalError && (
          <section style={grid4}>
            <Card label="Your GT balance" value={`${Number(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} GT`} />
            <Card
              label="Your voting power"
              value={`${Number(votingPower).toLocaleString(undefined, { maximumFractionDigits: 2 })} GT`}
              hint={delegatee === ethers.ZeroAddress ? "not delegated" : `delegated to ${shortDel}`}
            />
            <Card label="Token total supply" value={`${Number(totalSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })} GT`} />
            <Card label="Quorum / delay" value={`${quorumPercent}% · ${votingDelay}s`} hint="of total supply · voting delay" />
            <Card label="Treasury ETH" value={`${Number(treasuryEth).toFixed(4)} ETH`} />
            <Card label="DAO address"      value={addresses.dao      ? shortHex(addresses.dao)      : "—"} mono />
            <Card label="Token address"    value={addresses.token    ? shortHex(addresses.token)    : "—"} mono />
            <Card label="Treasury address" value={addresses.treasury ? shortHex(addresses.treasury) : "—"} mono />
          </section>
        )}

        {/* ── Delegation warning ──────────────────────────────────── */}
        {account && dao && !fatalError && needsDelegation && (
          <div style={{ ...callout, background: "#78350f", borderColor: "#f59e0b", color: "#fef3c7" }}>
            <b>Voting power not active.</b> Token holders must delegate their GT before their balance counts as voting power
            (this is how ERC-20 Votes snapshots work). Click the button below once — future proposals created after this will
            count your votes.
            <div style={{ marginTop: 10 }}>
              <button onClick={delegateToSelf} style={btn("#f59e0b")}>Delegate GT to Myself</button>
            </div>
          </div>
        )}

        {/* ── Create proposal ─────────────────────────────────────── */}
        {account && dao && !fatalError && (
          <>
            <h2 style={sectionTitle}>Create Proposal</h2>
            <div style={panel}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={lbl}>
                  Preset action
                  <select
                    value={presetKind}
                    onChange={(e) => setPresetKind(e.target.value)}
                    style={input}
                  >
                    <option value="setValue">Treasury.setValue(uint256)</option>
                    <option value="release">Treasury.release(address, uint256)</option>
                    <option value="custom">Custom (fill target + calldata manually)</option>
                  </select>
                </label>

                {presetKind === "setValue" && (
                  <label style={lbl}>
                    Value to store
                    <input value={presetValue} onChange={(e) => setPresetValue(e.target.value)} style={input} />
                  </label>
                )}
                {presetKind === "release" && (
                  <>
                    <label style={lbl}>
                      Recipient address
                      <input
                        value={presetRecipient}
                        onChange={(e) => setPresetRecipient(e.target.value)}
                        placeholder="0x..."
                        style={input}
                      />
                    </label>
                    <label style={lbl}>
                      Amount (ETH)
                      <input value={presetAmountEth} onChange={(e) => setPresetAmountEth(e.target.value)} style={input} />
                    </label>
                  </>
                )}
              </div>
              {presetKind !== "custom" && (
                <button onClick={applyPreset} style={{ ...btn("#0ea5e9"), marginTop: 10 }}>
                  Apply preset → fill target + calldata
                </button>
              )}

              <hr style={divider} />

              <label style={lbl}>
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this proposal do?" style={input} />
              </label>
              <label style={lbl}>
                Target contract address
                <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={addresses.treasury || "0x..."} style={input} />
              </label>
              <label style={lbl}>
                Calldata (ABI-encoded; 0x for none)
                <input value={calldata} onChange={(e) => setCalldata(e.target.value)} style={{ ...input, fontFamily: "monospace", fontSize: 12 }} />
              </label>
              <label style={lbl}>
                Voting period (days)
                <input type="number" min={1} value={votingDays} onChange={(e) => setVotingDays(e.target.value)} style={input} />
              </label>

              <button
                onClick={createProposal}
                disabled={!description}
                style={{ ...btn("#8b5cf6"), marginTop: 6, opacity: description ? 1 : 0.5 }}
              >
                Submit Proposal
              </button>
            </div>
          </>
        )}

        {/* ── Proposals list ──────────────────────────────────────── */}
        {account && dao && !fatalError && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28 }}>
              <h2 style={{ margin: 0 }}>Proposals</h2>
              <button onClick={loadProposals} style={btn("#0ea5e9")}>Refresh</button>
            </div>

            {proposals.length === 0 && (
              <p style={{ color: "#64748b" }}>No proposals yet. Create one above.</p>
            )}

            {proposals.map((p) => (
              <div key={p.id} style={proposalCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    #{p.id} — {p.description || "(no description)"}
                  </h3>
                  <span style={{
                    background: STATUS_COLOR[p.status], color: "#fff",
                    padding: "3px 10px", borderRadius: 12, fontSize: 13, fontWeight: 600
                  }}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: "#94a3b8", display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <span>Target: <code style={mono}>{shortHex(p.target)}</code></span>
                  {p.decoded && <span>Call: <code style={mono}>{p.decoded}</code></span>}
                  <span>Deadline: {p.deadline}</span>
                </div>

                <div style={{ marginTop: 10, fontSize: 14, color: "#94a3b8", display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <span>Yes: <b style={{ color: "#22c55e" }}>{Number(p.yesVotes).toFixed(0)}</b></span>
                  <span>No: <b style={{ color: "#ef4444" }}>{Number(p.noVotes).toFixed(0)}</b></span>
                  <span>Quorum: <b style={{ color: p.quorumReached ? "#22c55e" : "#ef4444" }}>{p.quorumReached ? "met" : "not met"}</b></span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.status === 1 && (
                    <>
                      <button onClick={() => vote(p.id, true)}  style={btn("#22c55e")}>Vote YES</button>
                      <button onClick={() => vote(p.id, false)} style={btn("#ef4444")}>Vote NO</button>
                    </>
                  )}
                  {p.status === 3 && (
                    <button onClick={() => executeProposal(p.id)} style={btn("#8b5cf6")}>Execute</button>
                  )}
                  {p.status === 0 && (
                    <button onClick={() => cancelProposal(p.id)} style={btn("#f97316")}>Cancel (proposer only)</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        <footer style={{ marginTop: 40, color: "#475569", fontSize: 12, textAlign: "center" }}>
          Built on Solidity 0.8.28 · Hardhat · OpenZeppelin 4.9 · ethers v6 · See{" "}
          <code style={mono}>INSTRUCTIONS.md</code> for setup steps.
        </footer>
      </div>
    </div>
  );
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function Card({ label, value, hint, mono: isMono }) {
  return (
    <div style={card}>
      <div style={{ color: "#94a3b8", fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: isMono ? "monospace" : undefined }}>{value}</div>
      {hint && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
function shortHex(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Styles ─────────────────────────────────────────────────────────────────
const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0b1220 0%, #0f172a 60%, #020617 100%)",
  color: "#e2e8f0",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  padding: "28px 24px",
};
const sectionTitle = { marginTop: 28, marginBottom: 12 };
const panel = { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 };
const proposalCard = { border: "1px solid #334155", padding: 16, marginBottom: 12, borderRadius: 12, background: "#0f172a" };
const card = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 };
const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 };
const divider = { border: "none", borderTop: "1px solid #1e293b", margin: "10px 0" };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#94a3b8" };
const input = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid #334155",
  background: "#1e293b", color: "#e2e8f0", fontSize: 14,
  width: "100%", boxSizing: "border-box",
};
const btn = (bg) => ({
  background: bg, color: "white", border: "1px solid rgba(255,255,255,0.08)",
  padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14,
});
const chip = {
  background: "#1e293b", border: "1px solid #334155", borderRadius: 999,
  padding: "4px 10px", fontSize: 12, color: "#94a3b8",
};
const callout = { border: "1px solid", borderRadius: 10, padding: "10px 14px", marginTop: 14, fontSize: 14, lineHeight: 1.45 };
const mono = { fontFamily: "monospace", fontSize: 12, background: "#1e293b", padding: "1px 6px", borderRadius: 4 };
