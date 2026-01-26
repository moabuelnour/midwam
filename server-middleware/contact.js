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
      const emailPassRaw = process.env.CONTACT_EMAIL_PASS || "zqickmgtugxhrzxo";
      const emailPass = emailPassRaw.trim();
      const emailTo = (process.env.CONTACT_EMAIL_TO || emailUser).trim();
      const emailHost = (process.env.CONTACT_EMAIL_HOST || "smtp.zoho.com").trim();
      const emailPort = parseInt(process.env.CONTACT_EMAIL_PORT || 587, 10);
      
      // Debug: Check raw password before processing
      console.log(`[Contact Form] Raw password from env: length=${emailPassRaw.length}, hasWhitespace=${/\s/.test(emailPassRaw)}`);
      console.log(`[Contact Form] Trimmed password: length=${emailPass.length}`);
      console.log(`[Contact Form] Password first 3 chars: ${emailPass.substring(0, 3)}***`);
      console.log(`[Contact Form] Password last 3 chars: ***${emailPass.substring(emailPass.length - 3)}`);
      console.log(`[Contact Form] Password contains non-printable: ${/[^\x20-\x7E]/.test(emailPass)}`);

      // Debug: Log credential status (without exposing password)
      // console.log("[Contact Form] Email config check:");
      // console.log("[Contact Form] CONTACT_EMAIL_USER:", process.env.CONTACT_EMAIL_USER ? "SET" : "NOT SET (using default)");
      // console.log("[Contact Form] CONTACT_EMAIL_PASS:", process.env.CONTACT_EMAIL_PASS ? "SET" : "NOT SET (using default)");
      // console.log("[Contact Form] CONTACT_EMAIL_TO:", process.env.CONTACT_EMAIL_TO ? "SET" : "NOT SET (using default)");
      // console.log("[Contact Form] Using email user:", emailUser);
      // console.log("[Contact Form] Password length:", emailPass ? emailPass.length : 0);
      // console.log("[Contact Form] Sending to:", emailTo);
      // Zoho App Passwords are 12 characters (displayed with spaces like "RGRW EAps v6qL", but stored without)
      // Remove any spaces from the password
      const cleanedPass = emailPass.replace(/\s+/g, '');
      const passLength = cleanedPass.length;
      
      // Validate credentials are present
      if (!emailUser || !cleanedPass) {
        throw new Error("Email credentials are missing. Please set CONTACT_EMAIL_USER and CONTACT_EMAIL_PASS environment variables.");
      }
      
      if (passLength !== 12) {
        console.warn(`[Contact Form] WARNING: Password length is ${passLength} characters after removing spaces. Zoho App Passwords are 12 characters.`);
        console.warn(`[Contact Form] If you're using a regular password, it won't work. Generate an App Password at: https://accounts.zoho.com/home#security/app-passwords`);
      } else {
        console.log(`[Contact Form] Password length is correct (12 characters) for Zoho App Password`);
      }

      // Log that we're using environment variables (without exposing sensitive data)
      const usingEnvVars = !!(process.env.CONTACT_EMAIL_USER && process.env.CONTACT_EMAIL_PASS);
      console.log(`[Contact Form] Using ${usingEnvVars ? 'environment variables' : 'default credentials'} for email: ${emailUser.substring(0, 3)}***`);

      // Zoho SMTP configuration
      // Port 465 uses SSL (secure: true)
      // Port 587 uses STARTTLS (secure: false, requireTLS: true)
      // Ensure port is a number for comparison
      const portNum = parseInt(emailPort, 10);
      const isSecurePort = portNum === 465;
      
      // Normalize credentials - remove any hidden characters
      const normalizedUser = emailUser.trim().replace(/[\r\n\t]/g, '');
      // For password, remove line breaks and ensure it's clean (spaces already removed above)
      const normalizedPass = cleanedPass.replace(/[\r\n\t]/g, '').trim();
      
      // Additional debugging - check what we're actually sending
      console.log(`[Contact Form] After normalization - User length: ${normalizedUser.length}, Pass length: ${normalizedPass.length}`);
      console.log(`[Contact Form] User email format: ${normalizedUser.includes('@') ? 'Valid (contains @)' : 'INVALID (no @)'}`);
      console.log(`[Contact Form] User domain: ${normalizedUser.split('@')[1] || 'NONE'}`);
      console.log(`[Contact Form] Password is alphanumeric only: ${/^[a-zA-Z0-9]+$/.test(normalizedPass)}`);
      
      // Try different authentication methods - Zoho sometimes requires specific format
      const transporter = nodemailer.createTransport({
        host: emailHost,
        port: portNum, // Use numeric port
        secure: isSecurePort, // true for 465 (SSL), false for 587 (STARTTLS)
        auth: {
          user: normalizedUser,  // Full email address for Zoho (e.g., it@domain.com)
          pass: normalizedPass   // Zoho App Password (12 chars, no spaces)
        },
        authMethod: 'PLAIN', // Explicitly use PLAIN auth method
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        },
        // For port 587 (STARTTLS)
        ...(isSecurePort ? {} : { requireTLS: true }),
        // Connection timeout
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000
      });
      
      // Log configuration for debugging (without exposing password)
      console.log(`[Contact Form] SMTP Config: ${emailHost}:${portNum}, secure: ${isSecurePort} (${isSecurePort ? 'SSL' : 'STARTTLS'}), authMethod: PLAIN`);
      console.log(`[Contact Form] Email user: ${normalizedUser.substring(0, 3)}***@${normalizedUser.split('@')[1] || 'unknown'}`);
      console.log(`[Contact Form] Password length: ${normalizedPass.length} chars`);
      console.log(`[Contact Form] Password is exactly 12 chars: ${normalizedPass.length === 12}`);

      // Verify transporter configuration
      try {
        console.log("[Contact Form] Attempting SMTP connection verification...");
        await transporter.verify();
        console.log("[Contact Form] SMTP connection verified successfully");
      } catch (verifyError) {
        console.error("[Contact Form] Transporter verification failed:", verifyError.message);
        console.error("[Contact Form] Error code:", verifyError.code);
        console.error("[Contact Form] Full error:", JSON.stringify(verifyError, null, 2));
        
        // If it's an authentication error, provide specific guidance
        if (verifyError.message && verifyError.message.includes("535")) {
          console.error("[Contact Form] ===== AUTHENTICATION TROUBLESHOOTING =====");
          console.error("[Contact Form] 1. Verify you're using a Zoho App Password (12 chars), not regular password");
          console.error("[Contact Form] 2. Check if Zoho account has IP restrictions - Contabo IP might be blocked");
          console.error("[Contact Form] 3. Verify email format: must be full address (user@domain.com)");
          console.error("[Contact Form] 4. Check Zoho account security settings for SMTP access");
          console.error("[Contact Form] 5. Try generating a new App Password");
          console.error("[Contact Form] 6. Verify password has no spaces or special characters (should be 12 alphanumeric chars)");
          console.error("[Contact Form] 7. Check Zoho account type - some accounts may have SMTP disabled");
          console.error("[Contact Form] 8. Try port 465 instead of 587 (set CONTACT_EMAIL_PORT=465)");
          console.error("[Contact Form] ===========================================");
        }
        
        // Throw the error so it's caught by the outer catch block
        throw verifyError;
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
