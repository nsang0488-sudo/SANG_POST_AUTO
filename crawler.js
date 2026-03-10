const admin = require('firebase-admin');

async function runBot() {
  console.log("--- HỆ THỐNG ĐANG BẮT ĐẦU ---");
  
  if (!process.env.FIREBASE_CONFIG) {
    console.error("LỖI: Bạn chưa cài Secret FIREBASE_CONFIG.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app`
    });
  }

  console.log("✅ CHÚC MỪNG SANG! Bot đã tìm thấy file và kết nối thành công.");
  process.exit(0);
}

runBot().catch(err => {
  console.error("LỖI CHƯA XÁC ĐỊNH:", err.message);
  process.exit(1);
});
