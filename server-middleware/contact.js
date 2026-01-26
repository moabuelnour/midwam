import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables explicitly for server middleware
dotenv.config();
import { readFileSync } from "fs";
import { resolve } from "path";

// Explicitly load .env file for server middleware context
// This ensures environment variables are available at runtime, especially with PM2
function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envFile = readFileSync(envPath, "utf8");
    // Handle both Unix and Windows line endings
    const envLines = envFile.split(/\r?\n/);
    
    envLines.forEach((line) => {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return;
      }
      
      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Only set if not already in process.env (env vars take precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    
    console.log("[Contact Form] .env file loaded successfully");
  } catch (error) {
    // .env file might not exist or be readable, that's okay
    // Environment variables might be set via PM2 or system
    console.warn("[Contact Form] Could not load .env file:", error.message);
    console.warn("[Contact Form] Make sure .env file exists in:", resolve(process.cwd(), ".env"));
  }
}

// Load environment variables
loadEnvFile();

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
      const emailUser = (process.env.CONTACT_EMAIL_USER || "trivedibhavya1997@gmail.com").trim();
      const emailPass = (process.env.CONTACT_EMAIL_PASS || "zqickmgtugxhrzxo").trim();
      const emailTo = (process.env.CONTACT_EMAIL_TO || emailUser).trim();
      const emailHost = (process.env.CONTACT_EMAIL_HOST || "smtp.zoho.com").trim();
      const emailPort = (process.env.CONTACT_EMAIL_PORT || 587);

      // Debug: Log credential status (without exposing password)
      // console.log("[Contact Form] Email config check:");
      // console.log("[Contact Form] CONTACT_EMAIL_USER:", process.env.CONTACT_EMAIL_USER ? "SET" : "NOT SET (using default)");
      // console.log("[Contact Form] CONTACT_EMAIL_PASS:", process.env.CONTACT_EMAIL_PASS ? "SET" : "NOT SET (using default)");
      // console.log("[Contact Form] CONTACT_EMAIL_TO:", process.env.CONTACT_EMAIL_TO ? "SET" : "NOT SET (using default)");
      // console.log("[Contact Form] Using email user:", emailUser);
      // console.log("[Contact Form] Password length:", emailPass ? emailPass.length : 0);
      // console.log("[Contact Form] Sending to:", emailTo);
      // Validate credentials are present
      if (!emailUser || !emailPass) {
        throw new Error("Email credentials are missing. Please set CONTACT_EMAIL_USER and CONTACT_EMAIL_PASS environment variables.");
      }

      // Log that we're using environment variables (without exposing sensitive data)
      const usingEnvVars = !!(process.env.CONTACT_EMAIL_USER && process.env.CONTACT_EMAIL_PASS);
      console.log(`[Contact Form] Using ${usingEnvVars ? 'environment variables' : 'default credentials'} for email: ${emailUser.substring(0, 3)}***`);

      // Zoho SMTP configuration
      // Port 465 uses SSL (secure: true)
      // Port 587 uses STARTTLS (secure: false, requireTLS: true)
      const isSecurePort = emailPort === 465;
      
      const transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: isSecurePort, // true for 465, false for other ports
        auth: {
          user: emailUser,  // Full email address for Zoho (e.g., it@domain.com)
          pass: emailPass   // Zoho App Password (NOT regular password - must be generated in Zoho settings)
        },
        tls: {
          rejectUnauthorized: false
        },
        // For port 587 (STARTTLS)
        ...(isSecurePort ? {} : { requireTLS: true })
      });
      
      // Log configuration for debugging
      console.log(`[Contact Form] SMTP Config: ${emailHost}:${emailPort}, secure: ${isSecurePort}, user: ${emailUser.substring(0, 3)}***`);

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
      const isAuthError = e.message && (
        e.message.includes("authentication") || 
        e.message.includes("Invalid login") ||
        e.message.includes("535")
      );
      
      if (isAuthError) {
        errorMessage = "Failed to send email. Please try again later.";
        console.error("[Contact Form] Authentication error detected");
        console.error("[Contact Form] Check that CONTACT_EMAIL_USER and CONTACT_EMAIL_PASS are set correctly in production");
        console.error("[Contact Form] Email user:", process.env.CONTACT_EMAIL_USER ? `${process.env.CONTACT_EMAIL_USER.substring(0, 3)}***` : "NOT SET");
        console.error("[Contact Form] Email pass:", process.env.CONTACT_EMAIL_PASS ? "SET (length: " + process.env.CONTACT_EMAIL_PASS.length + ")" : "NOT SET");
        console.error("[Contact Form] Using .env file:", process.env.CONTACT_EMAIL_USER ? "No (using process.env)" : "Yes (or defaults)");
        console.error("[Contact Form] IMPORTANT: For Zoho, you MUST use an App Password, not your regular password!");
        console.error("[Contact Form] Generate App Password at: https://accounts.zoho.com/home#security/app-passwords");
        console.error("[Contact Form] Also verify: email must be full address (e.g., it@domain.com), not just username");
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
