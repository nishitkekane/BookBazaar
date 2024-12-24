const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const stripe = require('stripe')('sk_test_51QDOGKCindc2bt4HI6xuoniTydStd6SC39NqegqkAIBBOzWtmaQ5athoZqPMt470K3KXsST2seN7i8B925YQId6b00lJsDUr9B');
const cors = require('cors');
const methodOverride = require('method-override');
const nodemailer = require('nodemailer'); // Add Nodemailer
const PDFDocument = require('pdfkit');

const app = express();

// Models
const Book = require('./models/book');
const User = require('./models/user');
const Transaction = require('./models/transaction');

// Middleware and configurations
app.use(methodOverride('_method'));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdfs')));

app.set('view engine', 'ejs');
app.use('/uploads', express.static('uploads'));

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Generate unique filename
  },
});
const upload = multer({ storage: storage });

mongoose.connect('mongodb://localhost:27017/book_bazaar', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB");
}).catch((err) => {
  console.error("MongoDB connection error: ", err);
});

// Session management middleware
app.use(session({
  secret: 'bookbazaarsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
  },
}));

app.use(express.urlencoded({ extended: true })); // For handling form data
app.use(express.json()); // If sending JSON

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

app.get('/new', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const user = req.session.user;
  res.render('new', { user });
});

app.get('/', (req, res) => {
  if (req.session.user) {
    const user = req.session.user;
    res.render('home', { user });
  } else {
    res.render('home', { user: null }); 
  }
});

app.post('/new', upload.single('image'), async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const { name, author, subject, shortDescription, price } = req.body;
  const image = req.file ? req.file.path : null;
  const ownerEmail = req.session.user.email;
  try {
    const newBook = new Book({
      name,
      author,
      subject,
      shortDescription,
      price,
      image,
      owner: ownerEmail
    });
    await newBook.save();
    const userId = req.session.user._id;
    res.redirect('/');
  } catch (err) {
    console.error('Error saving book:', err);
    res.status(500).send('Server Error');
  }
});


// Nodemailer Transporter setup (using Gmail in this example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nishit.kekane04@gmail.com', // Your email address
    pass: 'kmbp wwnh pvat nizb', // Your email password or app-specific password
  },
});

app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('Username already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    // Create session for the user
    req.session.user = newUser;

    // Send a welcome email
    const mailOptions = {
      from: 'nishit.kekane04@gmail.com',
      to: newUser.email,
      subject: 'Welcome to Our Website!',
      text: `Hello ${newUser.username},\n\nThank you for signing up on our website! We're excited to have you on board.\n\nBest regards,\nThe Team`,
    };

    // Send the email
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Error sending email:', err);
      } else {
        console.log('Email sent:', info.response);
      }
    });

    // Redirect the user to their profile page
    res.redirect(`/user/${newUser._id}`);
  } catch (err) {
    console.error('Error signing up:', err);
    res.status(500).send('Server Error');
  }
});


app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send('Invalid credentials');
    }
    req.session.user = user;
    res.redirect(`/user/${user._id}`);
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.render('home', { user: user });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).send('Server Error');
    }
    res.redirect('/');
  });
});

app.get('/:id/gallery', async (req, res) => {
  // Check if the user is logged in and matches the requested ID
  if (!req.session.user || req.session.user._id !== req.params.id) {
    return res.redirect('/login');
  }
  try {
    const books = await Book.find();
    res.render('gallery', {
      books,        
      user: req.session.user, 
      userId: req.params.id,  
    });
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).send('Server Error');
  }
});


app.delete('/delete-book/:id', async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) {
      return res.status(404).send('Book not found');
    }
    res.redirect(`/${req.session.user._id}/gallery`);
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/book/:id', isLoggedIn, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId).exec();
    if (!book) {
      return res.status(404).send('Book not found');
    }
    const owner = await User.findOne({ email: book.owner }).exec();
    if (!owner) {
      return res.status(404).send('Owner not found');
    }
    res.render('bookDetails', {
      book: book,
      owner: owner,
      loggedInUser: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching book details:', error);
    res.status(500).send('Server Error');
  }
});

app.get('/signup', (req, res) => {
  res.render('signup'); 
});


const fs = require('fs');

