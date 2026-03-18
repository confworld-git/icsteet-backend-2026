import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema({
  Full_Name: {
    type: String,
    trim: true,
  },
  Email: {
    type: String,
    trim: true,
  },
  Mobile_Number: {
    type: Number,
  },
  Message: {
    type: String,
    trim: true,
  },
});

const Contact_Schema = mongoose.model("Contact_Data", ContactSchema);
export default Contact_Schema;
