import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // MATCHING YOUR .ENV.LOCAL EXACTLY
    const gmailUser = process.env.EMAIL_USER;
    const gmailAppPassword = process.env.EMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json({ error: "Configuration error: Credentials not found" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        // Safely strip out any spaces from the password just in case
        pass: gmailAppPassword.replace(/\s+/g, ''),
      },
    });

    const mailOptions = {
      from: `"AERO Security" <${gmailUser}>`,
      to: email,
      subject: `${otp} is your AERO verification code`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 10px;">
          <h2 style="color: #18181b;">AERO Security</h2>
          <p style="color: #52525b; font-size: 14px;">Please use the following 6-digit code to verify your identity and access your workspace.</p>
          <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #10b981;">${otp}</span>
          </div>
          <p style="color: #a1a1aa; font-size: 12px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}