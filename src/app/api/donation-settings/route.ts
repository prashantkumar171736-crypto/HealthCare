import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logServer } from "@/lib/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const settings = await db.collection("settings").findOne({ key: "donation_settings" });

    if (!settings) {
      return NextResponse.json({
        bankName: "",
        accountHolder: "",
        accountNumber: "",
        ifscCode: "",
        upiId: "",
        qrCodeBase64: "",
      });
    }

    return NextResponse.json({
      bankName: settings.bankName || "",
      accountHolder: settings.accountHolder || "",
      accountNumber: settings.accountNumber || "",
      ifscCode: settings.ifscCode || "",
      upiId: settings.upiId || "",
      qrCodeBase64: settings.qrCodeBase64 || "",
    });
  } catch (err: any) {
    console.error("Failed to fetch public donation settings:", err);
    void logServer({ level: "error", message: "Public donation settings request failed", source: "donation-settings", path: "/api/donation-settings", method: "GET", statusCode: 500, error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
