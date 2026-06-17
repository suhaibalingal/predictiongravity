# FIFA World Cup 2026 Prediction Competition App

A high-fidelity, responsive, and serverless web application designed for school students to predict FIFA World Cup 2026 match scores. 

## Features
- **Student Prediction Portal (`index.html`)**: Features an interactive digital scoreboard, live countdown timer to the deadline, and name/phone registration. Confetti celebrates successful entries. Prevents duplicate submissions.
- **Admin Control Panel (`admin.html`)**: Allows the organizer to set the active match, change flags, modify the prediction deadline, enter correct scores, and view student submissions in real-time.
- **Automatic Winner Calculation**: Instantly filters correct scorelines, sorts them by submission timestamp (earliest submission wins), and displays the winners on a 3D-style podium and leaderboard.

---

## 🛠️ Step-by-Step Setup Guide

To run this application, you only need a web browser and a free Google Firebase account. No local installation of Node.js, Python, or servers is required.

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it (e.g., `school-wc-predictor`). Click **Continue**.
3. Disable Google Analytics for this project (optional, simplifies setup), and click **Create Project**.
4. Once ready, click **Continue** to load your project dashboard.

### Step 2: Set Up Firestore Database
1. In the left sidebar, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Select a location close to you and click **Next**.
4. Choose **Start in test mode** (this allows quick client-side reads and writes during your competition) and click **Create**.

### Step 3: Link Firebase to the Code
1. On your Firebase Project overview page, click the **Web icon `</>`** (under "Get started by adding Firebase to your app").
2. Register the app by typing a nickname (e.g., `predictor-web`) and click **Register App**.
3. Firebase will show you a `const firebaseConfig = { ... }` block of code. Copy those credentials.
4. Open the project file [firebase-config.js](file:///Users/suhaibalingal/.gemini/antigravity/scratch/fifa-predictor/js/firebase-config.js).
5. Replace the placeholder credentials inside the `firebaseConfig` object with your copied keys:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     ...
   };
   ```
6. Save the file.

---

## ⚙️ Administration & Security

### Admin Passcode
The default passcode to enter the Admin Panel (`admin.html`) is **`2026`**.
- To change this passcode, open [admin.js](file:///Users/suhaibalingal/.gemini/antigravity/scratch/fifa-predictor/js/admin.js).
- Locate the line `const ADMIN_PASSCODE = "2026";` (line 12) and change the value to your preferred passcode.

### Firestore Security Rules (Optional but Recommended)
To prevent tech-savvy students from querying other students' phone numbers or submitting predictions after the deadline, paste these rules in your **Firebase Console** under **Firestore Database** > **Rules** tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Anyone can read the active match details
    match /settings/match {
      allow read, write: if true; // Allow client-side admin setup
    }

    // Secure student predictions
    match /predictions/{predictionId} {
      // Allow creation only if current time is before prediction deadline
      allow create: if request.resource.data.matchId != null &&
                       request.resource.data.name != null &&
                       request.resource.data.phone != null &&
                       request.resource.data.scoreA is int &&
                       request.resource.data.scoreB is int &&
                       request.time < timestamp(get(/databases/$(database)/documents/settings/match).data.deadline);
      
      // Allow read so student portal can fetch winners and admin can calculate results
      allow read: if true; 
      
      // Prevent students from editing or deleting predictions
      allow update, delete: if false;
    }

    // Leaderboard access
    match /leaderboard/{phone} {
      allow read, write: if true; // Allow student read, and admin recalculation writes
    }
  }
}
```

---

## 🚀 How to Open and Run the App

1. Double-click [index.html](file:///Users/suhaibalingal/.gemini/antigravity/scratch/fifa-predictor/index.html) to open the Student Portal in any browser.
2. Double-click [admin.html](file:///Users/suhaibalingal/.gemini/antigravity/scratch/fifa-predictor/admin.html) to open the Admin Dashboard.
3. To share this with students:
   - You can upload these files to any static web hosting like **Firebase Hosting** (using the Firebase CLI), **GitHub Pages** (free), **Netlify**, or **Vercel**.
   - Alternatively, students can load it locally if you distribute the folder.
