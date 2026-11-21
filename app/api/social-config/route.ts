import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "../../../lib/settings";
import { verifyAdminAuth } from "../../utils/auth";

const KEY = "social-config";

const DEFAULT_CONFIG = {
  instagram: "",
  facebook: "",
  spotify: "",
  youtube: "",
  tiktok: "",
  appleMusic: "",
  soundcloud: "",
};

// GET endpoint
export async function GET() {
  try {
    const config = (await getSetting<Record<string, string>>(KEY)) ?? DEFAULT_CONFIG;
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching social config:", error);
    return NextResponse.json(
      { error: "Failed to fetch social config" },
      { status: 500 }
    );
  }
}

// POST endpoint
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const config = await request.json();

    await setSetting(KEY, config);

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Error saving social config:", error);
    return NextResponse.json(
      { error: "Failed to save social config" },
      { status: 500 }
    );
  }
}
