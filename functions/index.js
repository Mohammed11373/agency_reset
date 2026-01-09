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

// 🔹 نقاط كل مستوى (cumulative)
const levelPoints = [
  0, 20000, 60000, 120000, 200000, 300000, 420000, 560000, 720000, 900000,
  1100000, 1400000, 1700000, 2100000, 2500000, 3000000, 3500000, 4100000, 4700000, 5400000,
  6100000, 6900000, 7700000, 8600000, 9500000, 10500000, 11500000, 12600000, 13700000, 14900000,
  16100000, 17500000, 18900000, 20500000, 22100000, 23900000, 25700000, 27700000, 29700000, 31900000,
  34100000, 36600000, 39100000, 41900000, 44700000, 47800000, 50900000, 54400000, 57900000, 61900000,
  65900000, 70900000, 75900000, 81400000, 86900000, 92900000, 98900000, 105400000, 111900000, 118900000,
  125900000, 134900000, 143900000, 152900000, 161900000, 170900000, 181900000, 192900000, 203900000, 214900000,
  225900000, 240900000, 255900000, 270900000, 285900000, 300900000, 320900000, 340900000, 360900000, 380900000,
  400900000, 430900000, 460900000, 490000000, 520900000, 550900000, 580900000, 610900000, 640900000, 670900000,
  700900000, 730900000, 760900000, 790900000, 820900000, 850900000, 880900000, 910900000, 940900000, 970900000,
  1000900000
];

// 🔹 حساب المستوى
function calculateLevel(sentGiftsValue = 0) {
  let level = 0;
  for (let i = 0; i < levelPoints.length; i++) {
    if (sentGiftsValue >= levelPoints[i]) {
      level = i;
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
  } catch (error) {
    console.error("❌ Error updating user levels:", error);
  }
}

// 🔹 حماية من التكرار لتصفير giftCoins
let lastResetDate = null;

// 🔹 تصفير giftCoins يوم 14 الساعة 12:00 ظهرًا وآخر يوم في الشهر الساعة 12:00 منتصف الليل (توقيت ليبيا)
async function resetUserGiftCoins() {
  try {
    const now = new Date();
    const libyaHour = (now.getUTCHours() + 2) % 24; // توقيت ليبيا GMT+2
    const minutes = now.getUTCMinutes();
    const today = now.toISOString().split("T")[0];
    const dayOfMonth = now.getUTCDate();
    const lastDayOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();

    // منع التصفير أكثر من مرة في اليوم
    if (lastResetDate === today) return;

    const is14thNoon = dayOfMonth === 14 && libyaHour === 12 && minutes === 0;
    const isLastDayMidnight = dayOfMonth === lastDayOfMonth && libyaHour === 0 && minutes === 0;

    if (is14thNoon || isLastDayMidnight) {
      lastResetDate = today;
      console.log("⏳ resetting user giftCoins...");

      const usersSnapshot = await db.collection("users").get();
      const batch = db.batch();
      for (const userDoc of usersSnapshot.docs) {
        batch.update(userDoc.ref, { giftCoins: 0 });
      }
      await batch.commit();
      console.log("✅ user giftCoins reset done");
    }
  } catch (error) {
    console.error("❌ Error resetting user giftCoins:", error);
  }
}

// 🔹 endpoint Ping للحفاظ على السيرفر نشط
app.get("/ping", (req, res) => {
  res.send("🏓 Pong");
});

// 🔹 endpoint يدوي لتحديث المستويات أو تصفير الهدايا (اختياري)
app.get("/update-user-levels", async (req, res) => {
  await updateUserLevels();
  res.send("User levels updated manually");
});

app.get("/reset-giftcoins", async (req, res) => {
  await resetUserGiftCoins();
  res.send("GiftCoins check executed");
});

// 🔹 تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// 🔹 المهام المجدولة
setInterval(updateUserLevels, 1000);       // كل ثانية
setInterval(resetUserGiftCoins, 60 * 1000); // كل دقيقة للتحقق من وقت التصفير