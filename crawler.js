const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

// Chuyển URL sang mbasic và ép hiển thị bài mới nhất
function convertToMBasic(url) {
  try {
    const u = new URL(url);
    u.hostname = "mbasic.facebook.com";
    // Ép Facebook hiện bài mới lên đầu
    u.searchParams.set("sorting_setting", "CHRONOLOGICAL");
    return u.toString();
  } catch {
    return url;
  }
}

async function runBot() {
  console.log("🚀 BOT SĂN XE SUPER VIP - DỒN TOÀN LỰC");

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    if (!config || !config.groups || !config.keywords || !config.cookie) {
      console.log("❌ LỖI: Thiếu Config hoặc Cookie trên Firebase!");
      process.exit(0);
    }

    const groups = config.groups.split("\n").map(g => g.trim()).filter(g => g.length > 0);
    // Làm sạch từ khóa: bỏ dấu cách thừa, chuyển về chữ thường
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    const rawCookie = config.cookie;

    console.log(`📌 QUÉT ${groups.length} GROUP | 🔑 TỪ KHÓA: [${keywords.join(", ")}]`);

    const scanned = new Set();

    for (let group of groups) {
      let url = convertToMBasic(group);
      let page = 0;

      while (url && page < 5) { // Quét 5 trang mỗi group là đủ sâu
        console.log(`🔎 ĐANG LỌC BÀI TẠI: ${url}`);

        try {
          const res = await axios.get(url, {
            headers: {
              'cookie': rawCookie,
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'accept-language': 'vi-VN,vi;q=0.9'
            },
            timeout: 10000
          });

          const html = res.data;

          if (html.includes("login") || html.includes("checkpoint") || html.includes("Log In")) {
            console.log("❌ COOKIE DIE! Dán Cookie mới vào Web App ngay Sang ơi!");
            process.exit(0);
          }

          const $ = cheerio.load(html);
          let foundCount = 0;

          // QUÉT ĐA TẦNG: article, div bài viết, story container
          $("article, div[role='article'], .story_body_container, .ba").each((i, el) => {
            // Lấy sạch chữ bên trong bài viết
            const rawText = $(el).text();
            const cleanText = rawText.replace(/\s+/g, ' ').toLowerCase();

            // Kiểm tra khớp từ khóa
            const isMatch = keywords.some(k => cleanText.includes(k));

            if (isMatch) {
              // Tìm link bài viết chuẩn
              let link = $(el).find("a[href*='story.php']").attr("href") || 
                         $(el).find("a[href*='/groups/']").attr("href") || "";
              
              if (!link) return;
              
              let fullLink = link.startsWith("http") ? link : "https://facebook.com" + link;
              fullLink = fullLink.split("?")[0]; // Làm sạch link

              if (scanned.has(fullLink)) return;
              scanned.add(fullLink);

              console.log("✅ PHÁT HIỆN KÈO NGON: ", cleanText.substring(0, 60) + "...");

              db.ref("xe_san_duoc").push({
                ten_xe: rawText.trim().substring(0, 300),
                link: fullLink,
                ngay_quet: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
              });
              foundCount++;
            }
          });

          console.log(`📄 Trang ${page + 1}: Tìm thấy ${foundCount} bài.`);

          // Tìm nút "Xem thêm"
          let next = $("a:contains('See more'), a:contains('Xem thêm'), a:contains('See More')").attr("href");
          url = next ? "https://mbasic.facebook.com" + next : null;
          page++;
          
          if (url) await new Promise(r => setTimeout(r, 2000)); // Nghỉ 2s tránh bị sập

        } catch (axiosErr) {
          console.log(`⚠️ Lỗi khi tải trang: ${axiosErr.message}`);
          url = null;
        }
      }
    }

    console.log("🎉 XONG! CHỜ VÒNG QUÉT TIẾP THEO.");
    process.exit(0);

  } catch (err) {
    console.log("❌ LỖI HỆ THỐNG:", err.message);
    process.exit(1);
  }
}

runBot();
