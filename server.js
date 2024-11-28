const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const cors = require("cors");
const express = require("express");
const sdk = require("node-appwrite");
const { Resend } = require("resend");

const stripe = require("stripe")(process.env.STRIPE_API_KEY);
const app = express();
const DATABASE_ID = "6722601a0008810208ab";
const USER_ACCOUNT_COLLECTION_ID = "6726475d0002a67892f2";
const resend = new Resend(process.env.RESEND_API_KEY);
const client = new sdk.Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("67224b080010c36860d8");
//.setKey("<YOUR_API_KEY>");

const databases = new sdk.Databases(client);

const corsOption = {
  origin: "*",
  credential: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOption));
// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.WEBHOOK_SECRET;
app.post(
  "/stripewebhook",
  express.raw({ type: "application/json" }),
  (request, response) => {
    const sig = request.headers["stripe-signature"];
    //console.log(request.body);
    let event;
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      console.log(`error: ${err}`);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const res = event.data.object;
        // const email=res.email
        const userId = res.metadata.userId;
        const credits = res.metadata.credits;
        const email = res.metadata.email;
        console.log(userId);
        console.log(credits);
        console.log(email);
        //  updateUserAccountCredit(userId, Number(credits));
        getDocument(userId, Number(credits), email);
        break;
      }

      // ... handle other event types

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.listen(4242, () => console.log("Running on port 4242"));
//for update user credit
const getDocument = async (documentId, usedFreeTime, email) => {
  try {
    const result = await databases.getDocument(
      DATABASE_ID, // databaseId
      USER_ACCOUNT_COLLECTION_ID, // collectionId
      documentId // documentId
    );

    const resInInt = parseInt(result.Time, 10);
    updateUserAccountCredit(documentId, resInInt + usedFreeTime, email);
    sendEmail(email, resInInt + usedFreeTime);
  } catch (error) {
    console.log(error);
  }
};
const updateUserAccountCredit = async (documentId, Time) => {
  try {
    const result = await databases.updateDocument(
      DATABASE_ID, // databaseId
      USER_ACCOUNT_COLLECTION_ID, // collectionId
      documentId, // documentId
      {
        Time: Time,
      }
    );
    console.log(result);
    console.log("inserted to userPlan! .");
  } catch (e) {
    console.error("Error:", e);
  }
};
const convertirDuree = (dureeEnsecondes) => {
  const dureeEnMinutes = dureeEnsecondes / 60;
  if (dureeEnMinutes < 1) {
    return `${Math.round(dureeEnsecondes)} sec 
    `;
  } else if (dureeEnMinutes < 60) {
    return `${Math.round(dureeEnMinutes)} min`;
  } else {
    const heures = Math.floor(dureeEnMinutes / 60);
    const minute = Math.round(dureeEnMinutes % 60);
    if (!isNaN(heures) && !isNaN(minute)) {
      return `${heures} hours  ${minute} min 
    `;
    } else {
      return "...";
    }
  }
};
async function sendEmail(receiverEmail, credits) {
  const { data, error } = await resend.emails.send({
    from: "AudiscribeAI <onboarding@resend.dev>",
    to: [`${receiverEmail}`],
    subject: "Your Credit Purchase is Confirmed.",
    html: `<div>
    <p>Hello,</p>

    <p>Thank you for your purchase of <strong>${convertirDuree(
      credits
    )}</strong>! Your credits have been added to your account and are ready to use on our platform.</p>

    <p>To access your dashboard, click here: 
        <a href="https://audiscribeai.vercel.app/dashboard" target="_blank">Access my account</a>.
    </p>

    <p>If you have any questions, our team is available at <a href="mailto:orceleu@gmail.com">support_email</a>.</p>

    <p>Thank you for trusting us.</p>

    <p>Best regards,<br>
    The <strong>Audiscribe AI </strong> Team</p>
</div>`,
  });

  if (error) {
    return console.error({ error });
  }

  console.log({ data });
}
app.use(express.json());
