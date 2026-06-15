import {
  db,
  isConfigured,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from "./firebase-config.js";

// Global DOM elements
const elLoading = document.getElementById("loading-state");
const elActive = document.getElementById("active-state");
const elSuccess = document.getElementById("success-state");
const elError = document.getElementById("error-state");
const elConfigWarning = document.getElementById("config-warning");

// Match UI elements
const elTeamAName = document.getElementById("team-a-name");
const elTeamBName = document.getElementById("team-b-name");
const elTeamALogo = document.getElementById("team-a-logo");
const elTeamBLogo = document.getElementById("team-b-logo");
const elTeamADisplay = document.getElementById("team-a-display");
const elTeamBDisplay = document.getElementById("team-b-display");

// Score adjustments buttons
const btnTeamAMinus = document.getElementById("team-a-minus");
const btnTeamAPlus = document.getElementById("team-a-plus");
const btnTeamBMinus = document.getElementById("team-b-minus");
const btnTeamBPlus = document.getElementById("team-b-plus");

// Timer and Form elements
const elDays = document.getElementById("days-val");
const elHours = document.getElementById("hours-val");
const elMins = document.getElementById("mins-val");
const elSecs = document.getElementById("secs-val");
const elTimerProgress = document.getElementById("timer-progress");
const elTimerProgressContainer = document.getElementById("timer-progress-container");
const elTimerStatus = document.getElementById("timer-status");
const elLockedBadge = document.getElementById("locked-badge");
const btnSubmit = document.getElementById("btn-submit");
const elForm = document.getElementById("prediction-form");
const elKickoffDisplay = document.getElementById("match-kickoff-display");

// Receipt elements
const elReceiptName = document.getElementById("receipt-name");
const elReceiptPhone = document.getElementById("receipt-phone");
const elReceiptPrediction = document.getElementById("receipt-prediction");
const elReceiptTime = document.getElementById("receipt-time");

// Toast elements
const elToast = document.getElementById("toast");
const elToastIcon = document.getElementById("toast-icon");
const elToastMessage = document.getElementById("toast-message");

let activeMatch = null;
let timerInterval = null;
let currentMatchId = "";

// Initialize app
window.addEventListener("DOMContentLoaded", async () => {
  if (!isConfigured) {
    elLoading.style.display = "none";
    elConfigWarning.style.display = "block";
    elError.style.display = "block";
    return;
  }

  await loadActiveMatch();
});

// Show beautiful notification toasts
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

// Fetch current active match details
async function loadActiveMatch() {
  try {
    const matchDocRef = doc(db, "settings", "match");
    const matchSnap = await getDoc(matchDocRef);

    if (!matchSnap.exists()) {
      elLoading.style.display = "none";
      elError.style.display = "block";
      return;
    }

    activeMatch = matchSnap.data();
    
    // Get the unique match ID from configuration settings
    currentMatchId = activeMatch.matchId || 'active_match';
    
    // Populate match UI
    elTeamAName.textContent = activeMatch.teamA;
    elTeamBName.textContent = activeMatch.teamB;
    elTeamALogo.textContent = activeMatch.teamAFlag || "⚽";
    elTeamBLogo.textContent = activeMatch.teamBFlag || "⚽";

    // Display Kickoff Time in IST format
    if (activeMatch.kickoff) {
      const kickoffDate = new Date(activeMatch.kickoff);
      elKickoffDisplay.textContent = "Kickoff: " + kickoffDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + " IST";
    } else {
      // Fallback for older matches
      const kickoffDate = new Date(new Date(activeMatch.deadline).getTime() + 5 * 60 * 1000);
      elKickoffDisplay.textContent = "Kickoff: " + kickoffDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + " IST";
    }
    
    // Check if user has already predicted this match
    const cachedReceipt = localStorage.getItem(`receipt_${currentMatchId}`);
    if (cachedReceipt) {
      showReceipt(JSON.parse(cachedReceipt));
      elLoading.style.display = "none";
      return;
    }

    // Initialize Countdown Timer
    startCountdown(activeMatch.deadline);

    elLoading.style.display = "none";
    elActive.style.display = "block";
  } catch (error) {
    console.error("Error loading active match details:", error);
    showToast("Failed to load match details. Please refresh the page.", "error");
    elLoading.style.display = "none";
    elError.style.display = "block";
  }
}

// Countdown timer loop logic
function startCountdown(deadlineStr) {
  const deadline = new Date(deadlineStr).getTime();
  
  // Total span helper (assume timer starts from configuration time, or default to 24h if missing)
  const startTime = activeMatch.createdAt ? new Date(activeMatch.createdAt).getTime() : (deadline - 24 * 60 * 60 * 1000);
  const totalDuration = deadline - startTime;

  function updateTimer() {
    const now = new Date().getTime();
    const distance = deadline - now;

    if (distance <= 0) {
      clearInterval(timerInterval);
      lockSubmissions();
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    elDays.textContent = String(days).padStart(2, "0");
    elHours.textContent = String(hours).padStart(2, "0");
    elMins.textContent = String(minutes).padStart(2, "0");
    elSecs.textContent = String(seconds).padStart(2, "0");

    // Dynamic progress bar calculation
    const progressPercent = Math.min(100, Math.max(0, (distance / totalDuration) * 100));
    elTimerProgress.style.width = `${progressPercent}%`;
  }

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// Disable all prediction controls if time limit expires
function lockSubmissions() {
  elDays.textContent = "00";
  elHours.textContent = "00";
  elMins.textContent = "00";
  elSecs.textContent = "00";
  elTimerProgress.style.width = "0%";
  
  elTimerStatus.textContent = "Prediction Window Closed";
  elTimerStatus.style.color = "#ef4444";
  
  // Disable score UI
  btnTeamAMinus.disabled = true;
  btnTeamAPlus.disabled = true;
  btnTeamBMinus.disabled = true;
  btnTeamBPlus.disabled = true;
  
  // Lock inputs
  document.getElementById("student-name").disabled = true;
  document.getElementById("student-phone").disabled = true;
  btnSubmit.disabled = true;
  
  elLockedBadge.style.display = "inline-flex";
}

// Switch UI view to receipt
function showReceipt(data) {
  elReceiptName.textContent = data.name;
  elReceiptPhone.textContent = data.phone;
  elReceiptPrediction.textContent = `${activeMatch.teamAFlag || ""} ${data.scoreA} - ${data.scoreB} ${activeMatch.teamBFlag || ""}`;
  
  const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString();
  elReceiptTime.textContent = dateStr;

  elActive.style.display = "none";
  elSuccess.style.display = "block";
}

// Custom Event Listeners to handle scoreboard submissions
window.addEventListener("app-submit-prediction", async (e) => {
  const { name, phone, scoreA, scoreB } = e.detail;

  // Basic validation: strip space/special chars from phone number
  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  if (cleanPhone.length < 7) {
    showToast("Please enter a valid phone number.", "error");
    return;
  }

  // Double check deadline client side
  const deadlineTime = new Date(activeMatch.deadline).getTime();
  if (new Date().getTime() >= deadlineTime) {
    showToast("Submissions have closed for this match!", "error");
    lockSubmissions();
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span>Saving Prediction...</span> <i class="fa-solid fa-circle-notch fa-spin"></i>';

  try {
    // Check if phone number has already submitted a prediction for this match
    const predsRef = collection(db, "predictions");
    const q = query(
      predsRef, 
      where("phone", "==", cleanPhone), 
      where("matchId", "==", currentMatchId)
    );
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      showToast("This phone number has already placed a prediction!", "error");
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>Lock In Prediction</span> <i class="fa-solid fa-paper-plane"></i>';
      return;
    }

    // Save prediction record
    const predictionDoc = {
      name: name,
      phone: cleanPhone,
      scoreA: scoreA,
      scoreB: scoreB,
      matchId: currentMatchId,
      timestamp: serverTimestamp()
    };

    const docRef = await addDoc(predsRef, predictionDoc);
    
    // Receipt data for local caching
    const receiptData = {
      id: docRef.id,
      name: name,
      phone: cleanPhone,
      scoreA: scoreA,
      scoreB: scoreB,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(`receipt_${currentMatchId}`, JSON.stringify(receiptData));

    // Show Success UI and launch confetti!
    showReceipt(receiptData);
    triggerConfetti();
    showToast("Prediction saved successfully!", "success");

  } catch (error) {
    console.error("Error submitting prediction:", error);
    showToast("Failed to submit prediction. Try again.", "error");
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<span>Lock In Prediction</span> <i class="fa-solid fa-paper-plane"></i>';
  }
});

// Trigger dynamic confetti celebrations
function triggerConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#06b6d4', '#10b981', '#fbbf24']
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#06b6d4', '#10b981', '#fbbf24']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Reset view to allow new predictions (for testing or multiple devices)
window.addEventListener("app-reset-prediction", () => {
  localStorage.removeItem(`receipt_${currentMatchId}`);
  elSuccess.style.display = "none";
  elActive.style.display = "block";
  
  // Reset score visual inputs
  elTeamADisplay.textContent = "0";
  elTeamBDisplay.textContent = "0";
  
  // Clear inputs
  elForm.reset();
  
  // Re-verify locking status
  const deadlineTime = new Date(activeMatch.deadline).getTime();
  if (new Date().getTime() >= deadlineTime) {
    lockSubmissions();
  } else {
    document.getElementById("student-name").disabled = false;
    document.getElementById("student-phone").disabled = false;
    btnSubmit.disabled = false;
    elLockedBadge.style.display = "none";
    elTimerStatus.textContent = "Submissions Close In";
    elTimerStatus.style.color = "var(--text-muted)";
  }
});
