/*
  This document contains the basic implementation of linking Stripe to 
  Firebase Functions to create new customers and trigger payments
*/

/*
  Package dependencies
*/
// dotenv stores & protects your secret keys in a .env file
require("dotenv").config();
// Firebase functions
const functions = require("firebase-functions");
// Stripe API access
// We're passing our Stripe Secret Live key here through .env
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_TEST);
// cors allows us to trigger this through an external request
const cors = require("cors")({ origin: true });
// the Firebase Admin SDK to access Firestore.
const admin = require("firebase-admin");
// initialization of our app instance
admin.initializeApp();
// initialization of our database instance
const db = admin.firestore();

/*
  Just a testing function to export basic logs in the emulator
*/
exports.test = functions.https.onRequest((req, res) => {
  console.log("FUCKKK");
  // console.log(process.env.STRIPE_SECRET_KEY_TEST) NEVER deploy with this uncommented (just remove right after testing)

  return res.json({ status: "success" });
});

/*
  The HTTP API Request to create a new Stripe customer
  Must pass all of the query parameters below to construct the customer object
*/
exports.createStripeCustomer = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {
    // note: depending on how you setup your request these could be 'query' or 'params'
    const user = req.query.user; // this is the user's id
    const email = req.query.email;
    const name = req.query.name;
    const number = req.query.card; // card number
    const exp_month = req.query.month;
    const exp_year = req.query.year;
    const cvc = req.query.code;
    const phone = req.query.phone; // optional

    // create the stripe customer object
    // email for customer creation is optional but recommended
    stripe.customers
      .create({
        email: email,
      })
      .then((customer) => {
        const id = customer.id; // stripe id of the customer

        // create a stripe token for the card
        stripe.tokens
          .create({
            card: {
              name,
              number,
              exp_month,
              exp_year,
              cvc,
            },
          })
          .then((token) => {
            // add token card to source
            stripe.customers
              .createSource(id, {
                source: token.id,
              })
              .then(async (source) => {
                // customer creation was successful
                // save customerId & phone (optional) to database
                const ref = db.collection("users").doc(user);

                if (phone) {
                  // if phone, include in db set
                  // (can remove this if block & just use the else block if phone is not relevant)
                  // we use merge in both instances to not overwrite current db data
                  await ref.set(
                    { customer: customer.id, phone },
                    { merge: true }
                  );
                } else {
                  await ref.set({ customer: customer.id }, { merge: true });
                }

                // return a status of success to be picked up in the response json
                return res.json({ status: "success" });
              })
              .catch((err) => {
                // could not create cc source or attach to customer object
                console.error(err);
                return res.json({ status: "error", error: err.toString() });
              });
          })
          .catch((err) => {
            // could not create card token
            console.error(err);
            return res.json({ status: "error", error: err.toString() });
          });
      })
      .catch((err) => {
        // could not create stripe customer object
        console.error(err);
        return res.json({ status: "error", error: err.toString() });
      });
  });
});

/*
  The Firestore Database request to charge a customer's current payment method
  This listens for a database entry request to be created and then updates the db request with the response
  Query parameters needed: reference id, amount, stripe customer id to be charged, description
*/
exports.monitorPaymentRequests = functions.firestore
  .document("/payments/{documentId}")
  .onCreate(async (snap, context) => {
    // grab the current value of what was written to Firestore.
    const data = snap.data();
    const refId = data.id; // reference id of the transaction
    const customerId = data.customerId; // required
    const amount = data.amount; // must be in cents
    const description = data.description; // optional

    // retrieve the stripe customer if they exist
    const stripeCustomer = await stripe.customers.retrieve(customerId);
    if (stripeCustomer) {
      // customer exists, continue
      const paymentSource = stripeCustomer["default_source"];

      if (paymentSource) {
        // default source exists, charge source
        const charge = stripe.charges
          .create({
            amount: amount,
            currency: "usd",
            source: paymentSource,
            description,
          })
          .then(async (charge) => {
            // charge creation was successful
            // create instance of database object to write to
            const ref = db.collection("payments").doc(refId);
            // determine charge status
            const status = charge.status;
            if (status === "succeeded") {
              // payment source was successfully charged, write charge object to database
              // note: I have not tested these charge values so I do not know if these are all correct
              // – if you see 'undefined' values in the db then likely some of these are wrong
              const chargeObject = {
                chargeId: charge.id,
                amount: charge.amount,
                description: charge.description,
                outcome: charge.outcome,
                paid: charge.paid,
                paymentIntent: charge.paymentIntent,
                paymentMethod: charge.paymentMethod,
                receiptUrl: charge.receiptUrl,
                status: charge.status,
                source: charge.source,
              };
              // overwrite charge object to database
              await ref.set(chargeObject);
            } else {
              // payment source was unsuccessfully charged, return error response
              const chargeObject = {
                chargeId: charge.id,
                amount: charge.amount,
                description: charge.description,
                outcome: charge.outcome,
                paid: charge.paid,
                status: charge.status,
                source: charge.source,
              };
              // overwrite charge object to database
              await ref.set(chargeObject);
            }

            // return a status of success to be picked up in the response json
            return res.json({ status: "success" });
          })
          .catch((err) => {
            // could not create the charge from default customer source
            console.error(err);
            return res.json({ status: "error", error: err.toString() });
          });
      } else {
        // no default payment attached to customer, throw error
        const err = "No default payment attached to customer";
        console.error(err);
        return res.json({ status: "error", error: err });
      }
    } else {
      // customer does not exist, throw error
      const err = "Customer does not exist";
      console.error(err);
      return res.json({ status: "error", error: err });
    }
  });