app.post('/checkout-payment', async (req, res) => {
  const { bookId } = req.body;  // We only need bookId from the client
  
  try {
      // Find the book from the database by its ID
      const book = await Book.findById(bookId);
      
      if (!book) {
          return res.status(404).send({ error: 'Book not found' });
      }

      // Extract book details
      const { name, price, shortDescription } = book;

      // Set the base URL for success and cancel redirects
      const successUrl = process.env.BASE_URL || 'http://localhost:3000'; // Fallback to localhost if BASE_URL is not set

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
              {
                  price_data: {
                      currency: 'inr',
                      product_data: {
                          name: name,
                          description: shortDescription,
                      },
                      unit_amount: price * 100, // price in cents
                  },
                  quantity: 1,
              },
          ],
          mode: 'payment',
          success_url: `${successUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${successUrl}/cancel`,
      });

      // Redirect the user to Stripe Checkout page
      res.redirect(303, session.url);

  } catch (error) {
      console.error('Error during Stripe payment session creation:', error);

      // Log more details about the error
      if (error instanceof stripe.errors.StripeError) {
          console.error(`Stripe error type: ${error.type}`);
          console.error(`Stripe error message: ${error.message}`);
      }

      res.status(500).send({ error: 'Something went wrong with the payment session.', details: error.message });
  }
});



app.post('/make-payment', async (req, res) => {
  const user = req.session.user; // Access logged-in user from session

  if (!user) {
    return res.status(403).send({ error: 'You must be logged in to make a payment' });
  }
  console.log('Authenticated user:', user);

  try {
    const { bookId } = req.body;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).send({ error: 'Book not found' });
    }

    // Prevent buying own book
    if (book.owner === user.email) {
      return res.status(400).send({ error: 'You cannot purchase your own book.' });
    }

    // Generate the invoice PDF
    const doc = new PDFDocument({ margin: 50 });
    const invoiceBuffer = [];
    doc.on('data', chunk => invoiceBuffer.push(chunk));
    doc.on('end', () => {
      const pdfData = Buffer.concat(invoiceBuffer);

      // Set headers to download the PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice_${bookId}.pdf"`
      );
      res.send(pdfData);
    });

    // Add header
    doc.fontSize(20).text('Book Bazaar Invoice', { align: 'center', underline: true });
    doc.moveDown();

    // Add invoice details
    doc.fontSize(12).text(`Invoice Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.text(`Invoice ID: INV-${bookId.slice(-6).toUpperCase()}`, { align: 'right' });
    doc.moveDown(2);

    // Seller details
    doc.fontSize(14).text('Seller Details', { underline: true });
    doc.fontSize(12).text(`Name: ${book.owner}`);
    doc.text(`Email: seller@example.com`); // Replace with actual seller email
    doc.text(`Contact: +91-1234567890`); // Replace with actual seller contact
    doc.text(`Address: 123, Seller Street, Seller City, Country`);
    doc.moveDown(2);

    // Buyer details
    doc.fontSize(14).text('Buyer Details', { underline: true });
    doc.fontSize(12).text(`Name: ${user.username}`);
    doc.text(`Email: ${user.email}`);
    doc.text(`Contact: +91-9876543210`); // Replace with actual buyer contact
    doc.text(`Address: 456, Buyer Lane, Buyer City, Country`);
    doc.moveDown(2);

    // Book details
    doc.fontSize(14).text('Book Details', { underline: true });
    doc.fontSize(12).text(`Book Name: ${book.name}`);
    doc.text(`Description: ${book.shortDescription}`);
    doc.text(`Price: ₹${book.price.toFixed(2)}`);
    doc.text(`Book ID: ${book._id}`);
    doc.moveDown(2);

    // Footer
    doc.moveDown();
    doc.fontSize(10).text(
      'Thank you for your purchase! For any inquiries, contact us at support@bookbazaar.com',
      { align: 'center', oblique: true }
    );

    doc.end();
  } catch (error) {
    console.error('Error in make-payment:', error);
    res.status(500).send({ error: 'An error occurred during payment processing' });
  }
});


app.get('/success', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).send('Session ID is missing');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const transaction = new Transaction({
      userId: session.metadata.userId,
      transactionId: session.payment_intent,
      bookId: session.metadata.bookId,
      amount: session.amount_total,
      currency: session.currency,
      paymentMethod: session.payment_method_types[0],
      status: session.payment_status,
      payerEmail: session.customer_email,
      createdAt: new Date(),
    });

    await transaction.save();
    res.render('success', { transaction });
  } catch (err) {
    console.error('Error processing success payment:', err);
    res.status(500).send('Server error processing the transaction.');
  }
});

app.get('/learnmore',(req,res)=>{
  res.render('learnmore')
})

app.get('/cancel', (req, res) => {
  res.render('cancel');
});

app.get('/contact', (req,res) => {
  res.render('contact')
})


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});




