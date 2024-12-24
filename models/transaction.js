const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the User model
    required: true,
    ref: 'User',
  },
  transactionId: {
    type: String, // Stripe payment intent ID
    required: true,
    unique: true,
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the Book model
    required: true,
    ref: 'Book',
  },
  amount: {
    type: Number, // Payment amount in smallest currency unit
    required: true,
  },
  currency: {
    type: String, // Payment currency (e.g., 'usd', 'inr')
    required: true,
  },
  paymentMethod: {
    type: String, // Payment method (e.g., 'card')
    required: true,
  },
  status: {
    type: String, // Payment status (e.g., 'paid')
    enum: ['paid', 'pending', 'failed'],
    required: true,
  },
  payerEmail: {
    type: String, // Payer's email
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Transaction', transactionSchema);
