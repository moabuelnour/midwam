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

      // Validate credentials are present
      if (!emailUser || !emailPass) {
        throw new Error("Email credentials are missing. Please set CONTACT_EMAIL_USER and CONTACT_EMAIL_PASS environment variables.");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass.trim()
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify transporter configuration
      try {
        await transporter.verify();
      } catch (verifyError) {
        console.error("[Contact Form] Transporter verification failed:", verifyError.message);
        // Don't throw here, let it try to send anyway
      }

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
      
      // Provide more helpful error messages for authentication issues
      let errorMessage = "Failed to send email. Please try again later.";
      if (e.message && e.message.includes("authentication")) {
        // errorMessage = "Email authentication failed. Please check email credentials in environment variables.";
        errorMessage = "Failed to send email. Please try again later.";
        console.error("[Contact Form] Authentication error - check CONTACT_EMAIL_USER and CONTACT_EMAIL_PASS");
      } else if (process.env.NODE_ENV === "development") {
        errorMessage = e.message;
      }
      
      res.statusCode = 500;
      res.end(JSON.stringify({ 
        success: false, 
        error: errorMessage
      }));
    }
  });
};
