const admin = require("firebase-admin");
const puppeteer = require("puppeteer");

async function runBot() {

  console.log("🚀 BOT SĂN TIN FACEBOOK ĐANG CHẠY");

  try {

    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
          "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app",
      });
    }

    const db = admin.database();

    // đọc config từ firebase
    const configSnap = await db.ref("hunt_settings").once("value");
    const config = configSnap.val();

    if (!config) {
      console.log("❌ Không tìm thấy config");
      process.exit(0);
    }

    if (!config.groups) {
      console.log("❌ Chưa có group");
      process.exit(0);
    }

    if (!config.keywords) {
      console.log("❌ Chưa có keyword");
      process.exit(0);
    }

    const groups = config.groups
      .split("\n")
      .map(g => g.trim())
      .filter(g => g.length > 0);

    const keywords = config.keywords
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    console.log("📌 GROUP:", groups);
    console.log("🔑 KEYWORDS:", keywords);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    for (let group of groups) {

      try {

        console.log("🔎 ĐANG QUÉT:", group);

        await page.goto(group, { waitUntil: "networkidle2", timeout: 60000 });

        await page.waitForTimeout(7000);

        const posts = await page.evaluate(() => {

          const result = [];

          document.querySelectorAll("div[role='article']").forEach(post => {

            const text = post.innerText;

            const linkTag = post.querySelector("a[href*='/posts/']");

            if (text && linkTag) {

              result.push({
                text: text,
                link: linkTag.href
              });

            }

          });

          return result;

        });

        console.log("📄 TÌM THẤY:", posts.length, "BÀI");

        for (let p of posts) {

          const content = p.text.toLowerCase();

          const match = keywords.some(k => content.includes(k));

          if (match) {

            console.log("✅ TRÙNG KEYWORD");

            await db.ref("xe_san_duoc").push({
              ten_xe: p.text.substring(0, 150),
              link: p.link,
              ngay_quet: new Date().toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh"
              })
            });

          }

        }

      } catch (err) {

        console.log("⚠️ LỖI GROUP:", group);
        console.log(err.message);

      }

    }

    await browser.close();

    console.log("🎉 BOT HOÀN THÀNH");

    process.exit(0);

  } catch (err) {

    console.log("❌ LỖI BOT:", err.message);

    process.exit(1);

  }

}

runBot();
