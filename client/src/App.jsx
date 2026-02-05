import React, { useCallback, useMemo, useState, useEffect } from "react";
import ProgressBar from "./components/ProgressBar.jsx";
import crest from "./assets/cwl-crest.svg";
import swords from "./assets/crossed-swords.svg";
import artOne from "./assets/img1.png";
import artTwo from "./assets/img2.png";
import artThree from "./assets/img3.png";

const WAR_COUNT = 7;
const DEFAULT_WAR = {
  attackStars: 0,
  attackPct: 0,
  defenseStars: 0,
  defensePct: 0
};

const clampNumber = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return min;
  }
  return Math.min(Math.max(num, min), max);
};

const normalizeWar = (war) => ({ ...DEFAULT_WAR, ...(war || {}) });

// Aggregate totals across all wars for leaderboard calculations.
const computeTotals = (player) => {
  const wars = Array.from({ length: WAR_COUNT }, (_, idx) =>
    normalizeWar(player.wars?.[idx])
  );

  const totals = wars.reduce(
    (acc, war) => {
      acc.attackStars += war.attackStars;
      acc.attackPct += war.attackPct;
      acc.defenseStars += war.defenseStars;
      acc.defensePct += war.defensePct;
      acc.netStars += war.attackStars - war.defenseStars;
      acc.netPct += war.attackPct - war.defensePct;
      return acc;
    },
    {
      attackStars: 0,
      attackPct: 0,
      defenseStars: 0,
      defensePct: 0,
      netStars: 0,
      netPct: 0
    }
  );

  return totals;
};

