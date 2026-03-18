import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";
import nodemailer from "nodemailer";

import Contact_Schema from "./Schema/contactSchema.js";
import SpeakerSchema from "./Schema/speakerSchema.js";
import Deadline_Schema from "./Schema/deadlineSchema.js";
import SessionSchema from "./Schema/sessionSchema.js";
import Registration_Fee_Schema from "./Schema/RegistrationFeeSchema.js";
import Essential_Schema from "./Schema/essentialSchema.js";
import Submission from "./Schema/SubmissionSchema.js";
import Registration from "./Schema/registrationSchema.js";
import Member from "./Schema/CommitteeSchema.js";
import Download from "./Schema/Download.js";
import Sponsor from "./Schema/Sponsor.js";
import Coupon from "./Schema/CouponSchema.js";

dotenv.config();
const upload = multer();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://backend.confworld.org",
  "https://icsteet.com",
  "http://icsteet.com" // Add HTTP version too
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin); // Debug log
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // For legacy browser support
}));

// Add explicit OPTIONS handler for preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.header('Access-Control-Allow-Credentials', true);
  res.sendStatus(200);
});

app.use(express.json());

mongoose
  .connect(process.env.mongodb_url)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

app.post("/Registration", async (req, res) => {
  try {
    const { Total, selectedFee, pricingData } = req.body;
    const Amount = (Total * 100).toFixed();
 
    const order = await instance.orders.create({
      amount: Amount,
      currency: "USD",
      payment_capture: 1,
    });
 
    // Increment coupon usage if a coupon was used
    if (pricingData?.couponCode) {
      await Coupon.findOneAndUpdate(
        { code: pricingData.couponCode.toUpperCase() },
        { $inc: { usedCount: 1 } }
      );
    }
 
    const registration = new Registration({
      ...req.body,
      status: order.status,
      order_id: order.id,
 
      // Base registration fee (before journal/addons)
      baseAmount: pricingData?.baseAmount || selectedFee.amount,
 
      // ── NEW: Journal & Addons ──────────────────────────────────
      journalSupport: pricingData?.journalSupport || null,
      journalAmount: pricingData?.journalAmount || 0,
      addons: pricingData?.addons || [],
      addonsAmount: pricingData?.addonsAmount || 0,
 
      // Discounts & membership
      finalAmount: pricingData?.finalAmount || Total,
      hasMembership: pricingData?.hasMembership || false,
      membershipFee: pricingData?.membershipFee || 0,
      couponCode: pricingData?.couponCode || null,
      couponDiscount: pricingData?.couponDiscount || 0,
      membershipDiscount: pricingData?.membershipDiscount || 0,
    });
 
    await registration.save();
 
    // ── Build the admin email HTML ─────────────────────────────
    const journalRow = pricingData?.journalSupport
      ? `
        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>
        <h3 style="color: #6a5acd; font-size: 22px;">Journal Publication Support</h3>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
          <span style="font-weight: bold;">Tier:</span> ${pricingData.journalSupport.tier}
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
          <span style="font-weight: bold;">Package:</span> ${pricingData.journalSupport.package}
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
          <span style="font-weight: bold;">Amount:</span> $${pricingData.journalSupport.amount}
        </p>
      `
      : "";
 
    const addonsRows =
      pricingData?.addons?.length > 0
        ? `
        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>
        <h3 style="color: #6a5acd; font-size: 22px;">Add-ons</h3>
        ${pricingData.addons
          .map(
            (a) =>
              `<p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 6px;">
                 • ${a.label}${a.sublabel ? ` (${a.sublabel})` : ""}: <strong>$${a.amount}</strong>
               </p>`
          )
          .join("")}
        <p style="color: #333; font-size: 16px; margin-top: 8px;">
          <span style="font-weight: bold;">Add-ons Total:</span> $${pricingData.addonsAmount}
        </p>
      `
        : "";
 
    const HtmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; margin: 0; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 600px; margin: auto; border-top: 5px solid #6a5acd;">
        <h2 style="color: #6a5acd; font-size: 26px; margin-bottom: 15px;">New Registration from ICSTEET-2026</h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Title:</span> ${registration.Title}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Full Name:</span> ${registration.First_Name} ${registration.Last_Name}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Payment Status:</span> ${order.status}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Certificate Name:</span> ${registration.Certificate_Name}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Nationality:</span> ${registration.Nationality}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Department:</span> ${registration.Department}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Institution:</span> ${registration.Institution}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Email:</span> <a href="mailto:${registration.Email}" style="color: #6a5acd;">${registration.Email}</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Participant Category:</span> ${registration.Participant_Category}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Presentation Category:</span> ${registration.Presentation_Category}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Presentation Type:</span> ${registration.Presentation_Type}</p>
 
        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>
        <h3 style="color: #6a5acd; font-size: 22px;">Selected Fee Details</h3>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Fee Category:</span> ${registration.selectedFee.category}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Fee Type:</span> ${registration.selectedFee.type}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Base Amount:</span> $${registration.selectedFee.amount}</p>
 
        ${journalRow}
        ${addonsRows}
 
        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>
        <h3 style="color: #6a5acd; font-size: 22px;">Pricing Summary</h3>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Membership:</span> ${registration.hasMembership ? `Yes (+$${registration.membershipFee})` : "No"}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Coupon:</span> ${registration.couponCode ? `${registration.couponCode} (-$${registration.couponDiscount})` : "None"}</p>
        <p style="color: #333333; font-size: 18px; font-weight: bold; line-height: 1.6; margin-bottom: 10px;">Total Charged: $${Total}</p>
 
        <a href="mailto:${registration.Email}" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #6a5acd; color: #ffffff; border-radius: 5px; text-decoration: none;">Reply to Participant</a>
    </div>
</body>
</html>
`;
 
    res.status(201).send({
      message: "Registration data saved successfully",
      order_id: order.id,
      amount: order.amount,
    });
 
    sendEmailToAdmin("New Registration from ICSTEET-2026", HtmlTemplate);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error saving registration data",
      error: error.message,
    });
  }
});

app.post("/verify-payment", async (req, res) => {
  const { payment_id, order_id, signature } = req.body;
  try {
    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET);
    sha.update(`${order_id}|${payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== signature) {
      return res.status(400).json({ msg: "Transaction is not legit!" });
    }

    const registrationDetails = await instance.payments.fetch(payment_id);

    const registrationData = await Registration.findOne({ order_id: order_id });
    if (registrationData) {
      registrationData.status = "Payment Success";
      registrationData.Razorpay_Payment_Details = registrationDetails;
      await registrationData.save();
      return res.status(200).json({
        msg: "Payment validated and registration updated successfully!",
      });
    } else {
      registrationData.status = "Payment Failed";
      return res.status(404).json({ msg: "Registration not found." });
    }
  } catch (error) {
    const registrationData = await Registration.findOne({ order_id: order_id });
    registrationData.status = "Payment Failed";
    console.error("Error during payment validation:", error);
    return res
      .status(500)
      .json({ msg: "Internal Server Error", error: error.message });
  }
});

