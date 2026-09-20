const { verifyTransaction } = require("./shamcash");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const txId = String(body.txId || "").replace(/\s/g, "");
    if (!/^\d{4,30}$/.test(txId)) {
      return { statusCode: 400, body: JSON.stringify({ verified: false, error: "رقم العملية غير صالح." }) };
    }

    const result = await verifyTransaction(txId);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ verified: result.verified, status: result.verified ? "verified" : "pending", reason: result.reason }),
    };
  } catch (error) {
    console.error("Cham Cash verification failed:", error.message);
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ verified: false, status: "pending", reason: "service_unavailable", error: "تعذر الاتصال بخدمة التحقق حاليًا." }),
    };
  }
};
