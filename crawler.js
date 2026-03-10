const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs"); // Thêm thư viện fs để lưu file debug

// Chuyển link group thành định dạng mbasic để nhẹ và dễ cào hơn
function toMBasic(url) {
  try {
    const u = new URL(url);
    u.hostname = "mbasic.facebook.com";
    u.searchParams.set("sorting_setting", "CHRONOLOGICAL"); // Ép xếp theo thời gian thực
    return u.toString();
  } catch {
    return url;
  }
}

async function runBot() {
  console.log("🚀 FACEBOOK GROUP CRAWLER START");

  try {
    // ===== FIREBASE SETUP =====
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
    }

    const db = admin.database();

    // ===== LOAD CONFIG =====
    const snap = await db.ref("hunt_settings").once("value");
    const config = snap.val();

    if (!config) {
      console.log("❌ Không có config trong Firebase");
      return;
    }

    const groups = config.groups.split("\n").map(g => g.trim()).filter(Boolean);
    const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
    const cookie = config.cookie;

    console.log(`📌 Tổng số Groups: ${groups.length}`);
    console.log(`🔑 Keywords đang tìm: ${keywords.join(", ")}`);

    const scanned = new Set(); // Chống trùng lặp toàn cục

    // ===== BẮT ĐẦU QUÉT TỪNG GROUP =====
    for (let group of groups) {
      let url = toMBasic(group);
      let page = 0;

      while (url && page < 5) {
        console.log(`\n🔎 Đang quét PAGE ${page + 1} của group: ${group.substring(0, 50)}...`);

        // Gửi Request với User-Agent của Mobile
        const res = await axios.get(url, {
          headers: {
            cookie: cookie,
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "sec-fetch-site": "none",
            "sec-fetch-mode": "navigate"
          },
          timeout: 20000
        });

        const html = res.data;

        // Lưu file HTML ra máy để bạn có thể mở xem cấu trúc nếu bot xịt
        fs.writeFileSync("debug_facebook.html", html);

        // Kiểm tra xem Cookie có bị Facebook chặn/đăng xuất không
        if (html.includes("login") || html.includes("checkpoint") || html.includes("Please log in")) {
          console.log("❌ COOKIE DIE HOẶC BỊ CHECKPOINT");
          return;
        }

        const $ = cheerio.load(html);
        let found = 0;
        const pageScannedLinks = new Set(); // Chống trùng lặp link trong cùng 1 page

        // ===== CÁCH TÌM POST MỚI (Thay cho div[data-ft]) =====
        // Tìm tất cả các thẻ <a> có chứa link bài viết
        $("a[href*='/permalink/'], a[href*='story.php'], a[href*='/posts/']").each((i, a) => {
          let link = $(a).attr("href") || "";
          
          // Lọc rác
          if (link.includes("comment") || link.includes("reaction")) return;

          let fullLink = link.startsWith("http") ? link : "https://m.facebook.com" + link;
          
          // Bỏ qua nếu đã quét rồi
          if (scanned.has(fullLink) || pageScannedLinks.has(fullLink)) return;

          // Lấy thẻ cha chứa toàn bộ nội dung bài viết
          // mbasic thường bọc post bằng div hoặc table. Thử lấy parent() ngược lên 3-4 cấp
          const postContainer = $(a).closest('div[id], table').length ? $(a).closest('div[id], table') : $(a).parent().parent().parent().parent();
          
          const text = postContainer.text().replace(/\s+/g, " ").toLowerCase();

          // Kiểm tra xem bài viết có chứa keyword không
          const match = keywords.some(k => text.includes(k));

          if (match) {
            pageScannedLinks.add(fullLink);
            scanned.add(fullLink);

            console.log("✅ TÌM THẤY BÀI VIẾT PHÙ HỢP");
            console.log("🔗 Link:", fullLink);

            // Đẩy lên Firebase
            db.ref("xe_san_duoc").push({
              text: text.substring(0, 500) + "...", // Cắt bớt nếu quá dài
              link: fullLink,
              time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
            });

            found++;
          }
        });

        console.log(`📄 Page ${page + 1} tìm được: ${found} bài viết mới`);

        // ===== NEXT PAGE (Chuyển trang) =====
        // Tìm link phân trang theo tham số bac= hoặc cursor= (cách mbasic load trang tiếp theo)
        let nextLink = $("a[href*='bac='], a[href*='cursor=']").last().attr("href");
        
        // Fallback: Tìm theo chữ như cũ phòng hờ
        if (!nextLink) {
            nextLink = $("a:contains('See more'), a:contains('Xem thêm')").attr("href");
        }

        if (nextLink) {
          url = nextLink.startsWith("http") ? nextLink : "https://mbasic.facebook.com" + nextLink;
          page++;
          // Delay ngẫu nhiên từ 3-5 giây để tránh bị Facebook khóa tính năng do quét quá nhanh
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000) + 3000));
        } else {
          console.log("🛑 Không tìm thấy nút Next Page, kết thúc quét Group này.");
          url = null;
        }
      }
    }

    console.log("🎉 DONE! ĐÃ QUÉT XONG TẤT CẢ GROUPS.");
    process.exit(0);

  } catch (err) {
    console.log("❌ ERROR LỖI HỆ THỐNG:", err.message);
  }
}

// Chạy bot
runBot();