app.post("/payment/cancellation", async (req, res) => {
  const { order_id } = req.body;
  try {
    const registrationData = await Registration.findOne({ order_id });
    if (registrationData) {
      registrationData.status = "Payment Cancelled";
      await registrationData.save();
      return res.status(200).json({ msg: "Payment Cancelled" });
    } else {
      return res.status(404).json({ msg: "Registration not found." });
    }
  } catch (error) {
    console.error("Error updating payment cancellation:", error);
    return res
      .status(500)
      .json({ msg: "Internal Server Error", error: error.message });
  }
});

app.post("/Contact", async (req, res) => {
  try {
    const contact = new Contact_Schema(req.body);
    await contact.save();
    const HtmlTemplate = ` 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; margin: 0; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 600px; margin: auto; border-top: 5px solid #6a5acd;">
        <h2 style="color: #6a5acd; font-size: 26px; margin-bottom: 15px;">New Contact Message from ICSTEET-2026</h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Full Name:</span> ${contact.Full_Name}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Email:</span> <a href="mailto:${contact.Email}" style="color: #6a5acd; text-decoration: none;">${contact.Email}</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Phone Number:</span> ${contact.Mobile_Number}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Message:</span> ${contact.Message}</p>

        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>

        <a href="mailto:${contact.Email}" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #6a5acd; color: #ffffff; border-radius: 5px; text-decoration: none; transition: background-color 0.3s ease;">Reply to Message</a>
    </div>
</body>
</html>
`;
    res.status(201).send({ message: "Contact data received successfully!" });
    sendEmailToAdmin("New Contact Message From ICSTEET-2026", HtmlTemplate);
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/Download", async (req, res) => {
  try {
    const Download_Form = new Download(req.body);
    await Download_Form.save();
    const HtmlTemplate = ` 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; margin: 0; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 600px; margin: auto; border-top: 5px solid #6a5acd;">
        <h2 style="color: #6a5acd; font-size: 26px; margin-bottom: 15px;">New Download from ICSTEET-2026</h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Name:</span> ${
          Download_Form.Name
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Email:</span> <a href="mailto:${
          Download_Form.Email
        }" style="color: #6a5acd; text-decoration: none;">${
      Download_Form.Email
    }</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Phone Number:</span> ${
          Download_Form.Number
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Link:</span> ${
          Download_Form.Link ? Download_Form.Link : "No link provided"
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Additional Information:</span> ${
          Download_Form.Info
            ? Download_Form.Info
            : "No additional information provided"
        }</p>

        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>

        <a href="mailto:${
          Download_Form.Email
        }" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #6a5acd; color: #ffffff; border-radius: 5px; text-decoration: none; transition: background-color 0.3s ease;">Reply to Request</a>
    </div>
</body>
</html>
`;
    res.status(201).send({ message: "Brochure Downloaded successfully!" });
    sendEmailToAdmin("New Download From ICSTEET-2026", HtmlTemplate);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

const GenerateRandom = async () => {
  let Submission_ID;
  let exists = true;

  while (exists) {
    const random = Math.floor(Math.random() * 999) + 1;
    Submission_ID = `ICSTEET_2026_PH_${random}`;
    const existingSubmission = await Submission.findOne({ Submission_ID });
    if (!existingSubmission) {
      exists = false;
    }
  }
  return Submission_ID;
};

app.post("/Submission_Form_Data", upload.single("File"), async (req, res) => {
  try {
    const Submission_ID = await GenerateRandom();
    const SubmissionData = new Submission({
      ...req.body,
      File: req.file,
      Submission_ID,
    });
    await SubmissionData.save();
    const HtmlTemplate = ` 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; margin: 0; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 600px; margin: auto; border-top: 5px solid #6a5acd;">
        <h2 style="color: #6a5acd; font-size: 26px; margin-bottom: 15px;">New Paper Submission from ICSTEET-2026</h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Submission Type:</span> ${
          SubmissionData.Submission_type
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Paper Title:</span> ${
          SubmissionData.Paper_Title
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Submission ID:</span> ${
          SubmissionData.Submission_ID
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Author Name:</span> ${
          SubmissionData.Author_Name
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Co-Author Name:</span> ${
          SubmissionData.Co_Author_Name || "N/A"
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Corresponding Email:</span> <a href="mailto:${
          SubmissionData.Corresponding_Email
        }" style="color: #6a5acd; text-decoration: none;">${
      SubmissionData.Corresponding_Email
    }</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">LinkedIn URL:</span> <a href="${
          SubmissionData.Linkedin_URL
        }" style="color: #6a5acd; text-decoration: none;" target="_blank">${
      SubmissionData.Linkedin_URL
    }</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Facebook URL:</span> <a href="${
          SubmissionData.Facebook_URL
        }" style="color: #6a5acd; text-decoration: none;" target="_blank">${
      SubmissionData.Facebook_URL
    }</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Presentation Category:</span> ${
          SubmissionData.Presentation_Category
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Presentation Type:</span> ${
          SubmissionData.Presentation_Type
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Institution Name:</span> ${
          SubmissionData.Institution_Name
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Department:</span> ${
          SubmissionData.Department
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Designation:</span> ${
          SubmissionData.Designation
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Publication Required:</span> ${
          SubmissionData.Publication_Required
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Conference Source:</span> ${
          SubmissionData.Conference_Source || "N/A"
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Message:</span> ${
          SubmissionData.Message || "N/A"
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Mobile Number:</span> ${
          SubmissionData.Mobile_Number
        }</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">WhatsApp Number:</span> ${
          SubmissionData.Whatsapp_Number
        }</p>
        

        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>

        <a href="mailto:${
          SubmissionData.Corresponding_Email
        }" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #6a5acd; color: #ffffff; border-radius: 5px; text-decoration: none; transition: background-color 0.3s ease;">Reply to Submission</a>
    </div>
</body>
</html>
`;
    const attachment = [
      {
        filename: SubmissionData.File.originalname,
        content: SubmissionData.File.buffer,
        contentType: SubmissionData.File.mimetype,
      },
    ];

    const ReplayTemplate = `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Submission Acknowledgment</title>
</head>
<body style="font-family: 'Montserrat', sans-serif; background: linear-gradient(135deg, #f6f6f9, #f6f6f9); display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #333; margin: 20px 0px;">

    <div style="max-width: 600px; width: 100%; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1); padding: 40px; text-align: center;">
        
        <div style="border-radius: 50%; background-color: #9406c3; color: #ffffff; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px;">
            <span style="margin: auto;">🎉</span>
        </div>

        <h1 style="color: #9406c3; font-size: 28px; font-weight: 600; margin-bottom: 10px;">Thank You for Your Submission!</h1>
        
        <p style="color: #666666; font-size: 18px; margin-bottom: 25px;">Dear Participant,</p>
        
        <p style="color: #444444; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            We are thrilled to receive your submission for 
            <span style="color: #ffffff; background: #9406c3; padding: 5px 10px; border-radius: 5px;">ICSTEET 2026</span>! Your hard work and interest mean a lot to us. 🙏
        </p>

        <p style="font-size: 16px; color: #333; font-weight: 500; margin-bottom: 15px;">
            Submission ID: <span style="color: #9406c3;">${SubmissionData.Submission_ID}</span>
        </p>

        <p style="color: #444444; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Our review team is now processing your submission. We’ll contact you soon with more information. 📅
        </p>

        <p style="color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            For any immediate questions, reach us at <span style="color: #9406c3; font-weight: bold;">+91 8072381719</span> or email 
            <span style="color: #9406c3; font-weight: bold;">info@icsteet.com</span>. 📞✉️
        </p>

        <div style="background: #f1f8e9; padding: 15px; border-radius: 8px; margin-top: 20px; color: #333; font-size: 14px;">
            <p style="margin: 0;">Thank you again for being a part of ICSTEET 2026. We wish you all the best! 🎯</p>
        </div>

        <div style="border-top: 1px solid #eeeeee; margin-top: 30px; padding-top: 20px;">
            <p style="color: #777777; font-size: 14px; line-height: 1.5;">Best regards,<br><strong>The ICSTEET 2026 Team</strong></p>
        </div>
    </div>

</body>
</html>
    `;
    res.status(201).send({
      message: `${req.body.Submission_type} Submission Successfully 🎉🎊`,
    });
    sendEmailToAdmin(
      "New Paper Submission from ICSTEET-2026",
      HtmlTemplate,
      attachment
    );
    sendEmailToUser(
      "ICSTEET 2026",
      ReplayTemplate,
      SubmissionData.Corresponding_Email
    );
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/Committee", upload.single("file"), async (req, res) => {
  try {
    const committeeMember = new Member({
      ...req.body,
      Uploaded_File: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer,
      },
    });
    const HtmlTemplate = ` 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; margin: 0; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); padding: 40px; max-width: 600px; margin: auto; border-top: 5px solid #6a5acd;">
        <h2 style="color: #6a5acd; font-size: 26px; margin-bottom: 15px;">New Organizing Committee Member from ICSTEET-2026</h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Title:</span> ${committeeMember.Title}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">First Name:</span> ${committeeMember.First_Name}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Email:</span> <a href="mailto:${committeeMember.Email}" style="color: #6a5acd; text-decoration: none;">${committeeMember.Email}</a></p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Phone Number:</span> ${committeeMember.Number}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Country:</span> ${committeeMember.Country}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Member Category:</span> ${committeeMember.Member_Category}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Organization:</span> ${committeeMember.Organization}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Qualification:</span> ${committeeMember.Qualification}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Professional Experience:</span> ${committeeMember.Professional_Experience}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Industry Experience:</span> ${committeeMember.Industry_Experience}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Department:</span> ${committeeMember.Department}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Specialization:</span> ${committeeMember.Specialization}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">h-index:</span> ${committeeMember.h_index}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Associated with CERADA:</span> ${committeeMember.Associated_Cerada}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Publications:</span> ${committeeMember.Publication}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">SCI Published Papers:</span> ${committeeMember.SCI_Published}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Journals:</span> ${committeeMember.Journals}</p>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 10px;"><span style="font-weight: bold;">Conference Information:</span> ${committeeMember.Conference_Info}</p>

        <div style="height: 1px; background-color: #e0e0e0; margin: 20px 0;"></div>

        <a href="mailto:${committeeMember.Email}" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #6a5acd; color: #ffffff; border-radius: 5px; text-decoration: none; transition: background-color 0.3s ease;">Reply to Member</a>
    </div>
</body>
</html>
`;
    const attachment = [
      {
        filename: committeeMember.Uploaded_File.originalname,
        content: committeeMember.Uploaded_File.buffer,
        contentType: committeeMember.Uploaded_File.mimetype,
      },
    ];
    await committeeMember.save();
    res.status(201).json({ message: "Committee member saved successfully." });
    sendEmailToAdmin(
      "New Organizing Committee Member from ICSTEET-2026",
      HtmlTemplate,
      attachment
    );
  } catch (error) {
    console.error("Error saving committee member data:", error);
    return res.status(500).json({
      message: "Error saving committee member data.",
      error: error.message,
    });
  }
});

app.post("/Speakers_Details", upload.single("Speaker_Image"), (req, res) => {
  try {
    const CollectionName = req.body.Title;
    const SpeakerModel = mongoose.model(CollectionName, SpeakerSchema);
    const Speaker_Speaker = new SpeakerModel({
      ...req.body,
      Speaker_Image: {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      },
    });
    Speaker_Speaker.save();
    res
      .status(201)
      .send({ message: "Keynote Speakers data received successfully!" });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.delete("/Speaker/:title/:id", async (req, res) => {
  try {
    const { title, id } = req.params;
    const SpeakerModel = mongoose.model(title, SpeakerSchema);
    const deletedSpeaker = await SpeakerModel.findByIdAndDelete(id);
    if (!deletedSpeaker) {
      return res.status(404).send({ message: "Speaker not found" });
    }
    res.send({ message: "Speaker deleted successfully", data: deletedSpeaker });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
});
app.post("/Deadline", async (req, res) => {
  try {
    const { Deadline_Title, Date, Super_Script, Month, Year } = req.body;
    const existingDeadline = await Deadline_Schema.findOne({ Deadline_Title });

    if (existingDeadline) {
      existingDeadline.Date = Date;
      existingDeadline.Super_Script = Super_Script;
      existingDeadline.Month = Month;
      existingDeadline.Year = Year;

      await existingDeadline.save();
      return res.status(200).send({ message: "Deadline updated successfully" });
    }

    const deadline = new Deadline_Schema(req.body);
    await deadline.save();

    res.status(201).send({ message: "Deadline date Updated Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post(
  "/Essential_Files_Updates",
  upload.single("Essential_File"),
  async (req, res) => {
    try {
      const { Essential_File_Title } = req.body;
      const ExistFiles = await Essential_Schema.findOne({
        Essential_File_Title,
      });

      if (ExistFiles) {
        ExistFiles.Essential_File.File_Name = req.file.originalname;
        ExistFiles.Essential_File.File_Buffer = req.file.buffer;

        await ExistFiles.save();
        return res.status(200).send({
          message: `${Essential_File_Title.replace(
            /_/g,
            " "
          )} Updated Successfully`,
        });
      }

      const EssentialFile = new Essential_Schema({
        ...req.body,
        Essential_File: {
          File_Name: req.file.originalname,
          File_Buffer: req.file.buffer,
        },
      });
      EssentialFile.save();
      res
        .status(200)
        .send({ message: "Essential Files Uploaded Successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  }
);

app.get("/api/ICSTEET_2025/Session_Tracks", async (req, res) => {
  try {
    const sessionTracks = await SessionSchema.find({}).lean();
    res.json(sessionTracks);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching session tracks data" });
  }
});

app.get("/api/ICSTEET_2025/Registration_Fees", async (req, res) => {
  try {
    const RegistrationFeeData = await Registration_Fee_Schema.find({}).lean();
    res.json(RegistrationFeeData);
  } catch (error) {
    res.status(500).json({ message: "Error fetching registration fees" });
  }
});

app.get("/api/Essential_File", async (req, res) => {
  try {
    const EssentialFile = await Essential_Schema.find({});
    res.status(200).json(EssentialFile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/Deadline_Dates", async (req, res) => {
  try {
    const DeadlineDates = await Deadline_Schema.find({});
    res.status(200).json(DeadlineDates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/Speaker_Details", async (req, res) => {
  try {
    const collectionNames = [
      "Welcome_Address",
      "Guest_of_Honour",
      "Conference_Chair",
      "Keynote_Speakers",
      "Session_Speakers",
      "Session_Chair",
      "Scientific_Committee",
      "Review_Committee",
    ];
    const allSpeakerDetails = {};
    for (const collectionName of collectionNames) {
      const SpeakerModel = mongoose.model(collectionName, SpeakerSchema);
      const speakerDetails = await SpeakerModel.find({}).sort({ position: 1 });
      allSpeakerDetails[collectionName] = speakerDetails;
    }
    res.status(200).json(allSpeakerDetails);
  } catch (error) {
    console.log(error);
  }
});

app.get("/api/ICSTEET_2026/Data/All", async (req, res) => {
  try {
    const submission_data = await Submission.find({});
    const contact_data = await Contact_Schema.find({});
    const committee_data = await Member.find({});
    const registration_data = await Registration.find({});
    const totalAmount = registration_data.reduce(
      (sum, item) => sum + (item.Razorpay_Payment_Details?.amount || 0) / 100,
      0
    );
    const DownloadData = await Download.find({});
    res.status(200).json({
      Submission: submission_data,
      Contact: contact_data,
      Committee: committee_data,
      Registration: registration_data,
      TotalAmount: totalAmount,
      Download: DownloadData,
    });
  } catch (error) {
    console.log(error);
  }
});

const LoginSchema = new mongoose.Schema({
  Email: String,
  Password: String,
});

const Login = mongoose.model("Logins", LoginSchema);

app.post("/ICSTEET_2026_Login", async (req, res) => {
  try {
    const user = await Login.find({});
    if (
      !user ||
      req.body.Email !== user[0].Email ||
      req.body.Password !== user[0].Password
    ) {
      return res.json({ success: false, message: "Invalid Email or Password" });
    }
    const token = jwt.sign({ Email: user.Email }, process.env.secret_key, {
      expiresIn: "1h",
    });
    res.json({ success: true, message: "Login Successful", token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

const sendEmailToAdmin = async (subject, htmlContent, attachment) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.ADMIN_MAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: process.env.ADMIN_MAIL,
      to: process.env.ADMIN_MAIL,
      subject: subject,
      html: htmlContent,
      attachments: attachment,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent to admin:", process.env.ADMIN_MAIL);
  } catch (error) {
    console.error("Error sending email to admin:", error);
  }
};

const sendEmailToUser = async (subject, htmlContent, Email) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.ADMIN_MAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: process.env.ADMIN_MAIL,
      to: Email,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent to User:", Email);
  } catch (error) {
    console.error("Error sending email to User:", error);
  }
};

const sendEmailToAdmin1 = async (subject, htmlContent) => {
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER_INFO,
        pass: process.env.SMTP_PASS_INFO.replace(/\s/g, ''), // Remove spaces
      },
    });

    const result = await transporter.sendMail({
      from: process.env.SMTP_USER_INFO,
      to: process.env.EMAIL_ADMIN_INFO,
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("Email error:", error.message);
    throw error;
  }
};

const HandleSponsor = async (req, res) => {
  try {
    const formData = req.body;
    console.log('Processing sponsor form:', formData);

    // Check for duplicate sponsor by email
    const sponsorExists = await Sponsor.findOne({ email: formData.email });
    if (sponsorExists) {
      return res
        .status(400)
        .json({ errorMessage: "Sponsor with this email already exists" });
    }

    // Create and save sponsor
    const newForm = new Sponsor(formData);
    const savedSponsor = await newForm.save();
    console.log('Sponsor saved to database:', savedSponsor._id);

    // Build email content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sponsorship Form</title>
    <style>
        body {
            font-family: "Poppins", sans-serif;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 80%;
            margin: 0 auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #00C4AC;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
            display: flex;
            align-items: center;
            gap: 10px;
            justify-content: center;
        }
        .highlight {
            background: #00C4AC;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            display: inline-block;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .info {
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .info label {
            font-weight: bold;
        }
        .info p {
            margin: 0px 8px;
        }
        .footer {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
          <svg width="16" height="16" fill="currentColor" class="bi bi-envelope" viewBox="0 0 16 16">
            <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2 1v1.293l6 3.5 6-3.5V5H2zm0 2.207L8 11.207l6-3.5V11H2v-3.793z"/>
          </svg>
          Sponsorship Form
        </h1>

        <div class="highlight">Tier: ${formData.sponsorshipType || 'N/A'} | Price: ${formData.sponsorshipPrice || 'N/A'}</div>

        <div class="info"><label>Full Name:</label><p>${formData.fullName}</p></div>
        <div class="info"><label>Email:</label><p>${formData.email}</p></div>
        <div class="info"><label>Organization:</label><p>${formData.organization}</p></div>
        <div class="info"><label>Designation:</label><p>${formData.designation}</p></div>
        <div class="info"><label>Address:</label><p>${formData.address}</p></div>
        <div class="info"><label>City:</label><p>${formData.city}</p></div>
        <div class="info"><label>State:</label><p>${formData.state}</p></div>
        <div class="info"><label>Zip Code:</label><p>${formData.zipCode}</p></div>
        <div class="info"><label>Country:</label><p>${formData.country}</p></div>
        <div class="info"><label>Phone:</label><p>${formData.phone}</p></div>

        <div class="footer">
            <p>This email was generated as part of a sponsorship form submission.</p>
        </div>
    </div>
</body>
</html>`;

    // Try to send email and handle errors
    try {
      console.log('Attempting to send sponsor email...');
      await sendEmailToAdmin1("Sponsor Details", htmlContent);
      console.log('Sponsor email sent successfully');
      
      res.status(201).json({
        message: "Sponsor Details saved successfully and email sent",
        sponsor: savedSponsor,
        emailSent: true
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Still return success for the sponsor save, but indicate email failed
      res.status(201).json({
        message: "Sponsor Details saved successfully but email failed to send",
        sponsor: savedSponsor,
        emailSent: false,
        emailError: emailError.message
      });
    }

  } catch (err) {
    console.error("Sponsor Save Error:", err);
    res
      .status(500)
      .json({ errorMessage: err.message || "Internal Server Error" });
  }
}

// IMPORTANT: Register the route BEFORE app.listen()
app.post("/sponsor", HandleSponsor);

// Now start the server
app.listen(process.env.api_port, (req, res) => {
  console.log(`Server is running on port ${process.env.api_port}`);
});

// CREATE - Add new coupon
app.post("/api/coupons", async (req, res) => {
  try {
    const { code, discountPercentage, expiryDate, usageLimit, description } = req.body;
    
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ 
        success: false, 
        message: "Coupon code already exists" 
      });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountPercentage: discountPercentage || 5,
      expiryDate,
      usageLimit,
      description,
    });

    await newCoupon.save();
    res.status(201).json({ 
      success: true, 
      message: "Coupon created successfully", 
      coupon: newCoupon 
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create coupon", 
      error: error.message 
    });
  }
});

// READ - Get all coupons
app.get("/api/coupons", async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ 
      success: true, 
      coupons 
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch coupons", 
      error: error.message 
    });
  }
});

// VALIDATE - Validate coupon code
app.post("/api/coupons/validate", async (req, res) => {
  try {
    const { code } = req.body;
    
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid coupon code" 
      });
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: "Coupon has expired" 
      });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ 
        success: false, 
        message: "Coupon usage limit reached" 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: "Coupon is valid",
      coupon: {
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
        description: coupon.description
      }
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to validate coupon", 
      error: error.message 
    });
  }
});

// DELETE - Delete coupon
app.delete("/api/coupons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCoupon = await Coupon.findByIdAndDelete(id);

    if (!deletedCoupon) {
      return res.status(404).json({ 
        success: false, 
        message: "Coupon not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: "Coupon deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete coupon", 
      error: error.message 
    });
  }
});