# Pay it forward
---

This repo serves as the basis for implementing Stripe Payments within a Firestore project. API requests and database hooks are implemented through Firebase Functions.

A basic understanding of Firestore and Firebase Functions is recommended.

---

## Purpose

This project enables Stripe Customer creation through an HTTPS API Request and saves the newly created customer ID in Firestore.

It also allows Stripe Payment Requests to be made entirely through the Firestore Database, rather than hitting an HTTPS API Request. This implementation can be considered more secure as it doesn't allow any unauthorized requests to be made.

## Steps

1. Initialize new Firebase Firestore & Functions project

> Follow the Firebase Functions setup guide [here](https://firebase.google.com/docs/functions/get-started).

Set up Node.js and the Firebase CLI
```
npm install -g firebase-tools
```

Initialize your project [^1]
```
firebase login
firebase init firestore
firebase init functions
```
[^1]: Accept Javascript and No for ESLint when prompted.

2. Install additional dependencies

Navigate to the project's base directory. Open `package.json` and replace with the file contents located [here](https://github.com/tjcages/Pay-it-forward-backend/blob/main/package.json). Run `npm install` in this directory.

Navigate to the project's `functions` directory. Open `package.json` and replace with the file contents located [here](https://github.com/tjcages/Pay-it-forward-backend/blob/main/functions/package.json). Run `npm install` in this directory.

3. Copy the contents of `index.js` found in the `functions` directory, [here](https://github.com/tjcages/Pay-it-forward-backend/blob/main/functions/index.js)

4. Create a secrets file to store Stripe keys

In the project's `functions` directory, create a `.env` file. This file stores your secret values that should not be uploaded or stored on any public servers.

Add the contents below, replacing `{YOUR KEY HERE}` with your actual key values.

```
  STRIPE_SECRET_KEY_TEST="{YOUR TEST KEY HERE}"
  STRIPE_SECRET_KEY_LIVE="{YOUR LIVE KEY HERE}"
```

5. Deploy your Functions to Firebase

Before we deploy our functions it's usually a good idea to test via emulators that simulate the functions in a local environment. You can find the details to run these emulators [here](https://firebase.google.com/docs/functions/get-started#emulate-execution-of-your-functions).

Navigate to the project's base directory. Run the following command to upload your functions to Firebase Functions.

```
firebase deploy --only functions
```

Your functions are now deployed and accessible via Firebase.
