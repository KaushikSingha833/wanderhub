import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    // 1. Receive the PDF data and passenger info from the frontend
    const { email, pnr, pdfBase64, passengerName, flightNo } = await req.json();

    // 2. Configure the Email Engine
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // 3. Draft the HTML Email & Attach the PDF
    const mailOptions = {
      from: `"WanderHub Bookings" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✈️ Your WanderHub E-Ticket - PNR: ${pnr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Booking Confirmed!</h2>
          <p>Hi <strong>${passengerName}</strong>,</p>
          <p>Your flight <strong>${flightNo}</strong> is successfully booked and your seat is secured.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Airline Locator (PNR)</p>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">${pnr}</p>
          </div>
          <p>Please find your official E-Ticket attached as a PDF to this email. You will need to show this at the airport.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">Safe travels,<br/>The WanderHub Team</p>
        </div>
      `,
      attachments: [
        {
          filename: `WanderHub_Ticket_${pnr}.pdf`,
          // We strip the data URI prefix so nodemailer can attach it as a clean PDF
          content: pdfBase64.split("base64,")[1], 
          encoding: "base64",
        },
      ],
    };

    // 4. Send the Email
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Email Error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}