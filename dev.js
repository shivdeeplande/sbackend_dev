const express = require("express");
const path = require("path");
const fs = require('fs');
const cors = require('cors');
const https = require("https");
const cookieParser = require("cookie-parser");
const i18n = require("i18n");
const  translateMiddleware  = require("./middlewares/translateMiddleware");
const { restrictToLoggedinUserOnly, checkAuth } = require("./middlewares/auth");
const responseFormatter = require('./middlewares/responseFormator')
const userRoute = require("./routes/user");
const adminRoute = require("./routes/admin");
const eventsRoute = require("./routes/events");
const galleryRoute = require("./routes/gallery");
const blogsRoute = require("./routes/blogs");
const privacyPolicyRoute = require("./routes/privacyPolicy");
const termConditionRoute = require("./routes/termCondition");
const faqRoute = require("./routes/faq");
const contactusRoute = require("./routes/contactus");
const newsRoute = require("./routes/news");
const missionRoute = require("./routes/mission");
const bannerRoute = require("./routes/banner");
const dashboardRoute = require("./routes/dashboard");
const chatRoute = require("./routes/chat");
const notificationRoute = require("./routes/notification");
const staticRoute = require("./routes/staticRouter");
const donationRoute = require("./routes/donation");

const app = express();
const PORT = process.env.PORT || 8002;
// Load SSL Certificate
const options = {
    key: fs.readFileSync("./privkey.pem"),
    cert: fs.readFileSync("./fullchain.pem")
  };

// Configure i18n
// i18n.configure({
//  locales: ["en", "hi"], // Supported languages
 
//  directory: path.join(__dirname, '/locales'),
//  defaultLocale: "en", // Default language
//  queryParameter: "lang", // Language switch via query params (e.g., ?lang=hi)
//  autoReload: true, // Auto-reload on file change
//  syncFiles: true, // Sync missing translations
//  objectNotation: true,
// });

// Middleware to use i18n
// app.use(i18n.init);
app.use(translateMiddleware);
app.use(cors());
app.use(express.json());
//app.use(morgan('dev'));
app.use(responseFormatter)
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use(express.urlencoded({ extended: false }));


app.use("/", staticRoute);
app.use("/api/v1", userRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/events", eventsRoute);
app.use("/api/v1/gallery", galleryRoute);
app.use("/api/v1/blogs", blogsRoute);
app.use("/api/v1/privacyPolicy", privacyPolicyRoute);
app.use("/api/v1/termCondition", termConditionRoute);
app.use("/api/v1/faq", faqRoute);
app.use("/api/v1/contactus", contactusRoute);
app.use("/api/v1/news", newsRoute);
app.use("/api/v1/mission", missionRoute);
app.use("/api/v1/banner", bannerRoute);
app.use("/api/v1/dashboard", dashboardRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/notification", notificationRoute);
app.use("/api/v1/donation", donationRoute);

// app.listen(PORT, () => console.log(`Server Started at PORT:${PORT}`));
// Create HTTPS Server
const server = https.createServer(options, app)
server.listen(PORT, () => {
    console.log(`🚀 HTTPS Server running at https://localhost:${PORT}`);
  });
