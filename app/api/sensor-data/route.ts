import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SensorData, ApiResponse } from "@/types/sensor";

export async function POST(request: NextRequest) {
  try {
    const data: SensorData = await request.json();

    if (
      typeof data.moisture !== "number" ||
      typeof data.temperature !== "number" ||
      !data.device_id ||
      typeof data.timestamp !== "number"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Date incomplete sau invalide",
        },
        { status: 400 }
      );
    }

    if (data.moisture < 0 || data.moisture > 100) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Umiditate trebuie să fie între 0-100%",
        },
        { status: 400 }
      );
    }

    if (data.temperature < -50 || data.temperature > 100) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Temperatură invalidă (range: -50 la 100°C)",
        },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await supabase
      .from("sensor_readings")
      .insert([
        {
          device_id: data.device_id,
          moisture: data.moisture,
          temperature: data.temperature,
          timestamp: data.timestamp,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Date salvate cu succes!",
      data: inserted,
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Eroare internă a serverului",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const deviceId = searchParams.get("device_id");

    let query = supabase
      .from("sensor_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: data,
      message: `${data.length} citiri găsite`,
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Eroare la citirea datelor",
      },
      { status: 500 }
    );
  }
}