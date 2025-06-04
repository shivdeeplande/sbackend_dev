const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const AWS = require("aws-sdk");
const DocumentClient = new AWS.DynamoDB.DocumentClient();
const { insertItem, getAllItems } = require("../service/dynamo");
const { verifyToken } = require("../middlewares/verifyToken");

const TABLE_NAME = "Donations_dev";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});


// INITIATE DONATION (Create Record + Razorpay Order)
router.post("/initiate", verifyToken, async (req, res) => {
  try {
    const formData = req.body;
    const donationId = uuidv4();

    const donationItem = {
      donationId,
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      state: formData.state,
      district: formData.district,
      panNumber: formData.panNumber || null,
      pinCode: formData.pinCode || null,
      referrerPhoneNumber: formData.referrerPhoneNumber || null,
      donationAmount: Number(formData.donationAmount),
    //   isRecurring: formData.isRecurring || false,
    //   coverTransactionFee: formData.coverTransactionFee || false,
      declarationAccepted: true,
      createdAt: new Date().toISOString(),
      status: "initiated",
      payment: {
        razorpay_payment_id: null,
        razorpay_order_id: null,
        razorpay_signature: null,
        paymentStatus: null,
        paymentMethod: null,
        paymentTimestamp: null,
        currency: "INR",
        amountPaid: null,
      },
    };

    await insertItem(TABLE_NAME, donationItem);

    const razorpayOrder = await razorpay.orders.create({
      amount: donationItem.donationAmount * 100, // in paise
      currency: "INR",
      receipt: donationId,
      notes: { donationId },
    });

    const responseItem = {
      donationId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };

    res.success({
      message: "Donation initiated",
      data: responseItem,
    });
  } catch (err) {
    console.error("Error initiating donation:", err);
    res.errors({ message: "Unable to initiate donation", data: err });
  }
});

// // RAZORPAY WEBHOOK HANDLER (Update Payment Status)
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const payment = body.payload.payment.entity;
    const donationId = payment.notes?.donationId || payment.receipt;

    // console.log("Payment received:", payment);

    const updateParams = {
      TableName: TABLE_NAME,
      Key: { donationId },
      UpdateExpression: `
        SET #status = :status,
            #payment.#rpId = :rpId,
            #payment.#roId = :roId,
            #payment.#signature = :signature,
            #payment.#payStatus = :payStatus,
            #payment.#method = :method,
            #payment.#time = :time,
            #payment.#amount = :amount
      `,
      ExpressionAttributeNames: {
        "#status": "status",
        "#payment": "payment",
        "#rpId": "razorpay_payment_id",
        "#roId": "razorpay_order_id",
        "#signature": "razorpay_signature",
        "#payStatus": "paymentStatus",
        "#method": "paymentMethod",
        "#time": "paymentTimestamp",
        "#amount": "amountPaid",
      },
      ExpressionAttributeValues: {
        ":status": "paid",
        ":rpId": payment.id,
        ":roId": payment.order_id,
        ":signature": signature,
        ":payStatus": "success",
        ":method": payment.method,
        ":time": new Date(payment.created_at * 1000).toISOString(),
        ":amount": payment.amount / 100,
      },
    };


    const responseItem = {
        donationId,
        paymentId: payment.id,
        status: "paid",
        amountPaid: payment.amount,
        paymentMethod: payment.method,
        paymentTimestamp: new Date(payment.created_at * 1000).toISOString(),
    }

    await DocumentClient.update(updateParams).promise();
    res.success({
      message: "Payment recorded successfully",
      data: responseItem,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

// GET ALL DONATIONS (Admin/Logged-in Users)
router.get("/donations", verifyToken, async (req, res) => {
  try {
    const items = await getAllItems(TABLE_NAME);
    res.success({ data: items.Items });
  } catch (err) {
    console.error("Get donations error:", err);
    res.errors({ message: "Unable to fetch donations" });
  }
});

// GET DONATION BY ID (Admin/Logged-in Users)
router.get("/:donationId", verifyToken, async (req, res) => {
  const { donationId } = req.params;
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { 
        donationId 
      },
    }
    const item = await DocumentClient.get(params).promise();
    if (!item) {
      return res.status(404).json({ message: "Donation not found" });
    }
    res.success({message: "Donation fetched successfully", data: item });
  } catch (err) {
    // console.error("Get donation by ID error:", err);
    res.errors({ message: "Unable to fetch donation" });
  }
});

module.exports = router;

