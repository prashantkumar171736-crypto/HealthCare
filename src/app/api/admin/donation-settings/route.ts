import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "../login/route";

export const runtime = "nodejs";

async function authenticate(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  return await validateSession(sessionToken);
}

export async function GET() {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const settings = await db.collection("settings").findOne({ key: "donation_settings" });

    return NextResponse.json({
      settings: settings || {
        bankName: "",
        accountHolder: "",
        accountNumber: "",
        ifscCode: "",
        upiId: "",
        qrCodeBase64: "",
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bankName, accountHolder, accountNumber, ifscCode, upiId, qrCodeBase64 } = body;

    const db = await getDb();

    await db.collection("settings").updateOne(
      { key: "donation_settings" },
      {
        $set: {
          key: "donation_settings",
          bankName: bankName || "",
          accountHolder: accountHolder || "",
          accountNumber: accountNumber || "",
          ifscCode: ifscCode || "",
          upiId: upiId || "",
          qrCodeBase64: qrCodeBase64 || "",
          updatedAt: new Date(),
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "Donation settings updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
