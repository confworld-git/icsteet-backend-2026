import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  Title: { type: String, required: true },
  First_Name: { type: String, required: true },
  Last_Name: { type: String, required: true },
  Certificate_Name: { type: String, required: true },
  Date_Of_Birth: { type: Date, required: true },
  Nationality: { type: String, required: true },
  Department: { type: String, required: true },
  Institution: { type: String, required: true },
  Mobile_Number: { type: String, required: true },
  Email: { type: String, required: true },
  Participant_Category: { type: String, required: true },
  Presentation_Category: { type: String, required: true },
  Presentation_Type: { type: String, required: true },
  status: { type: String },
  order_id: { type: String },

  selectedFee: {
    category: { type: String, required: true },
    type: { type: String, required: true },
    Title: { type: String, required: true },
    amount: { type: Number, required: true },
  },

  // Pricing breakdown
  baseAmount: { type: Number, required: true },
  finalAmount: { type: Number, required: true },

  // ── NEW: Journal Publication Support ──────────────────────────
  journalSupport: {
    tier: { type: String, default: null },
    package: { type: String, default: null },
    amount: { type: Number, default: 0 },
  },
  journalAmount: { type: Number, default: 0 },

  // ── NEW: Add-ons ──────────────────────────────────────────────
  addons: [
    {
      label: { type: String },
      sublabel: { type: String },
      amount: { type: Number },
    },
  ],
  addonsAmount: { type: Number, default: 0 },

  // Membership & Coupon
  hasMembership: { type: Boolean, default: false },
  membershipFee: { type: Number, default: 0 },
  couponCode: { type: String, default: null, uppercase: true },
  couponDiscount: { type: Number, default: 0 },
  membershipDiscount: { type: Number, default: 0 },

  Razorpay_Payment_Details: { type: Object },
});

const Registration = mongoose.model("Registration", registrationSchema);

export default Registration;