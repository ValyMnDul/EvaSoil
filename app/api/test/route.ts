import { NextResponse } from "next/server";

export const POST = async (req:Request) => {

    const {moisture,temperature,timestamp,device_id} = await req.json();
    console.log(moisture)
    console.log(temperature)
    console.log(timestamp)
    console.log(device_id)

    return NextResponse.json({},{status:200});
}