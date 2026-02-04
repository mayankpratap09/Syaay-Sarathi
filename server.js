const express = require("express");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 8080;

// ---------- FILE PATH ----------
const REMINDERS_FILE = path.join(__dirname, "reminders.json");

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ---------- ENSURE FILE EXISTS ----------
if (!fs.existsSync(REMINDERS_FILE)) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify([]));
}

// ---------- EMAIL SETUP ----------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// ---------- ROUTES ----------

// Serve UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle form submit
app.post("/add-reminder", (req, res) => {
  const { clientName, clientEmail, caseTitle, reminderTime } = req.body;

  if (!clientEmail || !reminderTime) {
    return res.status(400).send("Missing required fields");
  }

  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE));

  reminders.push({
    id: Date.now(),
    clientName,
    clientEmail,
    caseTitle,
    reminderTime,
    sent: false,
  });

  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));

  res.send("Reminder saved successfully");
});

// ---------- CRON JOB (RUNS EVERY MINUTE) ----------
cron.schedule("* * * * *", () => {
  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE));
  const now = new Date();

  reminders.forEach((reminder) => {
    if (!reminder.sent && new Date(reminder.reminderTime) <= now) {
      const mailOptions = {
        from: process.env.EMAIL,
        to: reminder.clientEmail,
        subject: "Case Reminder",
        text: `Hello ${reminder.clientName || "Client"},

This is a reminder for your case:
${reminder.caseTitle || "Scheduled Case"}

Date & Time:
${reminder.reminderTime}

— Nyay-Sarathi`,
      };

      transporter.sendMail(mailOptions, (err) => {
        if (!err) {
          reminder.sent = true;
          fs.writeFileSync(
            REMINDERS_FILE,
            JSON.stringify(reminders, null, 2)
          );
          console.log("Reminder email sent to", reminder.clientEmail);
        } else {
          console.error("Email error:", err.message);
        }
      });
    }
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
