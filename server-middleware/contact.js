import { Resend } from "resend";
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

      // Get Resend API key and email settings from environment variables
      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom = (process.env.CONTACT_EMAIL_FROM || process.env.CONTACT_EMAIL_USER || "onboarding@resend.dev").trim();
      const emailTo = (process.env.CONTACT_EMAIL_TO || emailFrom).trim();

      // Validate Resend API key is present
      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY environment variable is missing. Please set it in your .env file.");
      }

      // Initialize Resend client
      const resend = new Resend(resendApiKey);

      console.log(`[Contact Form] Using Resend API`);
      console.log(`[Contact Form] From: ${emailFrom}`);
      console.log(`[Contact Form] To: ${emailTo}`);

      // Send email using Resend API
      const emailData = await resend.emails.send({
        from: `"Website Contact Form" <${emailFrom}>`,
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
      });
      
      console.log(`[Contact Form] Email sent successfully via Resend. ID: ${emailData.id || 'N/A'}`);

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));

    } catch (e) {
      console.error("[Contact Form] Error:", e.message);
      console.error("[Contact Form] Stack:", e.stack);
      
      // Provide helpful error messages
      let errorMessage = "Failed to send email. Please try again later.";
      
      if (e.message && e.message.includes("RESEND_API_KEY")) {
        errorMessage = "Email service configuration error. Please contact support.";
        console.error("[Contact Form] Resend API key is missing. Set RESEND_API_KEY in environment variables.");
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
