const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');

async function runBot() {
  console.log("🚀 BẮT ĐẦU ĐI SĂN TIN...");
  
  // 1. Kết nối Firebase
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app`
    });
  }
  const db = admin.database();

  try {
    // 2. Cấu hình trang web muốn lấy tin (Ví dụ lấy tin từ một trang mẫu)
    // Sang có thể thay link này bằng link trang bạn muốn săn
    const targetUrl = 'https://vnexpress.net/phap-luat'; 
    const response = await axios.get(targetUrl);
    const $ = cheerio.load(response.data);
    let count = 0;

    // 3. Tìm các link bài viết (Ví dụ tìm các thẻ h3 chứa link)
    const tasks = [];
    $('.title-news a').each((i, el) => {
      if (i < 5) { // Lấy 5 bài mới nhất thôi cho nhẹ
        const title = $(el).text().trim();
        const link = $(el).attr('href');
        
        if (link) {
          console.log(`🔍 Tìm thấy: ${title}`);
          // Lưu vào Firebase
          tasks.push(db.ref('posts').push({
            title: title,
            link: link,
            date: new Date().toISOString()
          }));
          count++;
        }
      }
    });

    await Promise.all(tasks);
    console.log(`✅ ĐÃ SĂN ĐƯỢC ${count} LINK VÀ LƯU VÀO FIREBASE!`);
    process.exit(0);

  } catch (err) {
    console.error("❌ LỖI KHI ĐI SĂN:", err.message);
    process.exit(1);
  }
}

runBot();
