const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

async function runBot() {
  console.log("🚀 BOT SĂN XE TRÊN FACEBOOK ĐANG CHẠY (BẢN SIÊU TỐC)");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app",
      });
    }
    const db = admin.database();

    // 1. Đọc config từ firebase (Giữ nguyên logic của Sang)
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    if (!config || !config.groups || !config.keywords) {
      console.log("❌ Thiếu config (groups hoặc keywords) trên Firebase");
      process.exit(0);
    }

    const groups = config.groups.split("\n").map(g => g.trim()).filter(g => g.length > 0);
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k.length > 0);

    console.log("📌 SỐ LƯỢNG GROUP:", groups.length);
    console.log("🔑 KEYWORDS:", keywords);

    // 2. Cookie của Sang (Giữ nguyên bản gốc)
    const rawCookie = 'sb=vT6laG97DW9PEmRR6B777vUr; datr=vT6laGhoEHk8DXGhT9syuE6G; fr=1ZyUaHFHU5TY1pATp.AWcAc1E05tRd-VBSekwLeTKGx152_AM1sHcn0O_hFkCDrdL4CxU.Bpr_n-..AAA.0.0.Bpr_of.AWczaDZOLSsZM_L4bQ; c_user=100080351703217; xs=1%3AE7baXfLg5KVXBA%3A2%3A1773140474%3A-1%3A-1%3A%3AAcxTU9UToHGsa-LqTVGccD3UC-PRRzMu01x4bH22gA; wd=982x738';

    // 3. Quét từng Group
    for (let group of groups) {
      try {
        // Chuyển sang mbasic để quét cho nhanh và lách bộ lọc FB
        const mobileUrl = group.replace('www.facebook.com', 'mbasic.facebook.com');
        console.log(`🔎 ĐANG QUÉT: ${mobileUrl}`);

        const response = await axios.get(mobileUrl, {
          headers: {
            'cookie': rawCookie,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        let count = 0;

        // Quét các bài viết (thẻ article trong mbasic)
        $('article').each((i, el) => {
          const text = $(el).text();
          const lowerText = text.toLowerCase();
          
          // Kiểm tra từ khóa
          const match = keywords.some(k => lowerText.includes(k));

          if (match) {
            console.log("✅ TRÚNG MÁNH: Phát hiện xe đúng Keyword!");
            // Tìm link bài viết
            let linkRaw = $(el).find('footer a').attr('href') || "";
            let fullLink = linkRaw.includes('http') ? linkRaw : 'https://facebook.com' + linkRaw.split('?')[0];

            db.ref("xe_san_duoc").push({
              ten_xe: text.substring(0, 150),
              link: fullLink,
              ngay_quet: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
            });
            count++;
          }
        });
        console.log(`📄 Tìm thấy ${count} bài xe hợp lệ.`);
      } catch (err) {
        console.log(`⚠️ Lỗi tại group ${group}: ${err.message}`);
      }
    }

    console.log("🎉 BOT ĐÃ HOÀN THÀNH VÒNG QUÉT!");
    process.exit(0);

  } catch (err) {
    console.log("❌ LỖI HỆ THỐNG:", err.message);
    process.exit(1);
  }
}

runBot();
