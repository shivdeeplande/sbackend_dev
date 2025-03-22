const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, generateRandomString,getConditionalRecords, countRecords, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
router.get('/', async (req, res) => {
	try {

		const today = new Date();
		// Get the timestamp for 7 days ago
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		// Get the timestamp for 7 days afer
		const sevenDaysAfter = new Date();
		sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);
	
		// Convert to YYYY-MM-DD format
		const formattedTodayDate = today.toISOString().split("T")[0];
		const formattedDate = sevenDaysAgo.toISOString().split("T")[0];
		const formattedDateAfter = sevenDaysAfter.toISOString().split("T")[0];

		const bannerParams = {
			TableName: 'banner_dev',
			FilterExpression: "isActive = :boolTrue OR isActive = :stringTrue",
			ExpressionAttributeValues: {
			  ":boolTrue":1,      // Boolean true
			  ":stringTrue": "1",  // String "true"
			},
		  };
		const totalbanner = await getConditionalRecords(bannerParams);
		const itemsBanner = totalbanner//await getAllItems('banner');
		
		const eventsParams = {
			TableName: 'events_dev',
			FilterExpression: "toggle = :boolTrue OR toggle = :stringTrue",
			ExpressionAttributeValues: {
			  ":boolTrue": 1,      // Boolean true
			  ":stringTrue": "1",  // String "true"
			},
		  };
		const totalevents = await getConditionalRecords(eventsParams);
		const itemsEvents = totalevents//await getAllItems('events');
		const userParams = {
			TableName: 'users_dev',
			FilterExpression: "isMember = :boolTrue OR isMember = :stringTrue",
			ExpressionAttributeValues: {
			  ":boolTrue": true,      // Boolean true
			  ":stringTrue": "true",  // String "true"
			},
		  };
		const totalUser = await getConditionalRecords(userParams);
			
		const newsParams = {
		TableName: 'news_dev',
		FilterExpression: "updatedDate >= :sevenDaysAgo AND (isVisible= :isVisibleString OR isVisible= :isVisibleBool)",
		ExpressionAttributeValues: {
			":sevenDaysAgo": formattedDate,
			":isVisibleBool":  true,
			":isVisibleString": "true",
		},
		};
		  
		const totalNews = await getConditionalRecords(newsParams);
		res.success({data:{
			banner:itemsBanner,
			events:itemsEvents,
			user:totalUser,
			news:totalNews,
		}})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

module.exports = router