const buildLeaderboard = (players) => {
  const totals = players.map((player) => {
    const totals = computeTotals(player);
    return {
      id: player._id,
      name: player.name,
      ...totals
    };
  });

  // Ranking rules: Total Net Stars desc, then Total Net % desc, then name.
  totals.sort((a, b) => {
    if (b.netStars !== a.netStars) {
      return b.netStars - a.netStars;
    }
    if (b.netPct !== a.netPct) {
      return b.netPct - a.netPct;
    }
    return a.name.localeCompare(b.name);
  });

  return totals.map((row, idx) => ({ ...row, rank: idx + 1 }));
};

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE || "";

  const [mode, setMode] = useState("public");
  const [token, setToken] = useState(() => localStorage.getItem("cwl_token") || "");
  const [authView, setAuthView] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [clan, setClan] = useState(null);
  const [clanName, setClanName] = useState("");

  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [busyWar, setBusyWar] = useState(null);
  const [savingWar, setSavingWar] = useState(null);
  const [savedWar, setSavedWar] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState({});

  const [clans, setClans] = useState([]);
  const [publicSearch, setPublicSearch] = useState("");
  const [publicClan, setPublicClan] = useState(null);
  const [publicPlayers, setPublicPlayers] = useState([]);
  const [publicListLoading, setPublicListLoading] = useState(false);
  const [publicLeaderboardLoading, setPublicLeaderboardLoading] = useState(false);
  const [publicError, setPublicError] = useState("");

  const handleLogout = useCallback(() => {
    setToken("");
    localStorage.removeItem("cwl_token");
    setClan(null);
    setPlayers([]);
    setAuthEmail("");
    setAuthPassword("");
  }, []);

  const authFetch = useCallback(
    async (path, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}${path}`, { ...options, headers });
      if (res.status === 401) {
        handleLogout();
        throw new Error("Session expired. Please log in again.");
      }
      return res;
    },
    [apiBase, token, handleLogout]
  );

  const loadPublicClans = useCallback(async () => {
    setPublicListLoading(true);
    setPublicError("");
    try {
      const res = await fetch(`${apiBase}/api/public/clans`);
      if (!res.ok) {
        throw new Error("Failed to load clans.");
      }
      const data = await res.json();
      setClans(data);
    } catch (err) {
      setPublicError(err.message || "Unable to load clans.");
    } finally {
      setPublicListLoading(false);
    }
  }, [apiBase]);

  const loadClan = useCallback(async () => {
    if (!token) {
      setClan(null);
      return;
    }
    try {
      const res = await authFetch("/api/clans/me");
      if (!res.ok) {
        throw new Error("Failed to load clan.");
      }
      const data = await res.json();
      setClan(data.clan || null);
    } catch (err) {
      setAuthError(err.message || "Unable to load clan.");
    }
  }, [authFetch, token]);

  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    setError("");
    try {
      const res = await authFetch("/api/players");
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Failed to fetch players");
      }
      const data = await res.json();
      setPlayers(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoadingPlayers(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadPublicClans();
  }, [loadPublicClans]);

  useEffect(() => {
    if (token) {
      loadClan();
    }
  }, [token, loadClan]);

  useEffect(() => {
    if (token && clan) {
      fetchPlayers();
    }
  }, [token, clan, fetchPlayers]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const endpoint = authView === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Authentication failed.");
      }
      localStorage.setItem("cwl_token", payload.token);
      setToken(payload.token);
      setMode("admin");
      setAuthPassword("");
    } catch (err) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateClan = async (event) => {
    event.preventDefault();
    setAuthError("");
    try {
      const res = await authFetch("/api/clans", {
        method: "POST",
        body: JSON.stringify({ name: clanName.trim() })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create clan.");
      }
      setClan(payload.clan);
      setClanName("");
      loadPublicClans();
    } catch (err) {
      setAuthError(err.message || "Unable to create clan.");
    }
  };

  const handleAddPlayer = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      return;
    }
    try {
      const res = await authFetch("/api/players", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to add player");
      }
      setPlayers((prev) => [...prev, payload]);
      setNewName("");
    } catch (err) {
      setError(err.message || "Unable to add player");
    }
  };

  const handleRemovePlayer = async (id) => {
    try {
      const res = await authFetch(`/api/players/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error("Failed to remove player");
      }
      setPlayers((prev) => prev.filter((player) => player._id !== id));
    } catch (err) {
      setError(err.message || "Unable to remove player");
    }
  };

  const updateWar = async (playerId, warIndex, war) => {
    const res = await authFetch(`/api/players/${playerId}/war/${warIndex}`, {
      method: "PUT",
      body: JSON.stringify(war)
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error || "Failed to update war data");
    }
    return payload;
  };

  // Only update local state - no API call
  const handleWarFieldChange = (playerId, warIndex, field, rawValue) => {
    const max = field.includes("Stars") ? 3 : 100;
    const value = clampNumber(rawValue, 0, max);

    setPlayers((prev) =>
      prev.map((player) => {
        if (player._id !== playerId) {
          return player;
        }
        const wars = Array.from({ length: WAR_COUNT }, (_, idx) =>
          normalizeWar(player.wars?.[idx])
        );
        const war = { ...wars[warIndex], [field]: value };
        wars[warIndex] = war;
        return { ...player, wars };
      })
    );

    // Mark this war as having unsaved changes
    setHasUnsavedChanges((prev) => ({ ...prev, [warIndex]: true }));
    setSavedWar(null); // Clear any saved message
  };

  // Save all war data for a specific war index
  const saveAllWarData = async (warIndex) => {
    setSavingWar(warIndex);
    setError("");
    setSavedWar(null);

    try {
      const promises = players.map((player) => {
        const war = normalizeWar(player.wars?.[warIndex]);
        return updateWar(player._id, warIndex, war);
      });

      const results = await Promise.all(promises);

      // Update players with saved data from server
      setPlayers((prev) =>
        prev.map((player) => {
          const updated = results.find((r) => r._id === player._id);
          return updated || player;
        })
      );

      // Mark as saved
      setHasUnsavedChanges((prev) => ({ ...prev, [warIndex]: false }));
      setSavedWar(warIndex);

      // Clear success message after 3 seconds
      setTimeout(() => setSavedWar(null), 3000);
    } catch (err) {
      setError(err.message || "Unable to save war data");
    } finally {
      setSavingWar(null);
    }
  };

  const handleResetWar = async (warIndex) => {
    setBusyWar(warIndex);
    setError("");
    try {
      const res = await authFetch(`/api/players/reset-war/${warIndex}`, {
        method: "POST"
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to reset war");
      }
      await fetchPlayers();
    } catch (err) {
      setError(err.message || "Unable to reset war");
    } finally {
      setBusyWar(null);
    }
  };

  const selectPublicClan = async (selected) => {
    setPublicClan(selected);
    setPublicPlayers([]);
    setPublicError("");
    setPublicLeaderboardLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/public/clans/${selected.slug}/players`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load clan leaderboard");
      }
      setPublicPlayers(payload.players || []);
    } catch (err) {
      setPublicError(err.message || "Unable to load clan leaderboard.");
    } finally {
      setPublicLeaderboardLoading(false);
    }
  };

  const adminLeaderboard = useMemo(() => buildLeaderboard(players), [players]);
  const publicLeaderboard = useMemo(() => buildLeaderboard(publicPlayers), [publicPlayers]);

  const exportCSV = () => {
    const headers = ["Rank", "Player", "Total Net Stars", "Total Net %"];

    const rows = adminLeaderboard.map((row) => [
      row.rank,
      row.name,
      row.netStars,
      row.netPct
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cwl-leaderboard.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const filteredClans = clans.filter((clan) =>
    clan.name.toLowerCase().includes(publicSearch.toLowerCase())
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-icon" src={crest} alt="" aria-hidden="true" />
          <div>
            <div className="brand-title">Clan War League</div>
            <div className="brand-sub">Leaderboard Command</div>
          </div>
        </div>
        <div className="mode-toggle">
          <button
            type="button"
            className={`toggle ${mode === "public" ? "active" : ""}`}
            onClick={() => setMode("public")}
          >
            Public Leaderboards
          </button>
          <button
            type="button"
            className={`toggle ${mode === "admin" ? "active" : ""}`}
            onClick={() => setMode("admin")}
          >
            Clan Admin
          </button>
        </div>
        {token ? (
          <button type="button" className="btn ghost" onClick={handleLogout}>
            Log Out
          </button>
        ) : (
          <div className="topbar-spacer" />
        )}
      </header>

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Clash of Clans War Council</p>
          <h1>Clan War League Leaderboard</h1>
          <p className="subtitle">
            Track seven wars, tally net stars, and crown your top raiders in real time.
          </p>
          <div className="hero-metrics">
            <div>
              <div className="metric-label">Active Wars</div>
              <div className="metric-value">7</div>
            </div>
            <div>
              <div className="metric-label">Live Ranking</div>
              <div className="metric-value">Instant</div>
            </div>
            <div>
              <div className="metric-label">Public Clans</div>
              <div className="metric-value">{clans.length}</div>
            </div>
          </div>
        </div>
        <div className="hero-art">
          <img className="crest" src={crest} alt="Clan War League crest" />
          <div className="hero-gallery">
            <img src={artOne} alt="Clash of Clans banner" />
            <img src={artTwo} alt="Clan war art" />
            <img src={artThree} alt="Battle scene" />
          </div>
          <img className="swords" src={swords} alt="Crossed swords" />
        </div>
      </section>

      {mode === "public" ? (
        <section className="grid">
          <div className="panel">
            <div className="panel-header">
              <div className="title-row">
                <img className="section-icon" src={crest} alt="" aria-hidden="true" />
                <h2>Public Clan Directory</h2>
              </div>
              <p>Anyone can browse and view clan leaderboards.</p>
            </div>
            <input
              type="text"
              value={publicSearch}
              onChange={(event) => setPublicSearch(event.target.value)}
              placeholder="Search clans"
              aria-label="Search clans"
              className="search-input"
            />
            {publicError && <div className="alert">{publicError}</div>}
            {publicListLoading ? (
              <div className="loading">Loading clans...</div>
            ) : filteredClans.length === 0 ? (
              <div className="empty">No clans yet. Be the first to create one.</div>
            ) : (
              <ul className="roster">
                {filteredClans.map((clanItem) => (
                  <li key={clanItem.slug}>
                    <div className="roster-name">{clanItem.name}</div>
                    <button
                      type="button"
                      className="btn gold"
                      onClick={() => selectPublicClan(clanItem)}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel leaderboard">
            <div className="panel-header">
              <div className="title-row">
                <img className="section-icon" src={swords} alt="" aria-hidden="true" />
                <h2>{publicClan ? publicClan.name : "Select a Clan"}</h2>
              </div>
              <p>Leaderboard is public for all clans.</p>
            </div>
            {publicClan && publicError && <div className="alert">{publicError}</div>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Total Net Stars</th>
                    <th>Total Net %</th>
                  </tr>
                </thead>
                <tbody>
                  {publicClan === null ? (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Choose a clan to view its leaderboard.
                      </td>
                    </tr>
                  ) : publicLeaderboardLoading ? (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Loading leaderboard...
                      </td>
                    </tr>
                  ) : publicLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        No war data yet for this clan.
                      </td>
                    </tr>
                  ) : (
                    publicLeaderboard.map((row) => (
                      <tr key={row.id} className={`rank-${row.rank}`}>
                        <td>
                          <span className="rank-badge">#{row.rank}</span>
                        </td>
                        <td className="player-cell">{row.name}</td>
                        <td>
                          <span className={`net-stars ${row.netStars >= 0 ? "up" : "down"}`}>
                            {row.netStars}&#9733;
                          </span>
                        </td>
                        <td>
                          <span className={`net ${row.netPct >= 0 ? "up" : "down"}`}>
                            {row.netPct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid">
          <div className="panel">
            <div className="panel-header">
              <div className="title-row">
                <img className="section-icon" src={crest} alt="" aria-hidden="true" />
                <h2>Clan Admin Access</h2>
              </div>
              <p>Log in to manage your clan and enter war data.</p>
            </div>

            {!token ? (
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <div className="auth-toggle">
                  <button
                    type="button"
                    className={authView === "login" ? "active" : ""}
                    onClick={() => setAuthView("login")}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    className={authView === "register" ? "active" : ""}
                    onClick={() => setAuthView("register")}
                  >
                    Sign Up
                  </button>
                </div>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email address"
                  required
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password"
                  required
                />
                {authError && <div className="alert">{authError}</div>}
                <button type="submit" className="btn gold" disabled={authBusy}>
                  {authBusy ? "Authenticating..." : authView === "login" ? "Log In" : "Create Account"}
                </button>
              </form>
            ) : clan ? (
              <div className="clan-summary">
                <div className="clan-name">{clan.name}</div>
                <div className="clan-sub">CWL command center is ready.</div>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleCreateClan}>
                <input
                  type="text"
                  value={clanName}
                  onChange={(event) => setClanName(event.target.value)}
                  placeholder="Enter unique clan name"
                  required
                />
                {authError && <div className="alert">{authError}</div>}
                <button type="submit" className="btn gold">
                  Create Clan
                </button>
              </form>
            )}
          </div>

          <div className="panel leaderboard">
            <div className="panel-header">
              <div className="title-row">
                <img className="section-icon" src={swords} alt="" aria-hidden="true" />
                <h2>Live Leaderboard</h2>
              </div>
              <p>Ranks update instantly based on net stars, then net percent.</p>
            </div>

            <div className="leaderboard-actions">
              <button type="button" className="btn gold" onClick={exportCSV} disabled={!clan}>
                Export CSV
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Total Net Stars</th>
                    <th>Total Net %</th>
                  </tr>
                </thead>
                <tbody>
                  {!clan ? (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Create your clan to start tracking wars.
                      </td>
                    </tr>
                  ) : loadingPlayers ? (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Loading roster...
                      </td>
                    </tr>
                  ) : adminLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Add players and enter war stats to see rankings.
                      </td>
                    </tr>
                  ) : (
                    adminLeaderboard.map((row) => (
                      <tr key={row.id} className={`rank-${row.rank}`}>
                        <td>
                          <span className="rank-badge">#{row.rank}</span>
                        </td>
                        <td className="player-cell">{row.name}</td>
                        <td>
                          <span className={`net-stars ${row.netStars >= 0 ? "up" : "down"}`}>
                            {row.netStars}&#9733;
                          </span>
                        </td>
                        <td>
                          <span className={`net ${row.netPct >= 0 ? "up" : "down"}`}>
                            {row.netPct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {mode === "admin" && clan && (
        <section className="grid admin-grid">
          <div className="panel">
            <div className="panel-header">
              <div className="title-row">
                <img className="section-icon" src={crest} alt="" aria-hidden="true" />
                <h2>Player Roster</h2>
              </div>
              <p>Add fighters once, then edit their war stats below.</p>
            </div>

            <form className="add-player" onSubmit={handleAddPlayer}>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Enter player name"
                aria-label="Player name"
              />
              <button type="submit" className="btn gold">
                Add Player
              </button>
            </form>

            {error && <div className="alert">{error}</div>}

            {loadingPlayers ? (
              <div className="loading">Loading roster...</div>
            ) : players.length === 0 ? (
              <div className="empty">No players yet. Add the first warrior.</div>
            ) : (
              <ul className="roster">
                {players.map((player) => (
                  <li key={player._id}>
                    <div className="roster-name">{player.name}</div>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => handleRemovePlayer(player._id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="title-row">
                <img className="section-icon" src={swords} alt="" aria-hidden="true" />
                <h2>War Data Entry</h2>
              </div>
              <p>Enter stats for each war, then click "Save & Update Leaderboard" to save.</p>
            </div>

            {Array.from({ length: WAR_COUNT }, (_, idx) => (
              <details className="war-card" key={idx} open={idx === 0}>
                <summary>
                  <div>
                    <span className="war-title">War {idx + 1}</span>
                    <span className="war-sub">{players.length} players tracked</span>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleResetWar(idx);
                    }}
                    disabled={busyWar === idx}
                  >
                    {busyWar === idx ? "Resetting..." : "Reset War"}
                  </button>
                </summary>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Attack Stars</th>
                        <th>Attack %</th>
                        <th>Defense Stars</th>
                        <th>Defense %</th>
                        <th>Net Stars</th>
                        <th>Net %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="empty-cell">
                            Add players to start logging war stats.
                          </td>
                        </tr>
                      ) : (
                        players.map((player) => {
                          const war = normalizeWar(player.wars?.[idx]);
                          const netStars = war.attackStars - war.defenseStars;
                          const netPct = war.attackPct - war.defensePct;

                          return (
                            <tr key={player._id}>
                              <td className="player-cell">{player.name}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="3"
                                  step="1"
                                  value={war.attackStars}
                                  onChange={(event) =>
                                    handleWarFieldChange(
                                      player._id,
                                      idx,
                                      "attackStars",
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <div className="input-stack">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={war.attackPct}
                                    onChange={(event) =>
                                      handleWarFieldChange(
                                        player._id,
                                        idx,
                                        "attackPct",
                                        event.target.value
                                      )
                                    }
                                  />
                                  <ProgressBar value={war.attackPct} max={100} tone="gold" />
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="3"
                                  step="1"
                                  value={war.defenseStars}
                                  onChange={(event) =>
                                    handleWarFieldChange(
                                      player._id,
                                      idx,
                                      "defenseStars",
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <div className="input-stack">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={war.defensePct}
                                    onChange={(event) =>
                                      handleWarFieldChange(
                                        player._id,
                                        idx,
                                        "defensePct",
                                        event.target.value
                                      )
                                    }
                                  />
                                  <ProgressBar value={war.defensePct} max={100} tone="ember" />
                                </div>
                              </td>
                              <td>
                                <span className={`net ${netStars >= 0 ? "up" : "down"}`}>
                                  {netStars}
                                </span>
                              </td>
                              <td>
                                <span className={`net ${netPct >= 0 ? "up" : "down"}`}>
                                  {netPct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="war-actions">
                  {savedWar === idx && (
                    <div className="save-success">
                      ✓ War {idx + 1} data saved successfully!
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn gold save-btn"
                    onClick={() => saveAllWarData(idx)}
                    disabled={savingWar === idx || players.length === 0}
                  >
                    {savingWar === idx ? "Saving..." : "Save & Update Leaderboard"}
                  </button>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
