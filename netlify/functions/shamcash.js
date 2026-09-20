const API_BASE = "https://shamcash.mahataplus.com/api";

function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function verifyTransaction(txId) {
  const apiKey = process.env.SHAM_CASH_API_KEY;
  if (!apiKey) throw new Error("SHAM_CASH_API_KEY is not configured");

  const expectedAmount = numberValue(process.env.SHAM_CASH_EXPECTED_AMOUNT || "4000");
  const expectedCurrency = String(process.env.SHAM_CASH_CURRENCY || "SYP").trim().toUpperCase();
  if (expectedAmount === null) throw new Error("Invalid expected amount configuration");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(`${API_BASE}/account/history/search`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ tranId: txId }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok || !payload?.ok || !payload?.data) return { verified: false, reason: "not_found" };

  const transaction = payload.data;
  const returnedId = String(transaction.tranId ?? "");
  const amount = numberValue(transaction.amount);
  const currency = String(transaction.currencyName || "").trim().toUpperCase();
  const verified = returnedId === String(txId) && amount === expectedAmount && currency === expectedCurrency;

  return {
    verified,
    reason: verified ? "matched" : "amount_or_currency_mismatch",
    transaction: verified ? {
      tranId: transaction.tranId,
      amount: transaction.amount,
      currencyName: transaction.currencyName,
      tranDate: transaction.tranDate,
      tranTime: transaction.tranTime,
    } : undefined,
  };
}

module.exports = { verifyTransaction };
