const admin = require("firebase-admin");
const puppeteer = require("puppeteer");

async function runBot() {
  console.log("🚀 BOT SĂN XE TRÊN FACEBOOK ĐANG CHẠY");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app",
      });
    }

    const db = admin.database();

    // 1. Đọc config từ firebase
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

    // 2. Mở trình duyệt ảo
    console.log("🌐 Đang khởi động trình duyệt ảo...");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-notifications"]
    });

    const page = await browser.newPage();
    
    // Giả lập máy tính thật để FB không chặn
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 3. NẠP COOKIE FACEBOOK VÀO TRÌNH DUYỆT
    const rawCookie = 'sb=vT6laG97DW9PEmRR6B777vUr; datr=vT6laGhoEHk8DXGhT9syuE6G; fr=1ZyUaHFHU5TY1pATp.AWcAc1E05tRd-VBSekwLeTKGx152_AM1sHcn0O_hFkCDrdL4CxU.Bpr_n-..AAA.0.0.Bpr_of.AWczaDZOLSsZM_L4bQ; c_user=100080351703217; xs=1%3AE7baXfLg5KVXBA%3A2%3A1773140474%3A-1%3A-1%3A%3AAcxTU9UToHGsa-LqTVGccD3UC-PRRzMu01x4bH22gA; wd=982x738';
    
    const cookieArray = rawCookie.split(';').map(pair => {
      const [name, ...rest] = pair.trim().split('=');
      return { name: name, value: rest.join('='), domain: '.facebook.com' };
    });
    
    await page.setCookie(...cookieArray);
    console.log("🍪 Đã nạp Cookie thành công! Bắt đầu đi săn...");

    // 4. Bắt đầu quét từng Group
    for (let group of groups) {
      try {
        console.log(`🔎 ĐANG QUÉT: ${group}`);
        await page.goto(group, { waitUntil: "networkidle2", timeout: 60000 });
        
        // Chờ 7 giây để Facebook tải xong bài viết (thay thế waitForTimeout để tránh lỗi bản mới)
        await new Promise(r => setTimeout(r, 7000)); 

        const posts = await page.evaluate(() => {
          const result = [];
          document.querySelectorAll("div[role='article']").forEach(post => {
            const text = post.innerText;
            // Tìm link bài viết chi tiết
            const linkTag = post.querySelector("a[href*='/posts/'], a[href*='/permalink/']");
            if (text && linkTag) {
              result.push({ text: text, link: linkTag.href });
            }
          });
          return result;
        });

        console.log(`📄 TÌM THẤY: ${posts.length} BÀI TRONG GROUP NÀY`);

        for (let p of posts) {
          const content = p.text.toLowerCase();
          const match = keywords.some(k => content.includes(k));

          if (match) {
            console.log("✅ TRÚNG MÁNH: Phát hiện xe đúng Keyword!");
            await db.ref("xe_san_duoc").push({
              ten_xe: p.text.substring(0, 150),
              link: p.link,
              ngay_quet: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
            });
          }
        }
      } catch (err) {
        console.log("⚠️ LỖI BỎ QUA GROUP:", group, err.message);
      }
    }

    await browser.close();
    console.log("🎉 BOT ĐÃ HOÀN THÀNH VÒNG QUÉT!");
    process.exit(0);

  } catch (err) {
    console.log("❌ LỖI HỆ THỐNG:", err.message);
    process.exit(1);
  }
}

runBot();
