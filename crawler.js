const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');

async function runBot() {
  console.log("🚀 BOT SĂN TIN ĐANG CHẠY...");

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
  }

  const db = admin.database();

  try {

    const targetUrl = "https://vnexpress.net/oto-xe-may";
    const response = await axios.get(targetUrl);

    const $ = cheerio.load(response.data);

    const snapshot = await db.ref('xe_san_duoc').once('value');
    const existing = snapshot.val() || {};

    const existingLinks = Object.values(existing).map(p => p.link);

    let count = 0;

    const tasks = [];

    $('.title-news a').each((i, el) => {

      if (count >= 5) return;

      const title = $(el).text().trim();
      const link = $(el).attr('href');

      if (link && !existingLinks.includes(link)) {

        console.log("🔍 TÌM THẤY:", title);

        tasks.push(

          db.ref('xe_san_duoc').push({
            ten_xe: title,
            link: link,
            ngay_quet: new Date().toLocaleString('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh'
            })
          })

        );

        count++;

      }

    });

    if (tasks.length > 0) {

      await Promise.all(tasks);

      console.log(`✅ ĐÃ THÊM ${count} TIN MỚI`);

    } else {

      console.log("😴 KHÔNG CÓ TIN MỚI");

    }

    process.exit(0);

  } catch (err) {

    console.error("❌ LỖI:", err.message);

    process.exit(1);

  }

}

runBot();
