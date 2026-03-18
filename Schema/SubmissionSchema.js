import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema(
  {
    Submission_type: { type: String, required: true },
    Paper_Title: { type: String, required: true },
    Author_Name: { type: String, required: true },
    Co_Author_Name: { type: String },
    Corresponding_Email: { type: String, required: true },
    Linkedin_URL: { type: String },
    Facebook_URL: { type: String },
    Presentation_Category: { type: String, required: true },
    Presentation_Type: { type: String, required: true },
    Institution_Name: { type: String, required: true },
    Department: { type: String, required: true },
    Designation: { type: String, required: true },
    Publication_Required: { type: String, enum: ["yes", "no"], required: true },
    File: {
      buffer: { type: Buffer, required: true },
      originalname: { type: String, required: true },
      mimetype: { type: String, required: true },
    },
    Conference_Source: { type: String },
    Message: { type: String },
    Mobile_Number: { type: String, required: true },
    Whatsapp_Number: { type: String, required: true },
    Submission_ID: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const Submission = mongoose.model("Submission", SubmissionSchema);
export default Submission;
