const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

// Chuyển URL sang mbasic và ép hiển thị bài mới nhất theo thời gian
function convertToMBasic(url) {
  try {
    const u = new URL(url);
    u.hostname = "mbasic.facebook.com";
    u.searchParams.set("sorting_setting", "CHRONOLOGICAL");
    return u.toString();
  } catch {
    return url;
  }
}

async function runBot() {
  console.log("🚀 BOT SĂN XE SUPER VIP - BẢN VẾT DẦU LOANG (CHỐT)");

  try {
    // 1. KẾT NỐI FIREBASE
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();
    
    // 2. ĐỌC CẤU HÌNH TỪ WEB APP
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    if (!config || !config.groups || !config.keywords || !config.cookie) {
      console.log("❌ LỖI: Thiếu Config hoặc Cookie trên Firebase!");
      process.exit(0);
    }

    const groups = config.groups.split("\n").map(g => g.trim()).filter(g => g.length > 0);
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    const rawCookie = config.cookie;

    console.log(`📌 QUÉT ${groups.length} GROUP | 🔑 TỪ KHÓA: [${keywords.join(", ")}]`);

    const scanned = new Set();

    for (let group of groups) {
      let url = convertToMBasic(group);
      let page = 0;

      while (url && page < 6) { // Quét sâu 6 trang đầu
        console.log(`🔎 ĐANG LỤC SOÁT TRANG ${page + 1}: ${url}`);

        try {
          const res = await axios.get(url, {
            headers: {
              'cookie': rawCookie,
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
          });

          const html = res.data;
          if (html.includes("login") || html.includes("checkpoint")) {
            console.log("❌ COOKIE DIE HOẶC BỊ CHẶN! Sang hãy lấy Cookie mới dán vào Web App.");
            process.exit(0);
          }

          const $ = cheerio.load(html);
          let foundCount = 0;

          // THUẬT TOÁN MỚI: QUÉT TẤT CẢ CÁC KHỐI CÓ THỂ CHỨA BÀI VIẾT
          // Chúng ta quét mọi div có class ngắn (đặc trưng mbasic) hoặc article
          $("div.ba, div.bw, div.bl, div.bm, div.bn, article, div[role='article']").each((i, el) => {
            const rawText = $(el).text();
            const cleanText = rawText.replace(/\s+/g, ' ').toLowerCase();

            // Kiểm tra khớp từ khóa (không phân biệt hoa thường, miễn dính là lượm)
            const isMatch = keywords.some(k => cleanText.includes(k.trim()));

            if (isMatch) {
              // Tìm link bài viết: tìm mọi link chứa story.php, bài viết lẻ, hoặc permalink
              let link = $(el).find("a[href*='story.php'], a[href*='/permalink/'], a[href*='/posts/']").first().attr('href');
              
              if (!link) return;

              // Làm sạch link để đưa về dạng m.facebook.com cho Sang dễ bấm
              let fullLink = link.startsWith("http") ? link : "https://m.facebook.com" + link;
              fullLink = fullLink.split("&")[0].split("?")[0]; // Lấy link gốc cho sạch

              if (scanned.has(fullLink)) return;
              scanned.add(fullLink);

              console.log("✅ PHÁT HIỆN BÀI MỚI: ", cleanText.substring(0, 50) + "...");

              // ĐẨY LÊN FIREBASE
              db.ref("xe_san_duoc").push({
                ten_xe: rawText.trim().substring(0, 600), // Lấy nội dung dài hơn để Sang đọc cho kỹ
                link: fullLink,
                ngay_quet: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
              });
              foundCount++;
            }
          });

          console.log(`📄 Tìm được ${foundCount} bài khớp từ khóa.`);

          // Tìm nút "Xem thêm bài viết"
          let nextLink = $("a:contains('Xem thêm'), a:contains('See more'), a:contains('See More')").attr("href");
          
          if (nextLink) {
            url = "https://mbasic.facebook.com" + nextLink;
            page++;
            await new Promise(r => setTimeout(r, 3000)); // Nghỉ 3s để né trảm của FB
          } else {
            url = null;
          }

        } catch (e) {
          console.log("⚠️ Lỗi truy cập trang, có thể do mạng.");
          url = null;
        }
      }
    }

    console.log("🎉 HOÀN THÀNH VÒNG QUÉT.");
    process.exit(0);

  } catch (err) {
    console.log("❌ LỖI HỆ THỐNG:", err.message);
    process.exit(1);
  }
}

runBot();
