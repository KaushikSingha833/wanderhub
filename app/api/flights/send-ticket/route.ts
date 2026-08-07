import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      email, 
      pnr, 
      pdfBase64, 
      passengers, 
      flightNo, 
      origin, 
      destination, 
      departureTime, 
      cabinClass 
    } = body;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const passengerHtml = passengers.map((p: any) => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #18181b; font-weight: 500;">
          ${p.firstName} ${p.lastName}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #10b981; font-weight: bold; text-align: right;">
          ${p.seat}
        </td>
      </tr>
    `).join('');

    const formattedDate = new Date(departureTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const mailOptions = {
      from: `"AERO Concierge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Flight Itinerary & E-Ticket [PNR: ${pnr}]`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3f3f46; line-height: 1.6;">
          
          <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #f4f4f5;">
            <h1 style="color: #18181b; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">AERO</h1>
            <p style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Global Flight Engine</p>
          </div>

          <h2 style="color: #18181b; margin-bottom: 24px; font-size: 20px;">Your Journey is Confirmed.</h2>
          
          <p>Dear Traveler,</p>
          <p>Thank you for booking with AERO. Your upcoming flight from <strong>${origin}</strong> to <strong>${destination}</strong> is fully confirmed. Your official e-ticket is attached to this email as a PDF document.</p>
          
          <div style="background-color: #fafafa; border: 1px solid #e4e4e7; padding: 24px; border-radius: 12px; margin: 32px 0;">
            <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; border-bottom: 1px solid #e4e4e7; padding-bottom: 12px;">Booking Summary</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding-bottom: 12px; color: #71717a; font-size: 14px;">Booking Reference (PNR)</td>
                <td style="padding-bottom: 12px; text-align: right; font-size: 20px; font-weight: 900; color: #18181b;">${pnr}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 12px; color: #71717a; font-size: 14px;">Flight Number</td>
                <td style="padding-bottom: 12px; text-align: right; font-weight: bold; color: #18181b;">${flightNo}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 12px; color: #71717a; font-size: 14px;">Cabin Class</td>
                <td style="padding-bottom: 12px; text-align: right; font-weight: bold; color: #18181b; text-transform: capitalize;">${cabinClass.replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="color: #71717a; font-size: 14px;">Departure</td>
                <td style="text-align: right; font-weight: bold; color: #18181b;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <h3 style="font-size: 16px; color: #18181b; margin-bottom: 16px;">Passenger Manifest</h3>
          <div style="border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; margin-bottom: 32px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead style="background-color: #f4f4f5;">
                <tr>
                  <th style="padding: 12px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #71717a;">Passenger Name</th>
                  <th style="padding: 12px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; text-align: right;">Seat</th>
                </tr>
              </thead>
              <tbody>
                ${passengerHtml}
              </tbody>
            </table>
          </div>

          <p style="font-size: 14px; color: #71717a;">Please review the attached PDF for your complete itinerary, check-in instructions, and baggage allowances. We recommend arriving at the airport at least 2 hours prior to domestic departures and 3 hours for international flights.</p>
          
          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #f4f4f5; font-size: 14px;">
            <p style="margin: 0;">Safe travels,</p>
            <p style="margin: 4px 0 0 0; font-weight: bold; color: #18181b;">The AERO Team</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `AERO_Ticket_${pnr}.pdf`,
          content: pdfBase64.split("base64,")[1],
          encoding: 'base64'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}