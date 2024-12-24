const mongoose = require('mongoose');
const User = require('./user');


const bookSchema = new mongoose.Schema({
    name: String,
    author: String,
    subject: String,
    shortDescription: String,
    price: Number,
    image: String, 
    owner: { type: String, required: true }  // Store the owner's email as a string
});

module.exports = mongoose.model('Book', bookSchema);

