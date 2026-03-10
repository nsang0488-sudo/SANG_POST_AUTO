const admin = require("firebase-admin");
const puppeteer = require("puppeteer");

async function runBot() {

  console.log("🚀 BOT SĂN TIN FACEBOOK ĐANG CHẠY");

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        "https://sang-post-auto-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
  }

  const db = admin.database();

  // đọc config từ web
  const configSnap = await db.ref("config/hunt_settings").once("value");
  const config = configSnap.val();

  if (!config) {
    console.log("❌ Không có config");
    return;
  }

  const groups = config.groups.split("\n");
  const keywords = config.keywords
    .split(",")
    .map((k) => k.trim().toLowerCase());

  console.log("GROUP:", groups);
  console.log("KEYWORD:", keywords);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

  for (let group of groups) {

    console.log("🔎 ĐANG QUÉT:", group);

    await page.goto(group, { waitUntil: "networkidle2" });

    await page.waitForTimeout(6000);

    const posts = await page.evaluate(() => {

      const result = [];

      document.querySelectorAll("div[role='article']").forEach((post) => {

        const text = post.innerText;

        const link = post.querySelector("a[href*='/posts/']");

        if (text && link) {

          result.push({
            text: text,
            link: link.href
          });

        }

      });

      return result;

    });

    console.log("TÌM THẤY:", posts.length);

    for (let p of posts) {

      const content = p.text.toLowerCase();

      const match = keywords.some((k) => content.includes(k));

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

  }

  await browser.close();

  console.log("🎉 HOÀN THÀNH");

}

runBot();
