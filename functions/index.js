const admin = require("firebase-admin");
const express = require("express");

// 🔹 تهيئة Firebase Admin SDK باستخدام متغير البيئة
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ متغير البيئة FIREBASE_SERVICE_ACCOUNT غير موجود!");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://joan-chat-default-rtdb.firebaseio.com" // عدّل للرابط الخاص بك
});

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 نقاط كل مستوى
const levelPoints = [
  500, 2000, 4000, 7000, 10000, 14000, 19000, 25000, 32000, 40000,
  49000, 59000, 70000, 82000, 95000, 109000, 124000, 140000, 157000, 175000,
  194000, 214000, 235000, 257000, 280000, 304000, 329000, 355000, 382000, 410000,
  439000, 469000, 500000, 532000, 565000, 599000, 634000, 670000, 707000, 745000,
  784000, 824000, 865000, 907000, 950000, 994000, 1039000, 1085000, 1132000, 1180000,
  1229000, 1279000, 1330000, 1382000, 1435000, 1489000, 1544000, 1600000, 1657000, 1715000,
  1774000, 1834000, 1895000, 1957000, 2020000, 2084000, 2149000, 2215000, 2282000, 2350000,
  2419000, 2489000, 2560000, 2632000, 2705000, 2779000, 2854000, 2930000, 3007000, 3085000,
  3164000, 3244000, 3325000, 3407000, 3490000, 3574000, 3659000, 3745000, 3832000, 3920000,
  4009000, 4099000, 4190000, 4282000, 4375000, 4469000, 4564000, 4660000, 4757000, 4855000
];

// 🔹 حساب المستوى
function calculateLevel(sentGiftsValue = 0) {
  let level = 1;
  for (let i = 0; i < levelPoints.length; i++) {
    if (sentGiftsValue >= levelPoints[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

// 🔹 تحديث مستوى مستخدم
async function updateUserLevel(userDoc) {
  const data = userDoc.data() || {};
  const sentGiftsValue = Number(data.sentGiftsValue || 0);
  const newLevel = calculateLevel(sentGiftsValue);

  if (String(data.levelText) !== String(newLevel)) {
    await userDoc.ref.update({ levelText: String(newLevel) });
    console.log(`✅ user ${userDoc.id} → level ${newLevel}`);
  }
}

// 🔹 تحديث مستويات كل المستخدمين
async function updateUserLevels() {
  try {
    const snapshot = await db.collection("users").get();
    for (const doc of snapshot.docs) {
      await updateUserLevel(doc);
    }
    console.log("✅ all user levels updated");
  } catch (error) {
    console.error("❌ Error updating user levels:", error);
  }
}

// 🔹 حماية من التكرار
let lastResetDate = null;

// 🔹 تصفير giftCoins اليوم الساعة 1:00 ظهرًا (توقيت ليبيا)
async function resetAgencyGiftCoins() {
  try {
    const now = new Date();

    // توقيت ليبيا GMT+2
    const libyaHour = (now.getUTCHours() + 2) % 24;
    const minutes = now.getUTCMinutes();
    const today = now.toISOString().split("T")[0];

    if (libyaHour === 13 && minutes === 0 && lastResetDate !== today) {
      lastResetDate = today;

      console.log("⏳ resetting agency giftCoins (1:00 PM Libya)...");

      const agenciesSnapshot = await db.collection("agencies").get();
      const batch = db.batch();

      for (const agencyDoc of agenciesSnapshot.docs) {
        batch.update(agencyDoc.ref, { giftCoins: 0 });

        const membersSnapshot = await agencyDoc.ref
          .collection("members")
          .get();

        membersSnapshot.forEach(memberDoc => {
          batch.update(memberDoc.ref, { giftCoins: 0 });
        });
      }

      await batch.commit();
      console.log("✅ agency giftCoins reset done");
    }
  } catch (error) {
    console.error("❌ Error resetting agency giftCoins:", error);
  }
}

// 🔹 endpoint يدوي (اختياري)
app.get("/reset-giftcoins", async (req, res) => {
  await resetAgencyGiftCoins();
  res.send("GiftCoins check executed");
});

// 🔹 تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// 🔹 المهام المجدولة
setInterval(updateUserLevels, 60 * 1000);      // كل دقيقة
setInterval(resetAgencyGiftCoins, 60 * 1000);  // فحص كل دقيقة