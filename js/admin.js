import {
  db,
  isConfigured,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs
} from "./firebase-config.js";

// Global Admin Passcode - Customizable
const ADMIN_PASSCODE = "2026";

// FIFA World Cup 2026 Fixture Presets (localized times in IST)
const FIXTURE_PRESETS = [
  { teamA: "Spain", teamAFlag: "🇪🇸", teamB: "Saudi Arabia", teamBFlag: "🇸🇦", kickoff: "2026-06-21T21:30" },
  { teamA: "Belgium", teamAFlag: "🇧🇪", teamB: "Iran", teamBFlag: "🇮🇷", kickoff: "2026-06-22T03:30" },
  { teamA: "Uruguay", teamAFlag: "🇺🇾", teamB: "Cabo Verde", teamBFlag: "🇨🇻", kickoff: "2026-06-22T03:30" },
  { teamA: "New Zealand", teamAFlag: "🇳🇿", teamB: "Egypt", teamBFlag: "🇪🇬", kickoff: "2026-06-22T09:30" },
  { teamA: "Argentina", teamAFlag: "🇦🇷", teamB: "Austria", teamBFlag: "🇦🇹", kickoff: "2026-06-22T23:30" },
  { teamA: "France", teamAFlag: "🇫🇷", teamB: "Iraq", teamBFlag: "🇮🇶", kickoff: "2026-06-23T02:30" },
  { teamA: "Norway", teamAFlag: "🇳🇴", teamB: "Senegal", teamBFlag: "🇸🇳", kickoff: "2026-06-23T05:30" },
  { teamA: "Jordan", teamAFlag: "🇯🇴", teamB: "Algeria", teamBFlag: "🇩🇿", kickoff: "2026-06-23T11:30" },
  { teamA: "Portugal", teamAFlag: "🇵🇹", teamB: "Uzbekistan", teamBFlag: "🇺🇿", kickoff: "2026-06-23T23:30" },
  { teamA: "England", teamAFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", teamB: "Ghana", teamBFlag: "🇬🇭", kickoff: "2026-06-24T01:30" },
  { teamA: "Panama", teamAFlag: "🇵🇦", teamB: "Croatia", teamBFlag: "🇭🇷", kickoff: "2026-06-24T04:30" },
  { teamA: "Colombia", teamAFlag: "🇨🇴", teamB: "Congo DR", teamBFlag: "🇨🇩", kickoff: "2026-06-24T09:30" }
];

// DOM Sections
const elPasscodeScreen = document.getElementById("passcode-screen");
const elDashboard = document.getElementById("admin-dashboard");
const elConfigWarning = document.getElementById("config-warning");

// Setup Form Elements
const elTeamA = document.getElementById("cfg-team-a");
const elTeamB = document.getElementById("cfg-team-b");
const elTeamAFlag = document.getElementById("cfg-team-a-flag");
const elTeamBFlag = document.getElementById("cfg-team-b-flag");
const elTeamAFlagIndicator = document.getElementById("cfg-team-a-flag-indicator");
const elTeamBFlagIndicator = document.getElementById("cfg-team-b-flag-indicator");
const elKickoff = document.getElementById("cfg-kickoff");
const elOpening = document.getElementById("cfg-opening");
const elDeadlineDisplay = document.getElementById("cfg-deadline-display");
const btnSaveCfg = document.getElementById("btn-save-cfg");

// Result Form Elements
const elResTeamALabel = document.getElementById("res-team-a-label");
const elResTeamBLabel = document.getElementById("res-team-b-label");
const elResScoreA = document.getElementById("res-score-a");
const elResScoreB = document.getElementById("res-score-b");
const btnSaveResult = document.getElementById("btn-save-result");

// Submissions List Elements
const elPredictionsTbody = document.getElementById("predictions-tbody");
const elPredictionsCount = document.getElementById("predictions-count");

// Winners List Elements
const elWinnersPodium = document.getElementById("winners-podium");
const elNoWinnersState = document.getElementById("no-winners-state");
const elWinnersTbody = document.getElementById("winners-tbody");
const elWinnersCount = document.getElementById("winners-count");
const elWinnersListContainer = document.getElementById("winners-list-container");

// Toast elements
const elToast = document.getElementById("toast");
const elToastIcon = document.getElementById("toast-icon");
const elToastMessage = document.getElementById("toast-message");

let activeMatch = null;
let allPredictions = [];
let filteredPredictions = [];
let unsubscribeSubmissions = null;
let currentMatchId = "";

// Initialize Page
window.addEventListener("DOMContentLoaded", () => {
  if (!isConfigured) {
    elConfigWarning.style.display = "block";
    btnSaveCfg.disabled = true;
    btnSaveResult.disabled = true;
  }

  // Handle flag indicator updates
  elTeamAFlag.addEventListener("input", (e) => {
    elTeamAFlagIndicator.textContent = e.target.value || "⚽";
  });
  elTeamBFlag.addEventListener("input", (e) => {
    elTeamBFlagIndicator.textContent = e.target.value || "⚽";
  });

  // Handle kickoff input to calculate deadline (5 minutes before)
  elKickoff.addEventListener("input", updateCalculatedDeadline);

  // Populate match presets dropdown
  const elPresetSelect = document.getElementById("cfg-match-preset");
  if (elPresetSelect) {
    FIXTURE_PRESETS.forEach((fix, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${fix.teamAFlag} ${fix.teamA} vs ${fix.teamB} ${fix.teamBFlag}`;
      elPresetSelect.appendChild(opt);
    });
  }

  // Force Open predictions event listener
  const btnForceOpen = document.getElementById("btn-force-open");
  if (btnForceOpen) {
    btnForceOpen.addEventListener("click", forceOpenPredictions);
  }

  // Periodic status update check every 5 seconds
  setInterval(updatePredictionStatusDisplay, 5000);

  checkAuthentication();
});

// Event listener to load selected preset
window.addEventListener("admin-load-preset", (e) => {
  const idx = e.detail;
  const fix = FIXTURE_PRESETS[idx];
  if (fix) {
    elTeamA.value = fix.teamA;
    elTeamB.value = fix.teamB;
    elTeamAFlag.value = fix.teamAFlag;
    elTeamBFlag.value = fix.teamBFlag;
    elTeamAFlagIndicator.textContent = fix.teamAFlag;
    elTeamBFlagIndicator.textContent = fix.teamBFlag;
    elKickoff.value = fix.kickoff;
    updateCalculatedDeadline();
    showToast(`Loaded preset: ${fix.teamA} vs ${fix.teamB}!`, "info");
  }
});

function updateCalculatedDeadline() {
  const kickoffVal = elKickoff.value;
  if (!kickoffVal) {
    elDeadlineDisplay.textContent = "Select kickoff time to calculate...";
    return;
  }
  const kickoffTime = new Date(kickoffVal).getTime();
  const deadlineTime = kickoffTime - 5 * 60 * 1000; // 5 minutes before
  const deadlineDate = new Date(deadlineTime);
  elDeadlineDisplay.textContent = deadlineDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + " IST";
}

// Admin Authentication flow
function checkAuthentication() {
  const isAuth = sessionStorage.getItem("admin_authenticated");
  if (isAuth === "true") {
    elPasscodeScreen.style.display = "none";
    elDashboard.style.display = "grid";
    if (isConfigured) {
      loadMatchConfig();
    }
  } else {
    elPasscodeScreen.style.display = "flex";
    elDashboard.style.display = "none";
  }
}

// Verify entered passcode
window.addEventListener("admin-verify-passcode", (e) => {
  const code = e.detail;
  if (code === ADMIN_PASSCODE) {
    sessionStorage.setItem("admin_authenticated", "true");
    showToast("Authorization successful!", "success");
    checkAuthentication();
  } else {
    showToast("Incorrect passcode. Try again.", "error");
    document.getElementById("admin-passcode").value = "";
  }
});

// Log out admin
window.addEventListener("admin-logout", () => {
  sessionStorage.removeItem("admin_authenticated");
  if (unsubscribeSubmissions) {
    unsubscribeSubmissions();
  }
  showToast("Logged out successfully.", "info");
  checkAuthentication();
});

// Toast notification helper
function showToast(message, type = "success") {
  elToast.className = `toast show toast-${type}`;
  
  let icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === "error") {
    icon = '<i class="fa-solid fa-circle-xmark"></i>';
  } else if (type === "info") {
    icon = '<i class="fa-solid fa-circle-info"></i>';
  }
  
  elToastIcon.innerHTML = icon;
  elToastMessage.textContent = message;
  
  setTimeout(() => {
    elToast.classList.remove("show");
  }, 4000);
}

// Format date local helper for inputs (YYYY-MM-DDThh:mm)
function formatLocalDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  return localISOTime;
}

// Fetch active match configs
async function loadMatchConfig() {
  try {
    const matchDocRef = doc(db, "settings", "match");
    const matchSnap = await getDoc(matchDocRef);

    if (matchSnap.exists()) {
      activeMatch = matchSnap.data();
      
      // Populate Forms
      elTeamA.value = activeMatch.teamA || "";
      elTeamB.value = activeMatch.teamB || "";
      elTeamAFlag.value = activeMatch.teamAFlag || "🇦🇷";
      elTeamBFlag.value = activeMatch.teamBFlag || "🇫🇷";
      elTeamAFlagIndicator.textContent = activeMatch.teamAFlag || "🇦🇷";
      elTeamBFlagIndicator.textContent = activeMatch.teamBFlag || "🇫🇷";
      elKickoff.value = formatLocalDateTime(activeMatch.kickoff || activeMatch.deadline);
      elOpening.value = activeMatch.openingTime ? formatLocalDateTime(activeMatch.openingTime) : "";
      updateCalculatedDeadline();

      // Populate Result section names
      elResTeamALabel.textContent = activeMatch.teamA || "Team A";
      elResTeamBLabel.textContent = activeMatch.teamB || "Team B";

      if (activeMatch.resultTeamA !== undefined && activeMatch.resultTeamA !== null) {
        elResScoreA.value = activeMatch.resultTeamA;
      } else {
        elResScoreA.value = "";
      }
      if (activeMatch.resultTeamB !== undefined && activeMatch.resultTeamB !== null) {
        elResScoreB.value = activeMatch.resultTeamB;
      } else {
        elResScoreB.value = "";
      }

      currentMatchId = activeMatch.matchId || 'active_match';
      
      // Update Prediction Status Display
      updatePredictionStatusDisplay();
      
      // Listen to predictions real-time
      listenToPredictions();
    }
  } catch (error) {
    console.error("Error loading match configuration:", error);
    showToast("Failed to load match configurations.", "error");
  }
}

function updatePredictionStatusDisplay() {
  const elStatusGroup = document.getElementById("cfg-status-group");
  const elStatusDisplay = document.getElementById("cfg-status-display");
  const btnForceOpen = document.getElementById("btn-force-open");

  if (!elStatusGroup || !elStatusDisplay || !btnForceOpen) return;

  if (!activeMatch) {
    elStatusGroup.style.display = "none";
    return;
  }

  elStatusGroup.style.display = "block";

  const now = new Date().getTime();
  const openingTime = activeMatch.openingTime ? new Date(activeMatch.openingTime).getTime() : now;
  const deadlineTime = activeMatch.deadline ? new Date(activeMatch.deadline).getTime() : now;

  if (now < openingTime) {
    const openDate = new Date(openingTime);
    elStatusDisplay.innerHTML = `<span style="color: var(--accent-gold);"><i class="fa-solid fa-clock"></i> Scheduled</span> (Opens ${openDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)`;
    btnForceOpen.style.display = "inline-flex";
  } else if (now >= deadlineTime) {
    elStatusDisplay.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-lock"></i> Closed</span> (Ended)`;
    btnForceOpen.style.display = "none";
  } else {
    elStatusDisplay.innerHTML = `<span style="color: var(--accent-neon);"><i class="fa-solid fa-lock-open"></i> Active (Open)</span>`;
    btnForceOpen.style.display = "none";
  }
}

async function forceOpenPredictions() {
  if (!activeMatch) return;
  
  const btnForceOpen = document.getElementById("btn-force-open");
  if (!btnForceOpen) return;
  
  btnForceOpen.disabled = true;
  btnForceOpen.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Opening...';
  
  try {
    const matchDocRef = doc(db, "settings", "match");
    const nowISO = new Date().toISOString();
    
    const payload = {
      ...activeMatch,
      openingTime: nowISO
    };
    
    await setDoc(matchDocRef, payload);
    showToast("Predictions opened immediately!", "success");
    
    // Reload configurations
    await loadMatchConfig();
  } catch (error) {
    console.error("Error opening predictions:", error);
    showToast("Failed to open predictions.", "error");
  } finally {
    btnForceOpen.disabled = false;
    btnForceOpen.innerHTML = '<i class="fa-solid fa-bolt"></i> Open Now';
  }
}

window.addEventListener("admin-save-match", async (e) => {
  const { teamA, teamB, teamAFlag, teamBFlag, kickoff, openingTime, isNewMatch } = e.detail;

  btnSaveCfg.disabled = true;
  btnSaveCfg.innerHTML = '<span>Saving...</span> <i class="fa-solid fa-circle-notch fa-spin"></i>';

  try {
    // Determine the matchId. If it's a new match, generate a unique ID.
    // If not, reuse the existing matchId (or default to 'active_match').
    let matchId = activeMatch && activeMatch.matchId ? activeMatch.matchId : 'active_match';
    let scoreA = null;
    let scoreB = null;
    let isReset = isNewMatch;
    
    if (!activeMatch) {
      isReset = true; // First run ever
    }

    if (isReset) {
      matchId = `match_${Date.now()}`;
      scoreA = null;
      scoreB = null;
    } else {
      scoreA = activeMatch.resultTeamA !== undefined ? activeMatch.resultTeamA : null;
      scoreB = activeMatch.resultTeamB !== undefined ? activeMatch.resultTeamB : null;
    }

    const kickoffTime = new Date(kickoff).getTime();
    const deadlineTime = kickoffTime - 5 * 60 * 1000;
    const deadline = new Date(deadlineTime).toISOString();

    // If openingTime is blank, open predictions immediately (set to now)
    const openingTimeISO = openingTime ? new Date(openingTime).toISOString() : new Date().toISOString();

    const matchDocRef = doc(db, "settings", "match");
    const payload = {
      matchId,
      teamA,
      teamB,
      teamAFlag,
      teamBFlag,
      kickoff,
      deadline,
      openingTime: openingTimeISO,
      resultTeamA: scoreA,
      resultTeamB: scoreB,
      createdAt: activeMatch && !isReset && activeMatch.createdAt ? activeMatch.createdAt : new Date().toISOString()
    };

    await setDoc(matchDocRef, payload);
    
    // Reset checkbox
    const chkNewMatch = document.getElementById('cfg-new-match');
    if (chkNewMatch) chkNewMatch.checked = false;
    
    showToast("Match details published successfully!", "success");
    
    // Reload configurations
    await loadMatchConfig();
  } catch (error) {
    console.error("Error saving match details:", error);
    showToast("Failed to publish match details.", "error");
  } finally {
    btnSaveCfg.disabled = false;
    btnSaveCfg.innerHTML = '<span>Publish Match Details</span> <i class="fa-solid fa-cloud-arrow-up"></i>';
  }
});

// Save match score results
window.addEventListener("admin-save-results", async (e) => {
  const { scoreA, scoreB } = e.detail;

  if (!activeMatch) {
    showToast("Configure and save the active match first.", "error");
    return;
  }

  btnSaveResult.disabled = true;
  btnSaveResult.innerHTML = '<span>Updating...</span> <i class="fa-solid fa-circle-notch fa-spin"></i>';

  try {
    const matchDocRef = doc(db, "settings", "match");
    
    const payload = {
      ...activeMatch,
      resultTeamA: scoreA,
      resultTeamB: scoreB
    };

    await setDoc(matchDocRef, payload);
    
    // Recalculate leaderboard points for all entries
    if (scoreA !== null && scoreB !== null) {
      await updateGlobalLeaderboard(activeMatch.matchId || 'active_match', scoreA, scoreB);
    }
    
    showToast("Match results updated and leaderboard recalculated!", "success");
    
    // Refresh configurations
    await loadMatchConfig();
  } catch (error) {
    console.error("Error saving match results:", error);
    showToast("Failed to save results.", "error");
  } finally {
    btnSaveResult.disabled = false;
    btnSaveResult.innerHTML = '<span>Calculate Winners</span> <i class="fa-solid fa-calculator"></i>';
  }
});

// Listen to predictions real-time
function listenToPredictions() {
  if (unsubscribeSubmissions) {
    unsubscribeSubmissions();
  }

  const predsRef = collection(db, "predictions");
  const q = query(predsRef, where("matchId", "==", currentMatchId));

  unsubscribeSubmissions = onSnapshot(q, (snapshot) => {
    allPredictions = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Resolve Firestore Timestamp to normal JS Date
      let jsDate = new Date();
      if (data.timestamp) {
        jsDate = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      }
      allPredictions.push({
        id: doc.id,
        ...data,
        resolvedDate: jsDate
      });
    });

    // Sort predictions: newest submissions first for the general submissions list
    allPredictions.sort((a, b) => b.resolvedDate - a.resolvedDate);
    
    filteredPredictions = [...allPredictions];
    
    renderPredictionsTable();
    updateDashboardReports();
  }, (error) => {
    console.error("Error in real-time prediction subscription:", error);
  });
}

// Render student prediction table
function renderPredictionsTable() {
  elPredictionsCount.textContent = `${filteredPredictions.length} submissions`;

  if (filteredPredictions.length === 0) {
    elPredictionsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">No submissions match the search filter</td>
      </tr>
    `;
    return;
  }

  let html = "";
  filteredPredictions.forEach((pred) => {
    const isCorrect = activeMatch && 
                      activeMatch.resultTeamA !== null && 
                      activeMatch.resultTeamB !== null && 
                      pred.scoreA === activeMatch.resultTeamA && 
                      pred.scoreB === activeMatch.resultTeamB;

    const timeStr = pred.resolvedDate.toLocaleString();
    const cleanPred = `${activeMatch ? activeMatch.teamAFlag : ''} ${pred.scoreA} - ${pred.scoreB} ${activeMatch ? activeMatch.teamBFlag : ''}`;

    html += `
      <tr>
        <td class="name-cell">${escapeHtml(pred.name)}</td>
        <td class="phone-cell">${escapeHtml(pred.phone)}</td>
        <td class="prediction-cell ${isCorrect ? 'correct' : ''}">${cleanPred} ${isCorrect ? '<i class="fa-solid fa-circle-check"></i>' : ''}</td>
        <td class="time-cell">${timeStr}</td>
      </tr>
    `;
  });

  elPredictionsTbody.innerHTML = html;
}

// Filter prediction table rows
window.addEventListener("admin-filter-submissions", (e) => {
  const query = e.detail;
  if (!query) {
    filteredPredictions = [...allPredictions];
  } else {
    filteredPredictions = allPredictions.filter(
      (pred) => 
        pred.name.toLowerCase().includes(query) || 
        pred.phone.includes(query)
    );
  }
  renderPredictionsTable();
});

// Update the reports and compute winners list
function updateDashboardReports() {
  const hasResults = activeMatch && 
                     activeMatch.resultTeamA !== null && 
                     activeMatch.resultTeamA !== undefined && 
                     activeMatch.resultTeamB !== null && 
                     activeMatch.resultTeamB !== undefined;

  if (!hasResults) {
    elWinnersPodium.style.display = "none";
    elWinnersListContainer.style.display = "none";
    elNoWinnersState.style.display = "block";
    elNoWinnersState.textContent = "Please set the correct score in the match setup panel to calculate winners.";
    elWinnersCount.textContent = "0 winners";
    return;
  }

  // Filter exact scoreline matches
  const winners = allPredictions.filter(
    (pred) => 
      pred.scoreA === activeMatch.resultTeamA && 
      pred.scoreB === activeMatch.resultTeamB
  );

  // Crucial: Sort by submission timestamp (ascending) to award speed
  // Treat missing resolvedDates (in transition) as future
  winners.sort((a, b) => a.resolvedDate - b.resolvedDate);
  
  elWinnersCount.textContent = `${winners.length} correct predictions`;

  if (winners.length === 0) {
    elWinnersPodium.style.display = "none";
    elWinnersListContainer.style.display = "none";
    elNoWinnersState.style.display = "block";
    elNoWinnersState.innerHTML = `
      <i class="fa-solid fa-face-frown" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-muted);"></i>
      <br>No student predicted the exact correct score of <b>${activeMatch.resultTeamA} - ${activeMatch.resultTeamB}</b>.
    `;
    return;
  }

  elNoWinnersState.style.display = "none";
  
  // Render podium cards
  const p1 = winners[0];
  const p2 = winners[1];
  const p3 = winners[2];
  const flagA = activeMatch.teamAFlag || "";
  const flagB = activeMatch.teamBFlag || "";
  const predStr = `${flagA} ${activeMatch.resultTeamA} - ${activeMatch.resultTeamB} ${flagB}`;

  // 1st place
  document.getElementById("podium-1-name").textContent = p1.name;
  document.getElementById("podium-1-pred").innerHTML = predStr;
  document.getElementById("podium-1-time").textContent = formatTimeDiff(p1.resolvedDate);
  
  // 2nd place
  const elStep2 = document.querySelector(".podium-step-2");
  if (p2) {
    elStep2.style.visibility = "visible";
    document.getElementById("podium-2-name").textContent = p2.name;
    document.getElementById("podium-2-pred").innerHTML = predStr;
    document.getElementById("podium-2-time").textContent = formatTimeDiff(p2.resolvedDate);
  } else {
    elStep2.style.visibility = "hidden";
  }

  // 3rd place
  const elStep3 = document.querySelector(".podium-step-3");
  if (p3) {
    elStep3.style.visibility = "visible";
    document.getElementById("podium-3-name").textContent = p3.name;
    document.getElementById("podium-3-pred").innerHTML = predStr;
    document.getElementById("podium-3-time").textContent = formatTimeDiff(p3.resolvedDate);
  } else {
    elStep3.style.visibility = "hidden";
  }

  elWinnersPodium.style.display = "flex";

  // Render full list table
  let winnersHtml = "";
  winners.forEach((winner, idx) => {
    const timeStr = winner.resolvedDate.toLocaleString();
    const badge = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
    
    winnersHtml += `
      <tr>
        <td style="font-weight: 700; font-size: 1.1rem; text-align: center; width: 60px;">${badge}</td>
        <td class="name-cell">${escapeHtml(winner.name)}</td>
        <td class="phone-cell">${escapeHtml(winner.phone)}</td>
        <td class="time-cell">${timeStr}</td>
      </tr>
    `;
  });

  elWinnersTbody.innerHTML = winnersHtml;
  elWinnersListContainer.style.display = "block";
}

// Compute winners layout event triggers
window.addEventListener("admin-tab-winners-active", () => {
  updateDashboardReports();
  // Trigger admin celebration if winners exist
  const winnersExist = activeMatch && 
                       activeMatch.resultTeamA !== null && 
                       activeMatch.resultTeamB !== null && 
                       allPredictions.some(p => p.scoreA === activeMatch.resultTeamA && p.scoreB === activeMatch.resultTeamB);
  if (winnersExist) {
    triggerConfetti();
  }
});

// Format submission date into a friendly text string
function formatTimeDiff(dateObj) {
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Escape HTML utility to prevent XSS in student submissions rendering
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

// Confetti celebration helper
function triggerConfetti() {
  const duration = 2.5 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0 },
      colors: ['#fbbf24', '#cbd5e1', '#b45309']
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1 },
      colors: ['#fbbf24', '#cbd5e1', '#b45309']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Calculate and update global leaderboard points in Firestore
async function updateGlobalLeaderboard(matchId, scoreA, scoreB) {
  const predsRef = collection(db, "predictions");
  const q = query(predsRef, where("matchId", "==", matchId));
  const snap = await getDocs(q);
  
  // Loop through each prediction and calculate points
  for (const docSnap of snap.docs) {
    const pred = docSnap.data();
    const phone = pred.phone;
    
    let points = 0;
    if (pred.scoreA === scoreA && pred.scoreB === scoreB) {
      points = 3; // Exact Score prediction
    } else if ((pred.scoreA > pred.scoreB && scoreA > scoreB) ||
               (pred.scoreA < pred.scoreB && scoreA < scoreB) ||
               (pred.scoreA === pred.scoreB && scoreA === scoreB)) {
      points = 1; // Correct Outcome prediction
    }
    
    // Read existing leaderboard entry
    const userDocRef = doc(db, "leaderboard", phone);
    const userSnap = await getDoc(userDocRef);
    
    let userDoc = {
      name: pred.name,
      phone: phone,
      history: {},
      points: 0,
      exactCount: 0,
      outcomeCount: 0
    };
    
    if (userSnap.exists()) {
      userDoc = userSnap.data();
      // Ensure history map is initialized
      if (!userDoc.history) userDoc.history = {};
    }
    
    // Update history for this match
    userDoc.history[matchId] = points;
    
    // Recalculate totals
    let totalPoints = 0;
    let totalExacts = 0;
    let totalOutcomes = 0;
    
    for (const mId in userDoc.history) {
      const pts = userDoc.history[mId];
      totalPoints += pts;
      if (pts === 3) totalExacts++;
      if (pts === 1) totalOutcomes++;
    }
    
    userDoc.points = totalPoints;
    userDoc.exactCount = totalExacts;
    userDoc.outcomeCount = totalOutcomes;
    
    // Save back to Firestore
    await setDoc(userDocRef, userDoc);
  }
}
