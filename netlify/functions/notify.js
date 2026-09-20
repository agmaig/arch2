// netlify/functions/notify.js
// يُستدعى تلقائيًا من Netlify عبر "Outgoing Webhook" عند وصول كل تسجيل جديد.
// يرسل بريدين منسّقين: واحد إلى إدارة المنصة وآخر تأكيد للمشارك، عبر Resend.

const LBL = {
  fullName: "الاسم الكامل",
  phone: "الهاتف / واتساب",
  email: "البريد الإلكتروني",
  university: "الجامعة / الجهة التعليمية",
  major: "التخصص",
  majorOther: "التخصص (أخرى)",
  status: "الوضع الحالي",
  statusOther: "الوضع الحالي (أخرى)",
  year: "السنة الدراسية / سنة التخرج",
  level: "مستوى الخبرة",
  siteExp: "خبرة ميدانية سابقة",
  goals: "أهداف المشاركة",
  goalsOther: "أهداف أخرى",
  difficulty: "أكبر صعوبة حالية",
  difficultyOther: "صعوبة أخرى",
  commit: "الالتزام بالحضور",
  paidAck: "الاطلاع على شرط الدفع",
  payMethod: "طريقة الدفع",
  txId: "رقم عملية التحويل (شام كاش)",
  paymentVerification: "حالة التحقق الآلي",
  consent: "الموافقة على استخدام البيانات",
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "archimania.platform@gmail.com";
const EMAIL_FROM = process.env.EMAIL_FROM || "Archimania Platform <onboarding@resend.dev>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const { verifyTransaction } = require("./shamcash");

const esc = (s) =>
  String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

function rowsHtml(data) {
  return Object.entries(LBL)
    .filter(([key]) => data[key])
    .map(
      ([key, label]) =>
        `<tr><td style="padding:8px 12px;background:#F5F0E8;color:#102B4C;font-weight:bold;border:1px solid #e3ddd2">${label}</td><td style="padding:8px 12px;border:1px solid #e3ddd2">${esc(data[key])}</td></tr>`
    )
    .join("");
}

async function sendEmail(payload) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY غير مضبوط — تم تخطي إرسال البريد.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, ...payload }),
  });
  if (!res.ok) {
    console.error("فشل إرسال البريد:", res.status, await res.text());
  }
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const data = (body.payload && body.payload.data) || body.data || {};
    if (data["form-name"] && data["form-name"] !== "registration") {
      return { statusCode: 200, body: "skip" };
    }
    if (data.website) {
      // مصيدة السبام — لا نرسل شيئًا
      return { statusCode: 200, body: "spam" };
    }

    const fullName = data.fullName || "مشارك";
    const email = data.email || "";
    const receiptUrl = data.receipt || "";
    let paymentStatus = "لم يتم التحقق";
    if (data.txId) {
      try {
        const result = await verifyTransaction(String(data.txId).replace(/\s/g, ""));
        paymentStatus = result.verified ? "تم التحقق تلقائيًا" : "عملية معلقة — لم يتم العثور عليها أو المبلغ غير مطابق، تحتاج مراجعة الإدارة";
      } catch (error) {
        console.error("Cham Cash verification in notification failed:", error.message);
        paymentStatus = "عملية معلقة — تعذر التحقق تلقائيًا، تحتاج مراجعة الإدارة";
      }
    }
    data.paymentVerification = paymentStatus;

    // بريد الإدارة
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `${paymentStatus.startsWith("تم التحقق") ? "دفعة متحققة" : "عملية دفع معلقة"} – ${fullName}`,
      html: `
        <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;color:#17233A;max-width:640px;margin:auto">
          <div style="background:#102B4C;padding:20px 24px;border-radius:10px 10px 0 0">
            <h2 style="color:#fff;margin:0;font-size:20px">تسجيل جديد — من الرسم إلى الكوست</h2>
            <div style="color:#C9AA78;font-size:12px;letter-spacing:2px;margin-top:6px">ARCHIMANIA PLATFORM</div>
          </div>
          <div style="border:1px solid #e3ddd2;border-top:0;padding:20px 24px;border-radius:0 0 10px 10px">
              <p style="background:#F5F0E8;border-right:3px solid #006C69;padding:12px 16px;border-radius:0 8px 8px 0;font-weight:bold">حالة الدفع: ${esc(paymentStatus)}</p>
              <table style="border-collapse:collapse;width:100%;font-size:14.5px">${rowsHtml(data)}</table>
            ${
              receiptUrl
                ? `<p style="margin-top:16px"><a href="${receiptUrl}" style="color:#006C69;font-weight:bold">عرض إيصال الدفع المرفق</a></p>`
                : `<p style="margin-top:16px;color:#8a6d33">لم يُرفق إيصال دفع — بانتظار رقم العملية للمراجعة.</p>`
            }
          </div>
        </div>`,
    });

    // بريد تأكيد المشارك
    if (email) {
      await sendEmail({
        to: email,
        subject: "تم استلام طلب تسجيلك في ورشة Archimania",
        html: `
          <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;color:#17233A;max-width:640px;margin:auto">
            <div style="background:#102B4C;padding:20px 24px;border-radius:10px 10px 0 0">
              <h2 style="color:#fff;margin:0;font-size:20px">تم استلام طلب التسجيل بنجاح</h2>
              <div style="color:#C9AA78;font-size:12px;letter-spacing:2px;margin-top:6px">LEARN • INSPIRE • PRACTICE • CREATE</div>
            </div>
            <div style="border:1px solid #e3ddd2;border-top:0;padding:20px 24px;border-radius:0 0 10px 10px">
              <p>مرحبًا ${esc(fullName)}،</p>
              <p>وصلنا طلب تسجيلك في ورشة «من الرسم إلى الكوست». سيتم التواصل معك عبر واتساب أو البريد الإلكتروني لمراجعة الدفع وتأكيد الحجز، وإرسال تفاصيل مكان الورشة والزيارة الميدانية.</p>
              <p style="background:#F5F0E8;border-right:3px solid #C9AA78;padding:12px 16px;border-radius:0 8px 8px 0">لا يُعد التسجيل مؤكدًا إلا بعد مراجعة الدفع من الإدارة. يرجى الاحتفاظ بإشعار التحويل.</p>
              <p style="color:#006C69;font-weight:bold;margin-top:20px">Archimania Platform</p>
            </div>
          </div>`,
      });
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "error" };
  }
};
