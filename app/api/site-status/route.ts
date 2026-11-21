import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "../../../lib/settings";
import { verifyAdminAuth } from "../../utils/auth";

const KEY = "site-status";

const DEFAULT_STATUS = {
  isUnderConstruction: false,
  partnersVisible: true,
};

// GET endpoint to fetch the current site status
export async function GET() {
  try {
    const stored = await getSetting<Record<string, unknown>>(KEY);
    const siteStatus = {
      ...DEFAULT_STATUS,
      ...(stored ?? {}),
      updatedAt:
        (stored?.updatedAt as string) ?? new Date().toISOString(),
    };
    return NextResponse.json(siteStatus);
  } catch (error) {
    console.error("Error fetching site status:", error);
    return NextResponse.json(
      { error: "Failed to fetch site status" },
      { status: 500 }
    );
  }
}

// POST endpoint to update the site status (admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const { isUnderConstruction, partnersVisible } = await request.json();

    if (typeof isUnderConstruction !== "boolean") {
      return NextResponse.json(
        { error: "isUnderConstruction must be a boolean" },
        { status: 400 }
      );
    }

    const current = await getSetting<Record<string, unknown>>(KEY);
    const updatedStatus = {
      ...DEFAULT_STATUS,
      ...(current ?? {}),
      isUnderConstruction,
      partnersVisible:
        typeof partnersVisible === "boolean"
          ? partnersVisible
          : (current?.partnersVisible as boolean | undefined) ?? true,
      updatedAt: new Date().toISOString(),
    };

    await setSetting(KEY, updatedStatus);

    return NextResponse.json(updatedStatus);
  } catch (error) {
    console.error("Error updating site status:", error);
    return NextResponse.json(
      { error: "Failed to update site status" },
      { status: 500 }
    );
  }
}
