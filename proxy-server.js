import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { google } from "googleapis";
import fs from "fs";

const app = express();
app.use(cors());
app.use(bodyParser.json());


// ====== CONFIG ======
const CREDENTIALS_PATH = "oauth-credentials.json"; // download from Google Cloud (Web application OAuth)
const TOKEN_PATH = "token.json";             // will be created automatically
const SPREADSHEET_ID = "1wbvTNmjIxiWXRWIFa3yVYC_i2MMSy1HHV3F9ih_idcQ"; // your sheet ID
const SHEET_NAME = "Form Responses 2";                 // tab name in your spreadsheet
// =====================

// Load client secrets
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const { client_secret, client_id, redirect_uris } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[1] // http://localhost:3000/oauth2callback
);

// Load token if available
if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(token);
} else {
  getAccessToken(oAuth2Client);
}

// Generate auth URL if no token
function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  console.log("Authorize this app by visiting this URL:", authUrl);
}

// Handle OAuth callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code found in query");

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send("✅ Authorization successful! You can close this tab and re-run your request.");
    console.log("Tokens saved to", TOKEN_PATH);
  } catch (err) {
    console.error("Error retrieving access token", err);
    res.status(500).send("Error retrieving access token");
  }
});

// API: Append to Google Sheets
app.post("/submit-google-form", async (req, res) => {
  try {
    const { name, email, company, industry, useCase, timeline, notes } = req.body;
    const sheets = google.sheets({ version: "v4", auth: oAuth2Client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[name, email, company, industry, useCase, timeline, notes]],
      },
    });

    res.json({ success: true, message: "Data written to Google Sheet ✅" });
  } catch (err) {
    console.error("Error writing to Google Sheet:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log("Proxy running on http://localhost:3000"));
