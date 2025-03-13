const express = require("express");
const axios = require('axios');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { handleUserSignup, handleUserLogin } = require("../controllers/user");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'chat';
// Multer file filter (allow images, videos, and documents)
const fileFilter = (req, file, cb) => {
	if (
	  file.mimetype.startsWith("image") || 
	  file.mimetype.startsWith("video") ||
	  file.mimetype.startsWith("application") || 
	  file.mimetype.startsWith("text")
	) {
	  cb(null, true);
	} else {
	  cb(new Error("Only image, video, and document files are allowed"), false);
	}
  };
  
const upload = multer({ storage: multer.memoryStorage(), fileFilter });
const { getAllItems, batchInsertLargeDataset, 
	getAdminMessage,
	getUserMessage,
	getUsersMessage,
	getConditionalRecords,
	generateRandomString, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');


router.post("/send",verifyToken, upload.fields([{ name: "image" }, { name: "video" },{ name: "document" }]), async (req, res) => {
	const body = req.body;
	try {
		if(!body.senderId){
			res.errors({message:'senderId Required'})
		}else if(!body.receiverId){
			res.errors({message:'receiverId Required'})
		}else{
			
			const imageFile = req.files.image ? req.files.image[0] : null;
			const videoFile = req.files.video ? req.files.video[0] : null;
			const documentFile = req.files.document ? req.files.document[0] : null;
			let image = ""
			if(imageFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = imageFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${imageFile.originalname}`; // Unique filename
				const contentType = imageFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				image= result.Location				
			}
			let video = ""
			if(videoFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = videoFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${videoFile.originalname}`; // Unique filename
				const contentType = videoFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				video= result.Location				
			}
			let document = ""
			if(documentFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = documentFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${documentFile.originalname}`; // Unique filename
				const contentType = documentFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				document= result.Location				
			}

			body.id = uuidv4();
			const item = {
				id:body.id,
				senderId:body.senderId,
				receiverId:body.receiverId,
				text:body.message || "",
				image:image,
				video:video,
				document:document,
				sent: true,
				received: true,
				pending: false,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			const chatParams = {
				TableName: 'chat',
				FilterExpression: "senderId = :senderIdData AND receiverId = :receiverIdData",
				ExpressionAttributeValues: {
				  ":senderIdData": body.senderId,      // Boolean true
				  ":receiverIdData": body.receiverId,  // String "true"
				},
			  };
			const firstTimeChat = await getConditionalRecords(chatParams);
			  console.log('firstTimeChat',firstTimeChat);
			  if(firstTimeChat.length>0){
				await insertItem(TABLE_NAME, item);
			  }else{
				await insertItem(TABLE_NAME, item);
				item.id = uuidv4();    
				item.senderId  = body.receiverId
				item.receiverId  = body.senderId
				item.text  = "Thanks for reaching out! We appreciate your message and will get back to you as soon as possible. If it's urgent, please let me know. Have a great day!"
				item.createDate =new Date().toISOString(),
				item.updatedDate =new Date().toISOString()
				await insertItem(TABLE_NAME, item);
			  } 
			res.success({data:item, message:"chat send successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});


/**
 * ✅ Fetch chat messages between two users
 */
router.get("/user/:senderId/:receiverId", async (req, res) => {
	const senderId = req.params.senderId;
	const receiverId = req.params.receiverId;
	try {
		if(!senderId){
			res.errors({message:'senderId Required'})
		}else if(!receiverId){
			res.errors({message:'receiverId Required'})
		}else{
			const item = await getUserMessage(senderId,receiverId)
			res.success({data:item, message:"user chat fetch successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

/**
 * ✅ Fetch chat messages admin
 */
router.get("/admin/:adminId", async (req, res) => {
	const adminId = req.params.adminId;
	try {
		if(!adminId){
			res.errors({message:'adminId Required'})
		}else{
			const item = await getAdminMessage(adminId)
			res.success({data:item, message:"admin chat fetch successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});
/**
 * ✅ Fetch chat messages user
 */
router.get("/users/:userId", async (req, res) => {
	const userId = req.params.userId;
	try {
		if(!userId){
			res.errors({message:'userId Required'})
		}else{
			const item = await getUsersMessage(userId)
			res.success({data:item, message:"user chat fetch successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});
module.exports = router;
