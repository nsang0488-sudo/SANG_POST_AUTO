const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');

async function runBot() {
  console.log("🚀 BẮT ĐẦU ĐI SĂN TIN...");
  
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app`
    });
  }
  const db = admin.database();

  try {
    const targetUrl = 'https://vnexpress.net/phap-luat'; 
    const response = await axios.get(targetUrl);
    const $ = cheerio.load(response.data);
    
    const snapshot = await db.ref('posts').once('value');
    const existingPosts = snapshot.val() || {};
    const existingLinks = Object.values(existingPosts).map(p => p.link);

    let count = 0;
    const tasks = [];

    $('.title-news a').each((i, el) => {
      if (count < 5) { 
        const title = $(el).text().trim();
        let link = $(el).attr('href');

        if (link && !existingLinks.includes(link)) {
          console.log(`🔍 MỚI: ${title}`);
          tasks.push(db.ref('posts').push({
            title: title,
            link: link,
            date: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
          }));
          count++;
        }
      }
    });

    if (tasks.length > 0) {
      await Promise.all(tasks);
      console.log(`✅ THÀNH CÔNG: Đã thêm ${count} tin mới!`);
    } else {
      console.log("😴 Không có tin nào mới.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ LỖI:", err.message);
    process.exit(1);
  }
}

runBot();
