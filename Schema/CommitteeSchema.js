import mongoose from "mongoose";

const ocmSchemaFile = mongoose.Schema({
  originalname: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  buffer: { type: Buffer, required: true },
});

const memberSchema = new mongoose.Schema({
  Title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
  },
  First_Name: {
    type: String,
    required: [true, "First Name is required"],
    trim: true,
  },
  Email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: "Please enter a valid email",
    },
  },
  Country: {
    type: String,
    required: [true, "Country is required"],
    trim: true,
  },
  Number: {
    type: String,
    required: [true, "Number is required"],
    trim: true,
  },
  Member_Category: {
    type: String,
    required: [true, "Member Category is required"],
    trim: true,
  },
  Organization: {
    type: String,
    required: [true, "Organization is required"],
    trim: true,
  },
  Qualification: {
    type: String,
    required: [true, "Qualification is required"],
    trim: true,
  },
  Professional_Experience: {
    type: String,
    required: [true, "Professional Experience is required"],
  },
  Industry_Experience: {
    type: String,
    required: [true, "Industry Experience is required"],
  },
  Department: {
    type: String,
    required: [true, "Department is required"],
    trim: true,
  },
  Specialization: {
    type: String,
    required: [true, "Specialization is required"],
    trim: true,
  },
  h_index: {
    type: Number,
    required: [true, "h-index is required"],
  },
  Associated_Cerada: {
    type: String,
    required: [true, "Associated Cerada is required"],
    trim: true,
  },
  Publication: {
    type: String,
    required: [true, "Publication is required"],
    trim: true,
  },
  SCI_Published: {
    type: String,
    required: [true, "SCI Published status is required"],
  },
  Journals: {
    type: String,
    required: [true, "Journals information is required"],
    trim: true,
  },
  Conference_Info: {
    type: String,
    required: [true, "Conference Info is required"],
    trim: true,
  },
  Uploaded_File: { type: ocmSchemaFile, required: true },
});

const Member = mongoose.model("Member", memberSchema);

export default Member;
