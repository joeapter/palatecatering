import { NextResponse } from "next/server";
import { getShabbosCatalog } from "@/lib/storefront/catalog";
export async function GET() { return NextResponse.json({ categories: await getShabbosCatalog() }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }); }
