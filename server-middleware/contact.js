import nodemailer from "nodemailer";

export default async (req, res) => {
  // Set CORS headers
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: "Method Not Allowed" }));
    return;
  }

  let body = "";
  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      // Validate required fields
      if (!data.email) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: "Email is required" }));
        return;
      }

      // Build name dynamically (homepage or contact page)
      const fullName =
        data.name ||
        `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
        "Not provided";

      // Build phone dynamically
      const phone = data.phone || "Not provided";

      // Get email credentials from environment variables or use defaults
      const emailUser = process.env.CONTACT_EMAIL_USER || "trivedibhavya1997@gmail.com";
      const emailPass = process.env.CONTACT_EMAIL_PASS || "zqickmgtugxhrzxo";
      const emailTo = process.env.CONTACT_EMAIL_TO || emailUser;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass.trim()
        },
      });

      // Verify transporter configuration
      await transporter.verify();

      const mailOptions = {
        from: `"Website Contact Form" <${emailUser}>`,
        to: emailTo,
        subject: "New Contact Form Submission",
        html: `
          <h2>New Message</h2>

          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${phone}</p>

          <p><strong>Message:</strong></p>
          <p>${(data.message || "No message provided").replace(/\n/g, "<br>")}</p>

          <br><hr>
          <p style="font-size:12px;opacity:0.6;">
             This email was generated automatically from your website contact form.
          </p>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      
      // Minimal logging for debugging
      if (!info.messageId) {
        console.error("[Contact Form] Email sent but no message ID returned");
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));

    } catch (e) {
      console.error("[Contact Form] Error:", e.message);
      console.error("[Contact Form] Stack:", e.stack);
      
      res.statusCode = 500;
      res.end(JSON.stringify({ 
        success: false, 
        error: process.env.NODE_ENV === "development" ? e.message : "Failed to send email. Please try again later." 
      }));
    }
  });
};
