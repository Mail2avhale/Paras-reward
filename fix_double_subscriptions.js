// Fix Double Subscriptions - 15 March 2026
// Run this in browser console while logged in as Admin

const users = [
  { mobile: "8830307280", name: "Gajendra Sonar", days: 26 },
  { mobile: "7776886043", name: "Vikas Deshmukh", days: 26 },
  { mobile: "6355519754", name: "Ricky Kamil", days: 26 },
  { mobile: "9550983228", name: "Chhaya Anand", days: 26 },
  { mobile: "9304724301", name: "Roopa", days: 25 },
  { mobile: "7878948814", name: "Chhavilal Chauhan", days: 26 },
  { mobile: "7996947070", name: "Utpal Suttradhar", days: 26 },
  { mobile: "6302535904", name: "Mudita", days: 26 },
  { mobile: "9264492883", name: "Khadia", days: 26 },
  { mobile: "9172044424", name: "Sheetlabodake", days: 26 },
  { mobile: "9322140373", name: "Ravinderpaswaan", days: 26 },
  { mobile: "8169070232", name: "Sameer Yalin", days: 26 },
  { mobile: "8882276647", name: "Dipak Mane", days: 26 }
];

async function fixAll() {
  console.log("Starting fix for " + users.length + " users...\n");
  
  for (const user of users) {
    try {
      const response = await fetch('/api/admin/fix-user-subscription-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: user.mobile,
          days_to_remove: user.days,
          reason: "Double subscription fix - 15 Mar 2026",
          admin_id: "Admin@paras.com"
        })
      });
      const result = await response.json();
      if (result.success) {
        console.log("✅ FIXED: " + user.name + " (" + user.mobile + ") - Removed " + user.days + " days");
      } else {
        console.log("❌ FAILED: " + user.name + " - " + (result.detail || result.message));
      }
    } catch (err) {
      console.log("❌ ERROR: " + user.name + " - " + err.message);
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log("\n========== FIX COMPLETE ==========");
}

// Run the fix
fixAll();
